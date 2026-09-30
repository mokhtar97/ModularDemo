# Ticketing module (pretix)

Connects the Zoo site to a [pretix](https://pretix.eu) ticket shop.

| Part | Where |
|---|---|
| `event` / `events` document types | Created automatically on startup by `Migrations/TicketingMigrationPlan.cs` |
| REST proxy (token stays on the server) | `GET /api/pretix/...`, `Features/PretixController.cs` |
| Webhook receiver | `POST /api/pretix/webhook?secret=…`, `Features/PretixWebhookController.cs` |
| Business logic for paid/canceled orders | **Extension point** `Webhooks/IPretixOrderHandler.cs` |
| Angular widget, service, event list | `ModularDemo.Web/src/app/ticketing/` |

## Configuration

`ModularDemo.Api/appsettings.json`, section `"Pretix"`:

| Key | Example | Notes |
|---|---|---|
| `BaseUrl` | `http://localhost:8345/` | pretix root as the **.NET host** reaches it. The API is `{BaseUrl}api/v1/`. |
| `PublicUrl` | *(empty)* | pretix root as **browsers** reach it (widget script, shop links). Empty = `BaseUrl`. Set it when they differ (Docker, reverse proxy). |
| `ApiToken` | *(secret)* | pretix API token. **Never commit it**; see below. |
| `Organizer` | `myorg` | Organizer slug for the API endpoints, and the default for pages. |
| `WebhookSecret` | *(secret)* | Random string pretix sends as `?secret=`. Empty disables the webhook (503). |
| `IncludeNonLiveEvents` | `false` | `true` also lists events whose shop isn't live yet (shown with a "Not live" badge). Visitors can only buy once it's live. |
| `TimeoutSeconds` | `10` | Timeout for pretix API calls (→ 504). |
| `CacheMinutes` | `5` | Cache time for all proxied API responses. |
| `WidgetVersion` | `v1` | Used in `widget/v1.css` and `widget/v1.<lang>.js`. |

Keep the two secrets out of source control, for example with environment variables
(`Pretix__ApiToken`, `Pretix__WebhookSecret`) or an untracked `appsettings.Local.json`.
In IIS Express you can set them under the project's **Properties → Debug → Environment variables**.
The Angular app only ever receives `GET /api/pretix/settings` (public URL, organizer, widget version).

## Create the pretix API token

1. In pretix, open your organizer → **Teams**.
2. Pick or create a team with access to the events (or "All events") and at least the permission
   **Can view orders** (needed by the webhook to fetch orders). Event and product data are readable with any event access.
3. At the bottom of the team page, under **API tokens**, enter a name (e.g. "Umbraco") and click **Add**.
4. Copy the token (shown once) into `Pretix:ApiToken`.

## Create the webhook

1. In pretix, open your organizer → **Webhooks** → **Create a new webhook**.
2. **Target URL**: `https://<your-umbraco-host>/api/pretix/webhook?secret=<Pretix:WebhookSecret>`
   - Locally, pretix must be able to reach Umbraco:
     - pretix installed directly on your PC: `http://localhost:54583/api/pretix/webhook?secret=…`
       (54583 = the IIS Express HTTP port).
     - pretix in Docker: IIS Express only accepts `localhost`, so start the site with Kestrel on all
       interfaces (`dotnet run --project ModularDemo.Api --urls http://0.0.0.0:5141`) and use
       `http://host.docker.internal:5141/api/pretix/webhook?secret=…`.
3. Choose **All events** (or specific ones) and tick at least **Order marked as paid** and **Order canceled**.
4. Save. pretix shows every delivery and its response under the webhook's **Logs**.

The endpoint answers `200` immediately and queues the notification; a background worker fetches the
full order (`/orders/{code}/`), logs it and calls `IPretixOrderHandler`. Wrong secret → `401`.
Duplicate deliveries (same `notification_id`) are processed once.

### Adding business logic (e.g. Umbraco members)

Either implement the interface and register it **after** `.AddTicketingModule()` in `Program.cs`:

```csharp
builder.Services.AddScoped<IPretixOrderHandler, MemberTicketHandler>();
```

or keep the default handler and subscribe from another module to the events it publishes
(`TicketOrderPaid`, `TicketOrderCanceled` in `ModularDemo.Modules.Ticketing.Contracts`) with
`IEventHandler<TicketOrderPaid>`, the same way Shipping listens to `OrderPlaced`.

## API

All endpoints accept `?culture=` (e.g. `ar`, `en-US`) for pretix's translated texts.

| Endpoint | Returns |
|---|---|
| `GET /api/pretix/settings` | `{ baseUrl, organizer, widgetVersion }` for the widget |
| `GET /api/pretix/events` | Future events, soonest first (live only, unless `IncludeNonLiveEvents`) |
| `GET /api/pretix/events/{eventSlug}` | One event |
| `GET /api/pretix/events/{eventSlug}/items` | Active products with prices and variations |
| `GET /api/pretix/events/{eventSlug}/quotas` | Quotas with availability |

Results are cached for `CacheMinutes`; empty lists for 30 seconds only.

Errors: `404` not found in pretix · `502` pretix error or unreachable · `503` not configured · `504` timeout.

## Linking an Umbraco page to a pretix event (editors)

1. Under the home page, create an **Events** page (once). It lists all upcoming pretix events.
2. Under it, create an **Event** page per event and fill in:
   - **Page title**, **Description**, **Image** (per language)
   - **pretix event**: the event slug, the last part of the shop URL
     (`http://localhost:8345/myorg/`**`summer-2026`**`/`)
   - **pretix organizer**: leave empty to use the site default, or enter another organizer slug
   - **Show ticket shop**: on
3. **Save and publish** (in every language).

The event page shows the pretix shop under a "Tickets" heading. In the events list, an event that
has an Umbraco page links to it; other events link straight to the pretix shop.

## Angular

- `<app-pretix-widget event="summer-2026" />`: the inline shop. `organizer` is optional;
  `mode="button"` renders `<pretix-button>` (text via `label`, default dictionary item `Tickets.Buy`).
- The widget CSS/JS load only when a widget is shown, and only once per visit. The script language follows
  the site language on first load (Arabic → `v1.ar.js`, falling back to `v1.en.js`).
- `PretixService` calls the proxy; `<app-upcoming-events />` lists events on the `events` page.
- UI text comes from dictionary items `Tickets.*` (import `Zoo.Tickets.Dictionary.udt`).
