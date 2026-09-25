// ModularDemo.Modules.Content/Features/ContentPublishedRelay.cs
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ModularDemo.Modules.Content.Contracts;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using static ModularDemo.Shared.IEvent;

namespace ModularDemo.Modules.Content.Features;

/// <summary>
/// Translates Umbraco's ContentPublishedNotification into the monolith's own
/// ContentPublished event, so other modules never depend on Umbraco types.
/// </summary>
internal sealed class ContentPublishedRelay(
	IServiceScopeFactory scopeFactory,
	ILogger<ContentPublishedRelay> logger) : INotificationAsyncHandler<ContentPublishedNotification>
{
	public async Task HandleAsync(ContentPublishedNotification notification, CancellationToken cancellationToken)
	{
		// Umbraco handlers are transient; use our own scope for the scoped event bus.
		await using var scope = scopeFactory.CreateAsyncScope();
		var bus = scope.ServiceProvider.GetRequiredService<IEventBus>();

		foreach (var content in notification.PublishedEntities)
		{
			try
			{
				await bus.Publish(
					new ContentPublished(content.Key, content.Id, content.Name ?? string.Empty, content.ContentType.Alias),
					cancellationToken);
			}
			catch (Exception ex)
			{
				// Never let a subscriber break the editor's publish.
				logger.LogError(ex, "ContentPublished handler failed for {ContentKey}", content.Key);
			}
		}
	}
}
