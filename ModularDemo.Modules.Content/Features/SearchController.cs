// ModularDemo.Modules.Content/Features/SearchController.cs
using System.Net;
using System.Text.RegularExpressions;
using Examine;
using Examine.Search;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Infrastructure.Examine;
using Umbraco.Extensions;

namespace ModularDemo.Modules.Content.Features;

/// <summary>
/// Full-text search over published content (Umbraco's External Examine index).
/// <c>GET /api/search?q=lion&amp;culture=ar&amp;root={guid}&amp;take=10</c>
/// </summary>
[ApiController]
[Route("api/search")]
[Tags("Search")]
public sealed partial class SearchController(
	IExamineManager examineManager,
	IPublishedContentQuery contentQuery,
	IPublishedUrlProvider urlProvider,
	CultureContext cultures) : ControllerBase
{
	/// <summary>
	/// Property aliases to search. Culture-variant properties are indexed as
	/// "<c>alias_culture</c>" (e.g. <c>pageTitle_ar</c>), so both forms are queried.
	/// </summary>
	private static readonly string[] Aliases =
		["nodeName", "pageTitle", "heroText", "content", "bodyText", "description", "productName", "message"];

	/// <summary>Properties used for the short text under each result, in order of preference.</summary>
	private static readonly string[] ExcerptAliases = ["heroText", "description", "message", "content", "bodyText"];

	private const int MaxTake = 50;
	private const int MaxExcerpt = 140;

	[HttpGet]
	[ProducesResponseType<IReadOnlyList<SearchResultDto>>(StatusCodes.Status200OK)]
	public async Task<IActionResult> Search(string? q, string? culture, Guid? root, int take = 10)
	{
		var terms = Terms(q);
		if (terms.Length == 0) return Ok(Array.Empty<SearchResultDto>());

		if (!examineManager.TryGetIndex(Constants.UmbracoIndexes.ExternalIndexName, out var index))
			return Problem("Search index not found", statusCode: StatusCodes.Status503ServiceUnavailable);

		var applied = await cultures.ApplyAsync(culture);
		take = Math.Clamp(take, 1, MaxTake);

		var fields = Aliases
			.SelectMany(alias => applied is null ? [alias] : new[] { alias, $"{alias}_{applied.ToLowerInvariant()}" })
			.ToArray();

		// Each word as a prefix ("prod" finds "products"); a result must match every word.
		var query = index.Searcher.CreateQuery(IndexTypes.Content);
		IBooleanOperation filter = query.GroupedOr(fields, terms[0].MultipleCharacterWildcard());
		foreach (var term in terms.Skip(1))
			filter = filter.And().GroupedOr(fields, term.MultipleCharacterWildcard());

		// Fetch extra hits: some are dropped below (other sites, hidden, not published in this culture).
		var hits = filter.Execute(QueryOptions.SkipTake(0, take * 5));

		var rootId = root is { } key ? contentQuery.Content(key)?.Id : null;
		if (root is not null && rootId is null) return Ok(Array.Empty<SearchResultDto>());

		var results = hits
			.Select(hit => int.TryParse(hit.Id, out var id) ? contentQuery.Content(id) : null)
			.OfType<IPublishedContent>()
			.Where(content => rootId is null || content.Path.Split(',').Contains(rootId.Value.ToString()))
			.Where(content => !content.ContentType.VariesByCulture() || content.IsPublished(applied))
			.Where(content => content.GetProperty("umbracoNaviHide")?.GetValue() is not true)
			.DistinctBy(content => content.Key)
			.Take(take)
			.Select(content => new SearchResultDto(
				content.Key,
				content.Name,
				urlProvider.GetUrl(content, UrlMode.Default, applied),
				content.ContentType.Alias,
				Excerpt(content)))
			.ToList();

		return Ok(results);
	}

	/// <summary>Lower-cased words of letters/digits only, so Lucene syntax in user input can't break the query.</summary>
	private static string[] Terms(string? q) =>
		string.IsNullOrWhiteSpace(q)
			? []
			: Words().Matches(q)
				.Select(m => m.Value.ToLowerInvariant())
				.Where(w => w.Length >= 2)
				.Distinct()
				.Take(8)
				.ToArray();

	private static string? Excerpt(IPublishedContent content)
	{
		foreach (var alias in ExcerptAliases)
		{
			var text = content.GetProperty(alias)?.GetValue()?.ToString();
			if (string.IsNullOrWhiteSpace(text)) continue;

			text = WebUtility.HtmlDecode(Tags().Replace(text, " "));
			text = Spaces().Replace(text, " ").Trim();
			if (text.Length == 0) continue;
			return text.Length <= MaxExcerpt ? text : text[..MaxExcerpt].TrimEnd() + "…";
		}
		return null;
	}

	[GeneratedRegex(@"[\p{L}\p{N}]+")]
	private static partial Regex Words();

	[GeneratedRegex("<[^>]*>")]
	private static partial Regex Tags();

	[GeneratedRegex(@"\s+")]
	private static partial Regex Spaces();
}

/// <summary>One search hit. <c>Key</c> lets the frontend map it to its own route.</summary>
public sealed record SearchResultDto(Guid Key, string Name, string Url, string ContentType, string? Excerpt);
