// ModularDemo.Modules.Ticketing/Migrations/TicketingMigrationPlan.cs
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Core.Packaging;

namespace ModularDemo.Modules.Ticketing.Migrations;

/// <summary>
/// Umbraco package migration plan for the Ticketing module. Umbraco discovers it automatically
/// and runs pending steps once at startup (unattended package migrations are on by default);
/// progress is stored in the database, so each step runs once per environment.
/// </summary>
public sealed class TicketingMigrationPlan : PackageMigrationPlan
{
	/// <summary>Creates the plan.</summary>
	public TicketingMigrationPlan() : base("ModularDemo.Ticketing") { }

	/// <inheritdoc />
	protected override void DefinePlan() =>
		To<AddEventDocumentTypes>(new Guid("5b0c7a51-3f7e-4d4c-9f0a-0d6f5f8e2a11"));
}

/// <summary>
/// Creates the <c>events</c> (list page) and <c>event</c> document types and allows
/// <c>events</c> under <c>home</c>. Existing types with those aliases are left untouched.
/// </summary>
public sealed class AddEventDocumentTypes(
	IMigrationContext context,
	IContentTypeService contentTypes,
	IDataTypeService dataTypes,
	IShortStringHelper shortStrings,
	ILogger<AddEventDocumentTypes> logger) : AsyncMigrationBase(context)
{
	/// <summary>Document type alias of an event page.</summary>
	public const string EventAlias = "event";

	/// <summary>Document type alias of the events list page.</summary>
	public const string EventsAlias = "events";

	/// <summary>Document type alias of the site's home page (gets <c>events</c> as an allowed child).</summary>
	public const string HomeAlias = "home";

	/// <inheritdoc />
	protected override async Task MigrateAsync()
	{
		var textstring = await DataType(Constants.DataTypes.Guids.TextstringGuid);
		var textarea = await DataType(Constants.DataTypes.Guids.TextareaGuid);
		var toggle = await DataType(Constants.DataTypes.Guids.CheckboxGuid);
		var image = await DataType(Constants.DataTypes.Guids.MediaPicker3SingleImageGuid);

		var eventType = contentTypes.Get(EventAlias);
		if (eventType is null)
		{
			eventType = NewType(EventAlias, "Event", "icon-calendar", "A page for one pretix event with its ticket shop.");
			Add(eventType, "content", "Content", textstring, "pageTitle", "Page title", culture: true, sort: 0);
			Add(eventType, "content", "Content", textarea, "description", "Description", culture: true, sort: 1);
			Add(eventType, "content", "Content", image, "image", "Image", culture: false, sort: 2);
			Add(eventType, "tickets", "Tickets", textstring, "pretixOrganizer", "pretix organizer",
				culture: false, sort: 0, description: "Organizer slug in pretix. Leave empty to use the site default (Pretix:Organizer).");
			Add(eventType, "tickets", "Tickets", textstring, "pretixEvent", "pretix event",
				culture: false, sort: 1, description: "Event slug in pretix, e.g. \"summer-2026\" from …/myorg/summer-2026/.");
			Add(eventType, "tickets", "Tickets", toggle, "showTicketShop", "Show ticket shop",
				culture: false, sort: 2, description: "Show the pretix ticket shop on this page.");
			await Save(eventType, create: true);
		}
		else
			logger.LogInformation("Document type '{Alias}' already exists; not changed", EventAlias);

		var eventsType = contentTypes.Get(EventsAlias);
		if (eventsType is null)
		{
			eventsType = NewType(EventsAlias, "Events", "icon-calendar-alt", "Lists upcoming pretix events; event pages go below it.");
			Add(eventsType, "content", "Content", textstring, "pageTitle", "Page title", culture: true, sort: 0);
			Add(eventsType, "content", "Content", textarea, "description", "Description", culture: true, sort: 1);
			eventsType.AllowedContentTypes = [new ContentTypeSort(eventType.Key, 0, eventType.Alias)];
			await Save(eventsType, create: true);
		}
		else
			logger.LogInformation("Document type '{Alias}' already exists; not changed", EventsAlias);

		// Let editors create an Events page under the home page.
		var home = contentTypes.Get(HomeAlias);
		if (home is null)
		{
			logger.LogWarning("Document type '{Alias}' not found; allow '{Events}' under your home page manually",
				HomeAlias, EventsAlias);
			return;
		}

		var allowed = (home.AllowedContentTypes ?? []).ToList();
		if (allowed.All(a => a.Key != eventsType.Key))
		{
			allowed.Add(new ContentTypeSort(eventsType.Key, allowed.Count, eventsType.Alias));
			home.AllowedContentTypes = allowed;
			await Save(home, create: false);
		}
	}

	private ContentType NewType(string alias, string name, string icon, string description) =>
		new(shortStrings, -1)
		{
			Alias = alias,
			Name = name,
			Icon = icon,
			Description = description,
			AllowedAsRoot = false,
			Variations = ContentVariation.Culture, // same as the site's other pages (en-US + ar)
		};

	private void Add(IContentType type, string groupAlias, string groupName, IDataType dataType,
		string alias, string name, bool culture, int sort, string? description = null)
	{
		var property = new PropertyType(shortStrings, dataType, alias)
		{
			Name = name,
			Description = description,
			SortOrder = sort,
			Variations = culture ? ContentVariation.Culture : ContentVariation.Nothing,
		};
		type.AddPropertyType(property, groupAlias, groupName);
	}

	private async Task<IDataType> DataType(Guid key) =>
		await dataTypes.GetAsync(key)
		?? throw new InvalidOperationException($"Built-in Umbraco data type {key} is missing");

	private async Task Save(IContentType type, bool create)
	{
		var result = create
			? await contentTypes.CreateAsync(type, Constants.Security.SuperUserKey)
			: await contentTypes.UpdateAsync(type, Constants.Security.SuperUserKey);
		if (!result.Success)
			throw new InvalidOperationException($"Could not save document type '{type.Alias}': {result.Result}");
		logger.LogInformation("Document type '{Alias}' {Action}", type.Alias, create ? "created" : "updated");
	}
}
