// ModularDemo.Modules.Shipping/OrderPlacedHandler.cs
using ModularDemo.Modules.Orders.Contracts;
using ModularDemo.Shared;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Modules.Shipping;

internal class OrderPlacedHandler : IEventHandler<OrderPlaced>
{
	public Task Handle(OrderPlaced @event, CancellationToken ct)
	{
		// ... schedule a pickup, write to Shipping's own tables, etc. ...
		Console.WriteLine(
			$"[Shipping] Scheduling pickup for order {@event.OrderId}, total {@event.Total:C}");
		return Task.CompletedTask;
	}
}