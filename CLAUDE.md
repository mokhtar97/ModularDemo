# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A .NET 10 modular monolith demo hosting **Umbraco CMS 17** (`ModularDemo.Api`), plus an **Angular 22** frontend (`ModularDemo.Web`) that renders Umbraco content. The Umbraco project is a migration target for an old Umbraco 7 `NodeApiController` (see `ModularDemo.Modules.Content/README.md` for the old→new endpoint mapping).

## Commands

Backend (run from repo root; solution file is `ModularDemo.slnx`):
```bash
dotnet build ModularDemo.slnx
dotnet run --project ModularDemo.Api            # http://localhost:5141 (launch profile "http")
dotnet run --project ModularDemo.Api -lp https  # https://localhost:7005
```
There are no .NET test projects.

Frontend (from `ModularDemo.Web/`, Node 22.22.3+ or 24.15+):
```bash
npm install
npm start                                   # ng serve → http://localhost:4200
npm run build
npm test                                    # Vitest via @angular/build:unit-test
npx ng test --include src/app/app.spec.ts   # single spec file
```
Formatting uses Prettier (`.prettierrc`).

**Port gotcha:** `ModularDemo.Web/proxy.conf.json` forwards `/api` and `/media` to `https://localhost:44366`, which is the **IIS Express** profile, not the `dotnet run` ports. If running via `dotnet run`, adjust the proxy target (or run under IIS Express from Visual Studio).

## Database / Umbraco setup

- `appsettings.json` points `umbracoDbDSN` at SQL Server LocalDB (`(localdb)\MSSQLLocalDB`, database `ModularDemoUmbraco`).
- `appsettings.Development.json` enables unattended install (admin: `admin@example.com` / `ChangeMe1234!`), so the first Development run creates the schema automatically.
- ModelsBuilder runs in `InMemoryAuto` mode, which is why Razor compile-on-build/publish is disabled in `ModularDemo.Api.csproj`.
- Delivery API is enabled with public access (`/umbraco/delivery/api/v2/...`, Swagger at `/umbraco/swagger`); backoffice at `/umbraco`.
- `ModularDemo.Api/umbraco/Data/` (SQLite DB, Examine indexes, locks) and `_backup_before_umbraco/` are committed artifacts — don't edit them by hand.

## Architecture

**Host** (`ModularDemo.Api/Program.cs`) only composes modules: it registers the shared `IEventBus`, calls each module's `Add*Module()` extension, builds Umbraco (with `.AddContentModule()` on the Umbraco builder), then calls `Map*Endpoints()` (Content uses a controller instead). Module endpoints are mapped *after* Umbraco so explicit routes win over Umbraco's catch-all content route.

**Module pattern** — each module is a class library exposing a static `XxxModule` class with `AddXxxModule` (DI) and optionally `MapXxxEndpoints` (minimal APIs) or a public attribute-routed controller. Everything else in the module is `internal`. Public cross-module types live in a separate `*.Contracts` project containing only event records.

**Inter-module communication** is via events only:
- `ModularDemo.Shared/IEvent.cs` defines `IEvent`, with `IEventHandler<T>` and `IEventBus` **nested inside** it — hence the `using static ModularDemo.Shared.IEvent;` seen everywhere.
- `InMemoryEventBus` (scoped) resolves all `IEventHandler<TEvent>` from DI and awaits them sequentially, in-process.
- Example flow: `POST /orders` → `PlaceOrderHandler` publishes `OrderPlaced` (Orders.Contracts) → Shipping's `OrderPlacedHandler`, registered in `ShippingModule` as `IEventHandler<OrderPlaced>`.
- A subscribing module should reference only the publisher's `.Contracts` project (note: Shipping currently also references the Orders project itself).

**Content module** (`ModularDemo.Modules.Content`) wraps Umbraco:
- References `Umbraco.Cms.Core` + `Umbraco.Cms.Infrastructure` (keep versions in step with the host); the full `Umbraco.Cms` package lives in the host.
- `Features/ContentController.cs` is an attribute-routed MVC controller (`[Route("api/content")]`) that queries published content via `IPublishedContentQuery` (from `Umbraco.Cms.Infrastructure`; it has no route or children API, so `IDocumentUrlService` resolves URLs to keys and the navigation-based `Children()`/`DescendantsOrSelfOfType()` extensions walk the tree). `ContentNodeMapper` maps to the DTOs in `Features/ContentNodeDto.cs` without the Delivery API; property values go through its recursive `ConvertValue` switch (picked items become `ContentLinkDto` references, never full nodes). Children are opt-in via `?depth=` (default 0 → `children: null`, max 5). Missing nodes → 404. Controller, mapper and DTOs are `public` only because MVC discovers public controllers only.
- Don't call `MapControllers()` in the host: Umbraco's `UseBackOfficeEndpoints` already maps attribute-routed controllers, and `AddContentModule` adds the module assembly as an MVC application part.
- Endpoints under `/api/content`: `nodes/{id:int}`, `nodes/{key:guid}`, `by-url?url=`, `by-type/{alias}`.
- `ContentPublishedRelay` bridges Umbraco's `ContentPublishedNotification` onto the event bus as `ContentPublished` (Content.Contracts), creating its own DI scope (Umbraco handlers are transient, bus is scoped) and swallowing/logging handler failures so a subscriber can't break an editor's publish. Other modules should subscribe to `ContentPublished`, never to Umbraco types.

**Frontend** (`ModularDemo.Web`): standalone components with signals and new control flow. The site is one Umbraco subtree: `site/site.config.ts` holds `SITE_ROOT_KEY` ("Home Page Zoo") and `SITE_TREE_DEPTH`. `SiteService` loads that root **by key** once (not `by-url?url=/`, which resolves to a different root node, "welcome home") and indexes every descendant by its path relative to the root's URL. Umbraco's `HideTopLevelNodeFromPath` means children of this root have URLs like `/about-zoo/`, *not* `/home-page-zoo/about-zoo/`, so the root prefix is only stripped when present. The only route is `**` → `SitePage`, which resolves the router URL via `SiteService.findByPath` (no per-page HTTP call) and renders `pageTitle`/`heroText` as the hero plus other string properties through `PropertyValue`. `PropertyValue` renders by value shape (HTML strings, `ContentLink` refs, `Link`s, blocks, JSON fallback). `ContentNode` in `content/content.models.ts` must mirror `ContentNodeDto`; `content/content.api.ts` has URL builders plus `ContentService` for all four endpoints. Theme colors are CSS variables in `src/styles.scss`.
