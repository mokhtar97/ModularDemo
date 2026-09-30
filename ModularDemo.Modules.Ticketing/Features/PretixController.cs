// ModularDemo.Modules.Ticketing/Features/PretixController.cs
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ModularDemo.Modules.Ticketing.Pretix;

namespace ModularDemo.Modules.Ticketing.Features;

/// <summary>
/// Read-only proxy for the pretix REST API, so the API token stays on the server.
/// Responses are cached for <see cref="PretixOptions.CacheMinutes"/> minutes. Status codes:
/// 404 = not found in pretix, 502 = pretix error/unreachable, 503 = not configured, 504 = timeout.
/// Optional <c>?culture=</c> (e.g. "ar", "en-US") picks the language of translatable fields.
/// </summary>
[ApiController]
[Route("api/pretix")]
[Tags("Pretix")]
public sealed class PretixController(
	PretixClient pretix,
	IMemoryCache cache,
	IOptionsSnapshot<PretixOptions> options,
	ILogger<PretixController> logger) : ControllerBase
{
	private const string Slug = "regex(^[[a-zA-Z0-9]][[a-zA-Z0-9._-]]{{0,63}}$)";

	private PretixOptions Options => options.Value;

	/// <summary>Public settings for the Angular widget: browser URL, default organizer, widget version.</summary>
	[HttpGet("settings")]
	[ProducesResponseType<PretixSettingsDto>(StatusCodes.Status200OK)]
	public ActionResult<PretixSettingsDto> GetSettings() =>
		new PretixSettingsDto(
			Options.BrowserRootUrl,
			string.IsNullOrWhiteSpace(Options.Organizer) ? null : Options.Organizer,
			Options.WidgetVersion);

	/// <summary>
	/// Future events of the configured organizer, soonest first: live ones only, or all when
	/// <see cref="PretixOptions.IncludeNonLiveEvents"/> is on.
	/// </summary>
	[HttpGet("events")]
	[ProducesResponseType<IReadOnlyList<PretixEventDto>>(StatusCodes.Status200OK)]
	public Task<IActionResult> GetEvents(string? culture, CancellationToken ct) =>
		Proxy(async () =>
		{
			var includeNonLive = Options.IncludeNonLiveEvents;
			var events = await Cached($"events:{Options.Organizer}:{(includeNonLive ? "all" : "live")}",
				() => pretix.GetFutureEventsAsync(Options.Organizer, includeNonLive, ct));
			return events.Select(e => ToDto(e, culture)).ToList();
		});

	/// <summary>One event's details.</summary>
	[HttpGet($"events/{{eventSlug:{Slug}}}")]
	[ProducesResponseType<PretixEventDto>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public Task<IActionResult> GetEvent(string eventSlug, string? culture, CancellationToken ct) =>
		Proxy(async () => ToDto(await GetCachedEvent(eventSlug, ct), culture));

	/// <summary>Active products (ticket types) with prices.</summary>
	[HttpGet($"events/{{eventSlug:{Slug}}}/items")]
	[ProducesResponseType<IReadOnlyList<PretixItemDto>>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public Task<IActionResult> GetItems(string eventSlug, string? culture, CancellationToken ct) =>
		Proxy(async () =>
		{
			var currency = (await GetCachedEvent(eventSlug, ct)).Currency;
			var items = await Cached($"items:{Options.Organizer}:{eventSlug}",
				() => pretix.GetItemsAsync(Options.Organizer, eventSlug, ct));

			return items
				.OrderBy(i => i.Position ?? int.MaxValue)
				.Select(i => new PretixItemDto(
					i.Id,
					PretixText.Localize(i.Name, culture) ?? $"#{i.Id}",
					PretixText.Localize(i.Description, culture),
					i.DefaultPrice,
					currency,
					i.Admission,
					i.Variations
						.Where(v => v.Active)
						.Select(v => new PretixVariationDto(
							v.Id, PretixText.Localize(v.Value, culture) ?? $"#{v.Id}", v.Price ?? v.DefaultPrice ?? i.DefaultPrice))
						.ToList()))
				.ToList();
		});

	/// <summary>Quotas with live availability (cached like everything else).</summary>
	[HttpGet($"events/{{eventSlug:{Slug}}}/quotas")]
	[ProducesResponseType<IReadOnlyList<PretixQuotaDto>>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public Task<IActionResult> GetQuotas(string eventSlug, CancellationToken ct) =>
		Proxy(async () =>
		{
			var quotas = await Cached($"quotas:{Options.Organizer}:{eventSlug}",
				() => pretix.GetQuotasAsync(Options.Organizer, eventSlug, ct));
			return quotas
				.Select(q => new PretixQuotaDto(q.Id, q.Name, q.Size, q.Available, q.AvailableNumber, q.Items, q.Variations))
				.ToList();
		});

	private Task<PretixEvent> GetCachedEvent(string eventSlug, CancellationToken ct) =>
		Cached($"event:{Options.Organizer}:{eventSlug}", () => pretix.GetEventAsync(Options.Organizer, eventSlug, ct));

	/// <summary>
	/// Caches successful pretix responses only (a failed call throws and is not cached). Empty lists
	/// are kept for 30 seconds only, so changes made in pretix (going live, new events) show up quickly.
	/// </summary>
	private async Task<T> Cached<T>(string key, Func<Task<T>> load) =>
		(await cache.GetOrCreateAsync("pretix:" + key, async entry =>
		{
			var value = await load();
			entry.AbsoluteExpirationRelativeToNow = value is System.Collections.ICollection { Count: 0 }
				? EmptyResultCacheTime
				: TimeSpan.FromMinutes(Math.Max(1, Options.CacheMinutes));
			return value;
		}))!;

	private static readonly TimeSpan EmptyResultCacheTime = TimeSpan.FromSeconds(30);

	private PretixEventDto ToDto(PretixEvent e, string? culture) =>
		new(
			e.Slug,
			PretixText.Localize(e.Name, culture) ?? e.Slug,
			e.Live,
			e.Testmode,
			e.DateFrom,
			e.DateTo,
			e.DateAdmission,
			PretixText.Localize(e.Location, culture),
			e.Currency,
			e.HasSubevents,
			e.PresaleStart,
			e.PresaleEnd,
			// public_url points at the pretix server's own view of its URL; build it from
			// the browser URL instead so it also works behind Docker / a reverse proxy.
			$"{Options.BrowserRootUrl}{Uri.EscapeDataString(Options.Organizer)}/{Uri.EscapeDataString(e.Slug)}/");

	/// <summary>Runs a pretix call and maps its failures to proper HTTP status codes.</summary>
	private async Task<IActionResult> Proxy<T>(Func<Task<T>> call)
	{
		if (!Options.IsApiConfigured)
			return Problem("The pretix integration is not configured (Pretix:BaseUrl, ApiToken, Organizer).",
				statusCode: StatusCodes.Status503ServiceUnavailable);

		try
		{
			return Ok(await call());
		}
		catch (PretixApiException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
		{
			return Problem("Not found in pretix.", statusCode: StatusCodes.Status404NotFound);
		}
		catch (PretixApiException ex) when (ex.IsTimeout)
		{
			logger.LogWarning(ex, "pretix timed out");
			return Problem("pretix did not answer in time.", statusCode: StatusCodes.Status504GatewayTimeout);
		}
		catch (PretixApiException ex)
		{
			logger.LogWarning(ex, "pretix call failed");
			return Problem("The ticket system is not available right now.", statusCode: StatusCodes.Status502BadGateway);
		}
	}
}
