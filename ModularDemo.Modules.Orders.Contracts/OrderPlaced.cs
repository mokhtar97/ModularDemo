// ModularDemo.Modules.Orders/Contracts/OrderPlaced.cs
using ModularDemo.Shared;

namespace ModularDemo.Modules.Orders.Contracts;

public record OrderPlaced(Guid OrderId, Guid CustomerId, decimal Total) : IEvent;