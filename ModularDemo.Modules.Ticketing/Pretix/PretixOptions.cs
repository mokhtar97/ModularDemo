// ModularDemo.Modules.Ticketing/Pretix/PretixOptions.cs
namespace ModularDemo.Modules.Ticketing.Pretix;

/// <summary>
/// The <c>"Pretix"</c> section of appsettings.json. <see cref="ApiToken"/> and
/// <see cref="WebhookSecret"/> are server-side only and are never sent to the browser.
/// </summary>
public sealed class PretixOptions
{
	/// <summary>Configuration section name.</summary>
	public const string SectionName = "Pretix";

	/// <summary>pretix root URL as the .NET host reaches it, e.g. <c>http://localhost:8345/</c>.</summary>
	public string BaseUrl { get; set; } = "";

	/// <summary>
	/// pretix root URL as visitors' browsers reach it (for the widget script and shop links).
	/// Leave empty to use <see cref="BaseUrl"/>; set it when they differ (Docker, reverse proxy).
	/// </summary>
	public string? PublicUrl { get; set; }

	/// <summary>API token (pretix: Organizer → Teams → a team → API tokens). Keep it out of source control.</summary>
	public string ApiToken { get; set; } = "";

	/// <summary>Organizer slug the API endpoints read from, e.g. <c>myorg</c>.</summary>
	public string Organizer { get; set; } = "";

	/// <summary>Shared secret pretix must send as <c>?secret=</c> on webhook calls. Empty disables the webhook.</summary>
	public string WebhookSecret { get; set; } = "";

	/// <summary>
	/// Also list events whose shop is not live yet (pretix "Shop disabled"), e.g. while testing.
	/// Visitors can only buy tickets once the shop is live; test mode is a separate switch.
	/// </summary>
	public bool IncludeNonLiveEvents { get; set; }

	/// <summary>Timeout for calls to the pretix API.</summary>
	public int TimeoutSeconds { get; set; } = 10;

	/// <summary>How long API responses are cached.</summary>
	public int CacheMinutes { get; set; } = 5;

	/// <summary>pretix widget version used in the widget URLs (<c>widget/v1.css</c>, <c>widget/v1.en.js</c>).</summary>
	public string WidgetVersion { get; set; } = "v1";

	/// <summary>Whether the API proxy can be used (base URL, token and organizer are set).</summary>
	public bool IsApiConfigured =>
		Uri.TryCreate(BaseUrl, UriKind.Absolute, out _) && ApiToken.Length > 0 && Organizer.Length > 0;

	/// <summary><see cref="BaseUrl"/> with a trailing slash.</summary>
	public string RootUrl => BaseUrl.TrimEnd('/') + "/";

	/// <summary>URL browsers use, with a trailing slash.</summary>
	public string BrowserRootUrl => (string.IsNullOrWhiteSpace(PublicUrl) ? BaseUrl : PublicUrl).TrimEnd('/') + "/";
}
