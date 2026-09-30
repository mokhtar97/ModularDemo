// ModularDemo.Modules.Ticketing/Webhooks/PretixWebhookQueue.cs
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModularDemo.Modules.Ticketing.Pretix;

namespace ModularDemo.Modules.Ticketing.Webhooks;

/// <summary>The body pretix POSTs to the webhook URL.</summary>
public sealed record PretixWebhookPayload(
	[property: JsonPropertyName("notification_id")] long NotificationId,
	[property: JsonPropertyName("organizer")] string Organizer,
	[property: JsonPropertyName("event")] string Event,
	[property: JsonPropertyName("code")] string? Code,
	[property: JsonPropertyName("action")] string Action);

/// <summary>
/// In-memory queue between the webhook endpoint and <see cref="PretixWebhookProcessor"/>, so the
/// endpoint can answer 200 immediately. Bounded: when full, the endpoint answers 503 and pretix retries.
/// </summary>
public sealed class PretixWebhookQueue
{
	private readonly Channel<PretixWebhookPayload> _channel =
		Channel.CreateBounded<PretixWebhookPayload>(new BoundedChannelOptions(1000) { SingleReader = true });

	/// <summary>Queues a notification; false when the queue is full.</summary>
	public bool TryEnqueue(PretixWebhookPayload payload) => _channel.Writer.TryWrite(payload);

	internal IAsyncEnumerable<PretixWebhookPayload> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

/// <summary>
/// Background worker: for order paid/canceled notifications, fetches the full order from pretix,
/// logs it and calls <see cref="IPretixOrderHandler"/>. Other actions are ignored.
/// </summary>
public sealed class PretixWebhookProcessor(
	PretixWebhookQueue queue,
	IServiceScopeFactory scopeFactory,
	IMemoryCache cache,
	ILogger<PretixWebhookProcessor> logger) : BackgroundService
{
	/// <summary>Webhook action for a paid order.</summary>
	public const string OrderPaid = "pretix.event.order.paid";

	/// <summary>Webhook action for a canceled order.</summary>
	public const string OrderCanceled = "pretix.event.order.canceled";

	/// <inheritdoc />
	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		await foreach (var payload in queue.ReadAllAsync(stoppingToken))
		{
			try
			{
				await ProcessAsync(payload, stoppingToken);
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				break;
			}
			catch (Exception ex)
			{
				logger.LogError(ex, "Processing pretix webhook {NotificationId} ({Action}, order {Code}) failed",
					payload.NotificationId, payload.Action, payload.Code);
			}
		}
	}

	private async Task ProcessAsync(PretixWebhookPayload payload, CancellationToken ct)
	{
		if (payload.Action is not (OrderPaid or OrderCanceled) || string.IsNullOrEmpty(payload.Code))
		{
			logger.LogDebug("Ignoring pretix webhook {Action}", payload.Action);
			return;
		}

		// pretix may deliver the same notification more than once (retries); handle it once.
		if (!cache.TryGetValue($"pretix:webhook:{payload.NotificationId}", out _))
			cache.Set($"pretix:webhook:{payload.NotificationId}", true, TimeSpan.FromHours(24));
		else
		{
			logger.LogInformation("Skipping duplicate pretix webhook {NotificationId}", payload.NotificationId);
			return;
		}

		await using var scope = scopeFactory.CreateAsyncScope();
		var pretix = scope.ServiceProvider.GetRequiredService<PretixClient>();
		var handler = scope.ServiceProvider.GetRequiredService<IPretixOrderHandler>();

		var (order, raw) = await pretix.GetOrderAsync(payload.Organizer, payload.Event, payload.Code, ct);
		var notification = new PretixOrderNotification(
			payload.NotificationId,
			payload.Action,
			payload.Organizer,
			payload.Event,
			new PretixOrderSummary(order.Code, order.Status, order.Email, order.Total, order.Datetime, order.Positions.Count),
			raw);

		logger.LogInformation(
			"pretix webhook {Action}: order {Code} ({Organizer}/{Event}) status {Status}, total {Total}, {Positions} position(s)",
			payload.Action, order.Code, payload.Organizer, payload.Event, order.Status, order.Total, order.Positions.Count);

		if (payload.Action == OrderPaid) await handler.OrderPaidAsync(notification, ct);
		else await handler.OrderCanceledAsync(notification, ct);
	}
}
