// ModularDemo.Shared/InMemoryEventBus.cs
using Microsoft.Extensions.DependencyInjection;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Shared;

public class InMemoryEventBus(IServiceProvider provider) : IEventBus
{
	public async Task Publish<TEvent>(TEvent @event, CancellationToken ct = default)
		where TEvent : IEvent
	{
		// Find every handler registered for this event type and invoke them.
		var handlers = provider.GetServices<IEventHandler<TEvent>>();
		foreach (var handler in handlers)
			await handler.Handle(@event, ct);
	}
}