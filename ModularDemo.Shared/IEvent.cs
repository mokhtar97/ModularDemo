
namespace ModularDemo.Shared
{
	public interface IEvent
	{
		public interface IEventHandler<in TEvent> where TEvent : IEvent
		{
			Task Handle(TEvent @event, CancellationToken ct);
		}

		public interface IEventBus
		{
			Task Publish<TEvent>(TEvent @event, CancellationToken ct = default)
				where TEvent : IEvent;
		}
	}
}
