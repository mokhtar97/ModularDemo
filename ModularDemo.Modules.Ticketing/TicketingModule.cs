// ModularDemo.Modules.Ticketing/TicketingModule.cs
using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using ModularDemo.Modules.Ticketing.Features;
using ModularDemo.Modules.Ticketing.Pretix;
using ModularDemo.Modules.Ticketing.Webhooks;
using Umbraco.Cms.Core.DependencyInjection;

namespace ModularDemo.Modules.Ticketing;

/// <summary>
/// Ticketing module: pretix integration. Exposes <c>/api/pretix/...</c> (a read-only proxy for the
/// pretix REST API, so the token stays on the server) and <c>/api/pretix/webhook</c>, and creates
/// the <c>events</c>/<c>event</c> document types through <see cref="Migrations.TicketingMigrationPlan"/>.
/// </summary>
public static class TicketingModule
{
	/// <summary>Call on the Umbraco builder in the host's Program.cs.</summary>
	public static IUmbracoBuilder AddTicketingModule(this IUmbracoBuilder builder)
	{
		var services = builder.Services;

		services.AddOptions<PretixOptions>().Bind(builder.Config.GetSection(PretixOptions.SectionName));
		services.AddMemoryCache();

		// Typed client: base address, token header and timeout come from the "Pretix" settings.
		services.AddHttpClient<PretixClient>(PretixClient.HttpClientName, (sp, http) =>
		{
			var options = sp.GetRequiredService<IOptions<PretixOptions>>().Value;
			if (Uri.TryCreate(options.RootUrl + "api/v1/", UriKind.Absolute, out var baseAddress))
				http.BaseAddress = baseAddress;
			if (options.ApiToken.Length > 0)
				http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Token", options.ApiToken);
			http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
			http.Timeout = TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 1, 120));
		});

		// Webhooks: queue + background worker. IPretixOrderHandler is the extension point —
		// register your own implementation after AddTicketingModule() to replace the default.
		services.AddSingleton<PretixWebhookQueue>();
		services.AddHostedService<PretixWebhookProcessor>();
		services.AddScoped<IPretixOrderHandler, DefaultPretixOrderHandler>();

		// Same as the Content module: Umbraco's UseBackOfficeEndpoints already maps attribute-routed
		// controllers, so only make sure MVC discovers the ones in this class library.
		services.AddControllers().AddApplicationPart(typeof(PretixController).Assembly);

		return builder;
	}
}
