// ModularDemo.Modules.Content/Features/ContentNodeDto.cs
namespace ModularDemo.Modules.Content.Features;

/// <summary>JSON shape returned by the content endpoints (successor of the v7 ViewNode).</summary>
internal sealed record ContentNodeDto(
	int Id,
	Guid Key,
	string Name,
	string ContentType,
	int Level,
	int SortOrder,
	int? TemplateId,
	string Url,
	string? AbsoluteUrl,
	DateTime CreateDate,
	DateTime UpdateDate,
	IReadOnlyDictionary<string, object?> Properties,
	IReadOnlyList<ContentNodeDto> Children);
