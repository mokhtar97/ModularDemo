// ModularDemo.Modules.Ticketing/Webhooks/IPretixOrderHandler.cs
using System.Text.Json;
using Microsoft.Extensions.Logging;
using ModularDemo.Modules.Ticketing.Contracts;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Modules.Ticketing.Webhooks;

// ============================================================================================
//  EXTENSION POINT: business logic for paid / canceled pretix orders.
//
//  Implement IPretixOrderHandler (e.g. to create or update Umbraco members) and register it in
//  Program.cs AFTER .AddTicketingModule(), so it replaces the default:
//
//      builder.Services.AddScoped<IPretixOrderHandler, MemberTicketHandler>();
//
//  Or keep the default and subscribe from another module to the TicketOrderPaid /
//  TicketOrderCanceled events (ModularDemo.Modules.Ticketing.Contracts) via IEventHandler<T>.
//
//  Handlers run in the background (a new DI scope per notification), never on the webhook
//  request, so they may take their time. Exceptions are logged and do not stop later notifications.
// ============================================================================================

/// <summary>Business logic run for pretix order webhooks, after the full order has been fetched.</summary>
public interface IPretixOrderHandler
{
	/// <summary>Called for <c>pretix.event.order.paid</c>.</summary>
	Task OrderPaidAsync(PretixOrderNotification notification, CancellationToken ct);

	/// <summary>Called for <c>pretix.event.order.canceled</c>.</summary>
	Task OrderCanceledAsync(PretixOrderNotification notification, CancellationToken ct);
}

/// <summary>A webhook notification together with the full order fetched from the pretix API.</summary>
/// <param name="NotificationId">pretix notification id (unique per delivery attempt group).</param>
/// <param name="Action">Webhook action, e.g. <c>pretix.event.order.paid</c>.</param>
/// <param name="Organizer">Organizer slug.</param>
/// <param name="Event">Event slug.</param>
/// <param name="Order">Order summary.</param>
/// <param name="RawOrder">The complete order JSON from pretix, for anything not in <see cref="Order"/>.</param>
public sealed record PretixOrderNotification(
	long NotificationId,
	string Action,
	string Organizer,
	string Event,
	PretixOrderSummary Order,
	JsonElement RawOrder);

/// <summary>The order fields most handlers need. Status: n = pending, p = paid, e = expired, c = canceled.</summary>
public sealed record PretixOrderSummary(
	string Code,
	string Status,
	string? Email,
	decimal Total,
	DateTimeOffset? CreatedAt,
	int PositionCount);

/// <summary>
/// Default handler: logs the order and publishes <see cref="TicketOrderPaid"/> /
/// <see cref="TicketOrderCanceled"/> on the monolith's event bus.
/// </summary>
public sealed class DefaultPretixOrderHandler(IEventBus bus, ILogger<DefaultPretixOrderHandler> logger) : IPretixOrderHandler
{
	/// <inheritdoc />
	public async Task OrderPaidAsync(PretixOrderNotification n, CancellationToken ct)
	{
		logger.LogInformation(
			"pretix order {Code} PAID: {Organizer}/{Event}, {Tickets} position(s), total {Total}, email {Email}",
			n.Order.Code, n.Organizer, n.Event, n.Order.PositionCount, n.Order.Total, n.Order.Email);

		await bus.Publish(
			new TicketOrderPaid(n.Organizer, n.Event, n.Order.Code, n.Order.Email, n.Order.Total, n.Order.PositionCount), ct);
	}

	/// <inheritdoc />
	public async Task OrderCanceledAsync(PretixOrderNotification n, CancellationToken ct)
	{
		logger.LogInformation(
			"pretix order {Code} CANCELED: {Organizer}/{Event}, email {Email}",
			n.Order.Code, n.Organizer, n.Event, n.Order.Email);

		await bus.Publish(new TicketOrderCanceled(n.Organizer, n.Event, n.Order.Code, n.Order.Email), ct);
	}
}
