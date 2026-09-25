// ModularDemo.Modules.Orders/Features/PlaceOrder.cs
using ModularDemo.Modules.Orders.Contracts;
using ModularDemo.Shared;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Modules.Orders.Features;

internal record PlaceOrderRequest(Guid CustomerId, decimal Total);

internal class PlaceOrderHandler(IEventBus bus)
{
	public async Task<Guid> Handle(PlaceOrderRequest request, CancellationToken ct)
	{
		var orderId = Guid.NewGuid();

		// ... here you'd save the Order to the Orders DB (its own tables) ...

		// Announce it. Orders does NOT know who listens.
		await bus.Publish(new OrderPlaced(orderId, request.CustomerId, request.Total), ct);

		return orderId;
	}
}