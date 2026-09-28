// ModularDemo.Modules.Content/Features/ContentController.cs
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Extensions;


namespace ModularDemo.Modules.Content.Features;

/// <summary>
/// Published content as JSON. Every content endpoint takes an optional <c>?culture=</c>
/// (e.g. "en-US", "ar"); missing or unknown cultures use the default language.
/// </summary>
[ApiController]
[Route("api/content")]
[Tags("Content")]
public sealed class ContentController(
	IPublishedContentQuery contentQuery,
	IDocumentUrlService documentUrls,
	IDocumentNavigationQueryService navigation,
	IPublishedContentStatusFilteringService publishedStatusFilter,
	IDictionaryItemService dictionaryItems,
	CultureContext cultures,
	ContentNodeMapper mapper) : ControllerBase
{
	[HttpGet("nodes/{id:int}")]
	[ProducesResponseType<ContentNodeDto>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> GetById(int id, int? depth, string? culture)
	{
		await cultures.ApplyAsync(culture);
		return ToResult(contentQuery.Content(id), depth);
	}

	[HttpGet("nodes/{key:guid}")]
	[ProducesResponseType<ContentNodeDto>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> GetByKey(Guid key, int? depth, string? culture)
	{
		await cultures.ApplyAsync(culture);
		
		return ToResult(contentQuery.Content(key), depth);
	}

	// old: /umbraco/api/nodeapi/getnodebyurl?url=/about
	[HttpGet("by-url")]
	[ProducesResponseType<ContentNodeDto>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> GetByUrl(string url, int? depth, string? culture)
	{
		var applied = await cultures.ApplyAsync(culture);

		// IPublishedContentQuery has no route lookup, so resolve the route to a key first.
		var route = "/" + url.Trim().Trim('/');
		var key = documentUrls.GetDocumentKeyByRoute(route, applied, documentStartNodeId: null, isDraft: false);

		return ToResult(key is null ? null : contentQuery.Content(key.Value), depth);
	}

	// old: /umbraco/api/nodeapi/getnodesbydocumenttypealias?documentTypeAlias=blogPost
	[HttpGet("by-type/{contentTypeAlias}")]
	public async Task<ActionResult<IReadOnlyList<ContentNodeDto>>> GetByContentType(
		string contentTypeAlias, int? depth, string? culture)
	{
		await cultures.ApplyAsync(culture);

		return contentQuery.ContentAtRoot()
			.SelectMany(root => root.DescendantsOrSelfOfType(navigation, publishedStatusFilter, contentTypeAlias))
			.DistinctBy(content => content.Key)
			.Select(content => mapper.Map(content, depth))
			.ToList();
	}

	/// <summary>Languages from Settings → Languages, default first (for the frontend's language switcher).</summary>
	[HttpGet("languages")]
	public async Task<IReadOnlyList<LanguageDto>> GetLanguages() =>
		(await cultures.GetLanguagesAsync())
			.Select(l => new LanguageDto(l.IsoCode, l.CultureName, l.IsDefault, l.FallbackIsoCode))
			.ToList();

	/// <summary>
	/// Dictionary items (Translation section) as <c>{ "key": "text" }</c> in the requested culture,
	/// falling back to the default language. Keys without any text are left out.
	/// </summary>
	[HttpGet("dictionary")]
	public async Task<IReadOnlyDictionary<string, string>> GetDictionary(string? culture)
	{
		var applied = await cultures.ApplyAsync(culture);
		var defaultCulture = (await cultures.GetLanguagesAsync()).FirstOrDefault(l => l.IsDefault)?.IsoCode;

		var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
		foreach (var item in await dictionaryItems.GetDescendantsAsync(null))
		{
			var text = Translate(item, applied) ?? Translate(item, defaultCulture);
			if (text is not null) result[item.ItemKey] = text;
		}
		return result;
	}

	private static string? Translate(IDictionaryItem item, string? culture) =>
		culture is null
			? null
			: item.Translations
				.FirstOrDefault(t => string.Equals(t.LanguageIsoCode, culture, StringComparison.OrdinalIgnoreCase))
				?.Value is { Length: > 0 } value ? value : null;

	private IActionResult ToResult(IPublishedContent? content, int? depth) =>
		content is null
			? NotFound(new { message = "Node not found" })
			: Ok(mapper.Map(content, depth));
}
