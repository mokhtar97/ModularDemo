// ModularDemo.Modules.Content/ContentModule.cs
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using ModularDemo.Modules.Content.Features;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Extensions;

namespace ModularDemo.Modules.Content;

/// <summary>
/// Content module: wraps Umbraco CMS and exposes its published content
/// (the Umbraco 17 replacement for the old v7 NodeApiController).
/// </summary>
public static class ContentModule
{
	/// <summary>Call on the Umbraco builder in the host's Program.cs.</summary>
	public static IUmbracoBuilder AddContentModule(this IUmbracoBuilder builder)
	{
		builder.Services.AddHttpContextAccessor();
		builder.Services.AddScoped<ContentNodeReader>();

		// Bridge Umbraco's own notifications onto the monolith's event bus.
		builder.AddNotificationAsyncHandler<ContentPublishedNotification, ContentPublishedRelay>();

		return builder;
	}

	public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/content").WithTags("Content");

		// old: /umbraco/api/nodeapi/getnodedata/1070
		group.MapGet("/nodes/{id:int}", (int id, int? depth, ContentNodeReader reader) =>
			ToResult(reader.GetById(id, depth)));

		group.MapGet("/nodes/{key:guid}", (Guid key, int? depth, ContentNodeReader reader) =>
			ToResult(reader.GetByKey(key, depth)));

		// old: /umbraco/api/nodeapi/getnodebyurl?url=/about
		group.MapGet("/by-url", (string url, int? depth, ContentNodeReader reader) =>
			ToResult(reader.GetByUrl(url, depth)));

		// old: /umbraco/api/nodeapi/getnodesbydocumenttypealias?documentTypeAlias=blogPost
		group.MapGet("/by-type/{contentTypeAlias}", (string contentTypeAlias, int? depth, ContentNodeReader reader) =>
			Results.Ok(reader.GetByContentType(contentTypeAlias, depth)));

		return app;
	}

	private static IResult ToResult(ContentNodeDto? node) =>
		node is null
			? Results.NotFound(new { message = "Node not found" })
			: Results.Ok(node);
}
