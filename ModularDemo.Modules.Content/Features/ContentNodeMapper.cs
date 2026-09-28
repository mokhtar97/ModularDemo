// ModularDemo.Modules.Content/Features/ContentNodeMapper.cs
using System.Collections;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Blocks;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Cms.Core.Strings;
using Umbraco.Extensions;

namespace ModularDemo.Modules.Content.Features;


public sealed class ContentNodeMapper(
	IDocumentNavigationQueryService navigation,
	IPublishedContentStatusFilteringService publishedStatusFilter,
	IPublishedUrlProvider urlProvider,
	IPublishedValueFallback valueFallback)
{
	private const int MaxDepth = 5;

	
	internal ContentNodeDto Map(IPublishedContent content, int? depth) =>
		MapNode(content, Math.Clamp(depth ?? 0, 0, MaxDepth));

	private ContentNodeDto MapNode(IPublishedContent content, int depth) =>
		new(
			content.Id,
			content.Key,
			content.Name,
			content.ContentType.Alias,
			urlProvider.GetUrl(content),
			content.Level,
			content.SortOrder,
			content.CreateDate,
			content.UpdateDate,
			MapProperties(content),
			depth > 0
				? content.Children(navigation, publishedStatusFilter).Select(child => MapNode(child, depth - 1)).ToList()
				: null);

	// Names, URLs and values follow the culture CultureContext put on the variation context.
	private Dictionary<string, object?> MapProperties(IPublishedElement element) =>
		element.Properties.ToDictionary(p => p.Alias, p => ConvertValue(GetValue(element, p)));

	/// <summary>
	/// The property value in the current culture. When it is empty there, uses the language's
	/// fallback language (Settings → Languages → "Fall back language"), like Razor's Value() can.
	/// </summary>
	private object? GetValue(IPublishedElement element, IPublishedProperty property) =>
		property.HasValue()
			? property.GetValue()
			: element.Value(valueFallback, property.Alias, fallback: Fallback.ToLanguage);

	private object? ConvertValue(object? value) => value switch
	{
		null => null,
		string or ValueType => value, // primitives, DateTime, Guid, decimal, enums
		IHtmlEncodedString html => html.ToHtmlString(),
		IPublishedContent picked => ToLink(picked), // content or media (incl. MediaWithCrops)
		Link link => new LinkDto(link.Name, link.Url, link.Target, link.Type.ToString()),
		BlockListModel list => list.Select(item => new BlockListItemDto(ToElement(item.Content), ToElementOrNull(item.Settings))).ToList(),
		BlockGridModel grid => grid.Select(ToGridItem).ToList(),
		IPublishedElement element => ToElement(element),
		IEnumerable items => items.Cast<object?>().Select(ConvertValue).ToList(),
		_ => value,
	};

	private ContentLinkDto ToLink(IPublishedContent content) =>
		new(
			content.Id,
			content.Key,
			content.Name,
			content.ContentType.Alias,
			content.ItemType == PublishedItemType.Media ? urlProvider.GetMediaUrl(content) : urlProvider.GetUrl(content));

	private ElementDto ToElement(IPublishedElement element) =>
		new(element.ContentType.Alias, element.Key, MapProperties(element));

	private ElementDto? ToElementOrNull(IPublishedElement? element) =>
		element is null ? null : ToElement(element);

	private BlockGridItemDto ToGridItem(BlockGridItem item) =>
		new(
			ToElement(item.Content),
			ToElementOrNull(item.Settings),
			item.RowSpan,
			item.ColumnSpan,
			item.Areas
				.Select(area => new BlockGridAreaDto(area.Alias, area.RowSpan, area.ColumnSpan, area.Select(ToGridItem).ToList()))
				.ToList());
}
