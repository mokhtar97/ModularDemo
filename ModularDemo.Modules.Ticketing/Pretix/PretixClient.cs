// ModularDemo.Modules.Ticketing/Pretix/PretixClient.cs
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace ModularDemo.Modules.Ticketing.Pretix;

/// <summary>
/// Typed <see cref="HttpClient"/> for the pretix REST API (<c>{BaseUrl}api/v1/</c>).
/// Base address, <c>Authorization: Token …</c> header and timeout are set in
/// <see cref="TicketingModule.AddTicketingModule"/>. Failures surface as <see cref="PretixApiException"/>.
/// </summary>
public sealed class PretixClient(HttpClient http, ILogger<PretixClient> logger)
{
	/// <summary>Named client registration key.</summary>
	public const string HttpClientName = "pretix";

	/// <summary>Safety limit when following pretix's paginated "next" links.</summary>
	private const int MaxPages = 20;

	internal static readonly JsonSerializerOptions Json = new()
	{
		PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
		PropertyNameCaseInsensitive = true,
		NumberHandling = JsonNumberHandling.AllowReadingFromString, // pretix sends "12.00"
	};

	internal Task<List<PretixEvent>> GetFutureEventsAsync(string organizer, bool includeNonLive, CancellationToken ct) =>
		GetAllPagesAsync<PretixEvent>(
			$"organizers/{Esc(organizer)}/events/?is_future=true&ordering=date_from" + (includeNonLive ? "" : "&live=true"), ct);

	internal Task<PretixEvent> GetEventAsync(string organizer, string eventSlug, CancellationToken ct) =>
		GetAsync<PretixEvent>($"organizers/{Esc(organizer)}/events/{Esc(eventSlug)}/", ct);

	internal Task<List<PretixItem>> GetItemsAsync(string organizer, string eventSlug, CancellationToken ct) =>
		GetAllPagesAsync<PretixItem>($"organizers/{Esc(organizer)}/events/{Esc(eventSlug)}/items/?active=true", ct);

	internal Task<List<PretixQuota>> GetQuotasAsync(string organizer, string eventSlug, CancellationToken ct) =>
		GetAllPagesAsync<PretixQuota>($"organizers/{Esc(organizer)}/events/{Esc(eventSlug)}/quotas/?with_availability=true", ct);

	/// <summary>The full order as pretix returns it, plus the parsed fields we use.</summary>
	internal async Task<(PretixOrder Order, JsonElement Raw)> GetOrderAsync(
		string organizer, string eventSlug, string code, CancellationToken ct)
	{
		var raw = await GetAsync<JsonElement>(
			$"organizers/{Esc(organizer)}/events/{Esc(eventSlug)}/orders/{Esc(code)}/", ct);
		return (raw.Deserialize<PretixOrder>(Json) ?? throw new PretixApiException("Empty order response"), raw.Clone());
	}

	private async Task<List<T>> GetAllPagesAsync<T>(string relativeUrl, CancellationToken ct)
	{
		var results = new List<T>();
		string? url = relativeUrl;
		for (var page = 0; url is not null && page < MaxPages; page++)
		{
			var body = await GetAsync<PretixPage<T>>(url, ct);
			results.AddRange(body.Results);
			url = NextPage(body.Next);
		}
		return results;
	}

	/// <summary>pretix returns absolute "next" URLs; only follow ones on the configured host.</summary>
	private string? NextPage(string? next)
	{
		if (string.IsNullOrEmpty(next) || !Uri.TryCreate(next, UriKind.Absolute, out var uri)) return null;
		var baseUri = http.BaseAddress!;
		if (!string.Equals(uri.Authority, baseUri.Authority, StringComparison.OrdinalIgnoreCase))
		{
			logger.LogWarning("Ignoring pretix pagination link to another host: {Url}", next);
			return null;
		}
		return baseUri.MakeRelativeUri(uri).ToString();
	}

	private async Task<T> GetAsync<T>(string relativeUrl, CancellationToken ct)
	{
		HttpResponseMessage response;
		try
		{
			response = await http.GetAsync(relativeUrl, ct);
		}
		catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
		{
			throw new PretixApiException($"pretix did not answer in time ({relativeUrl})", isTimeout: true, inner: ex);
		}
		catch (HttpRequestException ex)
		{
			throw new PretixApiException($"pretix could not be reached ({relativeUrl}): {ex.Message}", inner: ex);
		}

		using (response)
		{
			if (!response.IsSuccessStatusCode)
			{
				// 401/403 mean a wrong token or missing team permission; worth a clear log line.
				if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
					logger.LogError("pretix rejected the API token ({Status}) for {Url}", (int)response.StatusCode, relativeUrl);
				throw new PretixApiException(
					$"pretix answered {(int)response.StatusCode} for {relativeUrl}", response.StatusCode);
			}

			try
			{
				await using var stream = await response.Content.ReadAsStreamAsync(ct);
				return await JsonSerializer.DeserializeAsync<T>(stream, Json, ct)
					?? throw new PretixApiException($"pretix returned an empty body for {relativeUrl}");
			}
			catch (JsonException ex)
			{
				throw new PretixApiException($"pretix returned invalid JSON for {relativeUrl}", inner: ex);
			}
		}
	}

	private static string Esc(string value) => Uri.EscapeDataString(value);
}
