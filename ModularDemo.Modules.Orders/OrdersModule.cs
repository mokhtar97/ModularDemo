// ModularDemo.Modules.Orders/OrdersModule.cs
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using ModularDemo.Modules.Orders.Features;

namespace ModularDemo.Modules.Orders;

public static class OrdersModule
{
	public static IServiceCollection AddOrdersModule(this IServiceCollection services)
	{
		services.AddScoped<PlaceOrderHandler>();
		return services;
	}

	public static IEndpointRouteBuilder MapOrdersEndpoints(this IEndpointRouteBuilder app)
	{
		app.MapPost("/orders", async (
			PlaceOrderRequest request, PlaceOrderHandler handler, CancellationToken ct) =>
		{
			var id = await handler.Handle(request, ct);
			return Results.Ok(new { orderId = id });
		});
		return app;
	}
}