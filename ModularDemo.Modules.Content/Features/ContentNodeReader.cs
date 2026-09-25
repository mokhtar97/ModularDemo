// ModularDemo.Modules.Content/Features/ContentNodeReader.cs
using Microsoft.AspNetCore.Http;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Services.Navigation;

namespace ModularDemo.Modules.Content.Features;

/// <summary>
/// Reads published content from Umbraco's cache.
/// Replaces the v7 NodeFactory / uQuery calls, which no longer exist.
/// </summary>
internal sealed class ContentNodeReader(
	IPublishedContentCache contentCache,
	IDocumentNavigationQueryService navigation,
	IDocumentUrlService documentUrls,
	IPublishedUrlProvider urlProvider,
	IHttpContextAccessor httpContextAccessor)
{
	// The v7 API always walked the whole tree; here children are opt-in and capped.
	private const int DefaultDepth = 1;
	private const int MaxDepth = 5;

	public ContentNodeDto? GetById(int id, int? depth) =>
		MapOrNull(contentCache.GetById(id), depth);

	public ContentNodeDto? GetByKey(Guid key, int? depth) =>
		MapOrNull(contentCache.GetById(key), depth);

	public ContentNodeDto? GetByUrl(string url, int? depth)
	{
		var key = documentUrls.GetDocumentKeyByRoute(
			NormalizeRoute(url), culture: null, documentStartNodeId: null, isDraft: false);

		return key is null ? null : MapOrNull(contentCache.GetById(key.Value), depth);
	}

	public IReadOnlyList<ContentNodeDto> GetByContentType(string contentTypeAlias, int? depth)
	{
		var keys = new List<Guid>();

		if (navigation.TryGetRootKeysOfType(contentTypeAlias, out var rootsOfType))
			keys.AddRange(rootsOfType);

		if (navigation.TryGetRootKeys(out var roots))
			foreach (var root in roots)
				if (navigation.TryGetDescendantsKeysOfType(root, contentTypeAlias, out var descendants))
					keys.AddRange(descendants);

		return keys
			.Distinct()
			.Select(key => MapOrNull(contentCache.GetById(key), depth ?? 0))
			.OfType<ContentNodeDto>()
			.ToList();
	}

	private ContentNodeDto? MapOrNull(IPublishedContent? content, int? depth) =>
		content is null ? null : MapNode(content, Math.Clamp(depth ?? DefaultDepth, 0, MaxDepth));

	private ContentNodeDto MapNode(IPublishedContent content, int depth)
	{
		var url = urlProvider.GetUrl(content);

		return new ContentNodeDto(
			content.Id,
			content.Key,
			content.Name,
			content.ContentType.Alias,
			content.Level,
			content.SortOrder,
			content.TemplateId,
			url,
			ToAbsolute(url),
			content.CreateDate,
			content.UpdateDate,
			// Same JSON-friendly values the Umbraco Delivery API produces.
			content.Properties.ToDictionary(p => p.Alias, p => p.GetDeliveryApiValue(expanding: false)),
			depth > 0 ? GetChildren(content.Key, depth - 1) : []);
	}

	private List<ContentNodeDto> GetChildren(Guid parentKey, int depth) =>
		navigation.TryGetChildrenKeys(parentKey, out var childKeys)
			? childKeys
				.Select(key => contentCache.GetById(key))
				.OfType<IPublishedContent>() // skips unpublished children
				.Select(child => MapNode(child, depth))
				.ToList()
			: [];

	private string? ToAbsolute(string url)
	{
		if (url == "#") return null; // Umbraco's "no URL"
		if (Uri.IsWellFormedUriString(url, UriKind.Absolute)) return url;

		var request = httpContextAccessor.HttpContext?.Request;
		return request is null ? null : $"{request.Scheme}://{request.Host}{url}";
	}

	private static string NormalizeRoute(string url)
	{
		var path = url.Split('?', '#')[0].Trim().ToLowerInvariant();
		if (!path.StartsWith('/')) path = "/" + path;
		return path.Length > 1 ? path.TrimEnd('/') : path;
	}
}
