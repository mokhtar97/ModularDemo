// ModularDemo.Modules.Shipping/ShippingModule.cs
using Microsoft.Extensions.DependencyInjection;
using ModularDemo.Modules.Orders.Contracts;
using ModularDemo.Shared;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Modules.Shipping;

public static class ShippingModule
{
	public static IServiceCollection AddShippingModule(this IServiceCollection services)
	{
		// Register this module's handler against the OrderPlaced event.
		services.AddScoped<IEventHandler<Orders.Contracts.OrderPlaced>, OrderPlacedHandler>();
		return services;
	}
}