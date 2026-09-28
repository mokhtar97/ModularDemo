// ModularDemo.Modules.Content/ContentModule.cs
using Microsoft.Extensions.DependencyInjection;
using ModularDemo.Modules.Content.Features;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Extensions;

namespace ModularDemo.Modules.Content;

/// <summary>
/// Content module: wraps Umbraco CMS and exposes its published content
/// through <see cref="ContentController"/> (the Umbraco 17 replacement for the old v7 NodeApiController).
/// </summary>
public static class ContentModule
{
	/// <summary>Call on the Umbraco builder in the host's Program.cs.</summary>
	public static IUmbracoBuilder AddContentModule(this IUmbracoBuilder builder)
	{
		builder.Services.AddScoped<ContentNodeMapper>();
		builder.Services.AddScoped<CultureContext>();

		// Make sure MVC discovers ContentController in this class library. Umbraco already maps
		// attribute-routed controllers (MapControllers) in UseBackOfficeEndpoints, so the host
		// must NOT call MapControllers again — that would register every route twice.
		builder.Services.AddControllers().AddApplicationPart(typeof(ContentController).Assembly);

		// Bridge Umbraco's own notifications onto the monolith's event bus.
		builder.AddNotificationAsyncHandler<ContentPublishedNotification, ContentPublishedRelay>();

		return builder;
	}
}
