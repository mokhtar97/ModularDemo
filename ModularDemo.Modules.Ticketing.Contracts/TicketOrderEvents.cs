// ModularDemo.Modules.Ticketing.Contracts/TicketOrderEvents.cs
using ModularDemo.Shared;

namespace ModularDemo.Modules.Ticketing.Contracts;

/// <summary>
/// Raised when pretix reports that a ticket order was paid (webhook <c>pretix.event.order.paid</c>).
/// Other modules can react to it without referencing pretix or the Ticketing module.
/// </summary>
public record TicketOrderPaid(
	string Organizer,
	string Event,
	string OrderCode,
	string? Email,
	decimal Total,
	int TicketCount) : IEvent;

/// <summary>Raised when pretix reports that a ticket order was canceled (<c>pretix.event.order.canceled</c>).</summary>
public record TicketOrderCanceled(
	string Organizer,
	string Event,
	string OrderCode,
	string? Email) : IEvent;
