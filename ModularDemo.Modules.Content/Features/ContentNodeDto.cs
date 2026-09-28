// ModularDemo.Modules.Content/Features/ContentNodeDto.cs
namespace ModularDemo.Modules.Content.Features;

/// <summary>JSON shape returned by the content endpoints (successor of the v7 ViewNode).</summary>
public sealed record ContentNodeDto(
	int Id,
	Guid Key,
	string Name,
	string ContentType,
	string Url,
	int Level,
	int SortOrder,
	DateTime CreateDate,
	DateTime UpdateDate,
	IReadOnlyDictionary<string, object?> Properties,
	IReadOnlyList<ContentNodeDto>? Children);

/// <summary>A picked content or media item (a reference, never the full node, to avoid cycles).</summary>
public sealed record ContentLinkDto(int Id, Guid Key, string Name, string ContentType, string Url);

/// <summary>A link from a multi URL picker.</summary>
public sealed record LinkDto(string? Name, string? Url, string? Target, string Type);

/// <summary>An element inside a block list / block grid (or any other IPublishedElement).</summary>
public sealed record ElementDto(string ContentType, Guid Key, IReadOnlyDictionary<string, object?> Properties);

public sealed record BlockListItemDto(ElementDto Content, ElementDto? Settings);

public sealed record BlockGridItemDto(
	ElementDto Content,
	ElementDto? Settings,
	int RowSpan,
	int ColumnSpan,
	IReadOnlyList<BlockGridAreaDto> Areas);

public sealed record BlockGridAreaDto(string Alias, int RowSpan, int ColumnSpan, IReadOnlyList<BlockGridItemDto> Items);

/// <summary>A language from Settings → Languages.</summary>
public sealed record LanguageDto(string IsoCode, string Name, bool IsDefault, string? FallbackIsoCode);
