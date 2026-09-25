# Content module (Umbraco 17)

Wraps Umbraco CMS inside the modular monolith. Replaces the old Umbraco 7 `NodeApiController`.

## Endpoints

| Old (Umbraco 7)                                                     | New                                          |
|---------------------------------------------------------------------|----------------------------------------------|
| `/umbraco/api/nodeapi/getnodedata/1070`                             | `GET /api/content/nodes/1070` (or `/nodes/{guid}`) |
| `/umbraco/api/nodeapi/getnodebyurl?url=/about`                      | `GET /api/content/by-url?url=/about`         |
| `/umbraco/api/nodeapi/getnodesbydocumenttypealias?documentTypeAlias=x` | `GET /api/content/by-type/x`              |

* `?depth=N` controls how many levels of children are returned (default 1, max 5; `by-type` defaults to 0).
* Missing nodes return **404** (the old API returned 200 with `Success=false`).
* Property values use the same JSON format as Umbraco's Delivery API.

Umbraco's built-in Delivery API is also on: `/umbraco/delivery/api/v2/content/...` (Swagger at `/umbraco/swagger`).

## Events

When an editor publishes a document, the module publishes `ContentPublished`
(from `ModularDemo.Modules.Content.Contracts`) on the shared event bus.
Other modules subscribe with `IEventHandler<ContentPublished>` and never reference Umbraco.
