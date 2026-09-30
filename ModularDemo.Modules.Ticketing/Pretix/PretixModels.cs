// ModularDemo.Modules.Ticketing/Pretix/PretixModels.cs
using System.Text.Json;

namespace ModularDemo.Modules.Ticketing.Pretix;

// Raw pretix REST API shapes (only the fields we use). pretix uses snake_case JSON and sends
// decimals as strings; see PretixClient.Json. Translatable fields are objects like
// { "en": "Concert", "de": "Konzert" } (or plain strings), so they're kept as JsonElement
// and localized with PretixText.Localize.

internal sealed class PretixPage<T>
{
	public string? Next { get; set; }
	public List<T> Results { get; set; } = [];
}

internal sealed class PretixEvent
{
	public string Slug { get; set; } = "";
	public JsonElement Name { get; set; }
	public bool Live { get; set; }
	public bool Testmode { get; set; }
	public string? Currency { get; set; }
	public DateTimeOffset? DateFrom { get; set; }
	public DateTimeOffset? DateTo { get; set; }
	public DateTimeOffset? DateAdmission { get; set; }
	public DateTimeOffset? PresaleStart { get; set; }
	public DateTimeOffset? PresaleEnd { get; set; }
	public JsonElement Location { get; set; }
	public bool HasSubevents { get; set; }
	public string? PublicUrl { get; set; }
}

internal sealed class PretixItem
{
	public int Id { get; set; }
	public JsonElement Name { get; set; }
	public JsonElement Description { get; set; }
	public decimal? DefaultPrice { get; set; }
	public bool Active { get; set; }
	public bool Admission { get; set; }
	public int? Position { get; set; }
	public List<PretixVariation> Variations { get; set; } = [];
}

internal sealed class PretixVariation
{
	public int Id { get; set; }
	public JsonElement Value { get; set; }
	public decimal? Price { get; set; }
	public decimal? DefaultPrice { get; set; }
	public bool Active { get; set; } = true;
}

internal sealed class PretixQuota
{
	public int Id { get; set; }
	public string Name { get; set; } = "";
	public int? Size { get; set; }
	public List<int> Items { get; set; } = [];
	public List<int> Variations { get; set; } = [];
	public bool? Available { get; set; }
	public int? AvailableNumber { get; set; }
}

internal sealed class PretixOrder
{
	public string Code { get; set; } = "";
	public string Status { get; set; } = "";
	public string? Email { get; set; }
	public decimal Total { get; set; }
	public DateTimeOffset? Datetime { get; set; }
	public List<JsonElement> Positions { get; set; } = [];
}

/// <summary>Helpers for pretix's translatable text fields.</summary>
internal static class PretixText
{
	/// <summary>
	/// Picks the best translation: exact culture ("en-us"), then its language ("ar"),
	/// then English, then the first non-empty value. Plain strings are returned as-is.
	/// </summary>
	public static string? Localize(JsonElement value, string? culture)
	{
		switch (value.ValueKind)
		{
			case JsonValueKind.String:
				return value.GetString();
			case JsonValueKind.Object:
				var texts = value.EnumerateObject()
					.Where(p => p.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(p.Value.GetString()))
					.ToDictionary(p => p.Name.ToLowerInvariant(), p => p.Value.GetString()!);
				if (texts.Count == 0) return null;

				var exact = culture?.ToLowerInvariant();
				var language = exact?.Split('-')[0];
				foreach (var key in new[] { exact, language, "en" })
					if (key is not null && texts.TryGetValue(key, out var text)) return text;

				// e.g. "en-us" requested but pretix only has "en-gb"
				return texts.FirstOrDefault(t => language is not null && t.Key.StartsWith(language + "-")).Value
					?? texts.Values.First();
			default:
				return null;
		}
	}
}
