// ModularDemo.Modules.Ticketing/Features/PretixDtos.cs
namespace ModularDemo.Modules.Ticketing.Features;

// Clean shapes returned by /api/pretix/... (never raw pretix JSON).
// Mirrored by ModularDemo.Web/src/app/ticketing/pretix.models.ts — keep them in sync.

/// <summary>Public, non-secret settings the Angular widget needs (GET /api/pretix/settings).</summary>
/// <param name="BaseUrl">pretix root URL for browsers, with a trailing slash.</param>
/// <param name="Organizer">Default organizer slug for pages that don't set <c>pretixOrganizer</c>.</param>
/// <param name="WidgetVersion">Widget asset version, e.g. <c>v1</c>.</param>
public sealed record PretixSettingsDto(string BaseUrl, string? Organizer, string WidgetVersion);

/// <summary>
/// A pretix event (translatable fields already localized). <c>Live</c> = the shop is switched on;
/// <c>TestMode</c> = orders are test orders.
/// </summary>
public sealed record PretixEventDto(
	string Slug,
	string Name,
	bool Live,
	bool TestMode,
	DateTimeOffset? DateFrom,
	DateTimeOffset? DateTo,
	DateTimeOffset? DateAdmission,
	string? Location,
	string? Currency,
	bool HasSubevents,
	DateTimeOffset? PresaleStart,
	DateTimeOffset? PresaleEnd,
	string ShopUrl);

/// <summary>A product (ticket type) with its price and variations.</summary>
public sealed record PretixItemDto(
	int Id,
	string Name,
	string? Description,
	decimal? Price,
	string? Currency,
	bool Admission,
	IReadOnlyList<PretixVariationDto> Variations);

/// <summary>A product variation, e.g. "Student" or "VIP".</summary>
public sealed record PretixVariationDto(int Id, string Name, decimal? Price);

/// <summary>Availability of one quota. <c>Size</c> null = unlimited; <c>AvailableNumber</c> null = unlimited.</summary>
public sealed record PretixQuotaDto(
	int Id,
	string Name,
	int? Size,
	bool? Available,
	int? AvailableNumber,
	IReadOnlyList<int> ItemIds,
	IReadOnlyList<int> VariationIds);
