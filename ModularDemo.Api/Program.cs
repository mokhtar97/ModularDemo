// ModularDemo.Api/Program.cs
using ModularDemo.Modules.Orders;
using ModularDemo.Modules.Shipping;
using ModularDemo.Shared;
using static ModularDemo.Shared.IEvent;

var builder = WebApplication.CreateBuilder(args);

// Shared infrastructure
builder.Services.AddScoped<IEventBus, InMemoryEventBus>();

// Each module registers itself — the host knows nothing about their internals
builder.Services.AddOrdersModule();
builder.Services.AddShippingModule();

var app = builder.Build();

app.MapOrdersEndpoints();

app.Run();