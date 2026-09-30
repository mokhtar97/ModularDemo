// ModularDemo.Api/Program.cs
using ModularDemo.Modules.Content;
using ModularDemo.Modules.Orders;
using ModularDemo.Modules.Shipping;
using ModularDemo.Modules.Ticketing;
using ModularDemo.Shared;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Extensions;
using static ModularDemo.Shared.IEvent;

var builder = WebApplication.CreateBuilder(args);

// Shared infrastructure
builder.Services.AddScoped<IEventBus, InMemoryEventBus>();

// Each module registers itself — the host knows nothing about their internals
builder.Services.AddOrdersModule();
builder.Services.AddShippingModule();

// Umbraco CMS + the Content module that wraps it
builder.CreateUmbracoBuilder()
	.AddBackOffice()
	.AddWebsite()
	.AddDeliveryApi()
	.AddComposers()
	.AddContentModule()
	.AddTicketingModule() // pretix: /api/pretix proxy + webhook, event document types
	.Build();

var app = builder.Build();

await app.BootUmbracoAsync();

app.UseUmbraco()
	.WithMiddleware(u =>
	{
		u.UseBackOffice();
		u.UseWebsite();
	})
	.WithEndpoints(u =>
	{
		u.UseBackOfficeEndpoints();
		u.UseWebsiteEndpoints();
	});

// Module endpoints (explicit routes win over Umbraco's catch-all content route).
// The Content module uses an attribute-routed controller, which Umbraco's endpoint setup already maps.
app.MapOrdersEndpoints();

await app.RunAsync();
