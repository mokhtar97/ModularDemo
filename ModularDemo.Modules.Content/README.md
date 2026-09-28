# Content module (Umbraco 17)

Wraps Umbraco CMS inside the modular monolith. Replaces the old Umbraco 7 `NodeApiController`.

## Endpoints

| Old (Umbraco 7)                                                     | New                                          |
|---------------------------------------------------------------------|----------------------------------------------|
| `/umbraco/api/nodeapi/getnodedata/1070`                             | `GET /api/content/nodes/1070` (or `/nodes/{guid}`) |
| `/umbraco/api/nodeapi/getnodebyurl?url=/about`                      | `GET /api/content/by-url?url=/about`         |
| `/umbraco/api/nodeapi/getnodesbydocumenttypealias?documentTypeAlias=x` | `GET /api/content/by-type/x`              |

* `?depth=N` controls how many levels of children are returned (default 0 = `children: null`, max 5).
* Missing nodes return **404** (the old API returned 200 with `Success=false`).
* Everything is read from the published content cache (`IPublishedContent`) and mapped to DTOs:
  rich text → HTML string, picked content/media → `{ id, key, name, contentType, url }`,
  multi URL picker → `{ name, url, target, type }`, block list → `[{ content, settings }]`,
  block grid → `[{ content, settings, rowSpan, columnSpan, areas }]`, elements → `{ contentType, key, properties }`.

Umbraco's built-in Delivery API is also on: `/umbraco/delivery/api/v2/content/...` (Swagger at `/umbraco/swagger`).

## Events

When an editor publishes a document, the module publishes `ContentPublished`
(from `ModularDemo.Modules.Content.Contracts`) on the shared event bus.
Other modules subscribe with `IEventHandler<ContentPublished>` and never reference Umbraco.
