# ModularDemo.Web (Angular 22)

Frontend that renders Umbraco content served by the monolith's **Content module** (`/api/content/...`).

## Run

1. Start the .NET host (`ModularDemo.Api`, IIS Express → https://localhost:44366).
2. In this folder:
   ```bash
   npm install
   npm start        # http://localhost:4200
   ```
   `proxy.conf.json` forwards `/api` and `/media` to the .NET host, so no CORS setup is needed in dev.

## How it works

* Every URL is handled by `ContentPage` (`src/app/content/content-page.ts`), which calls
  `GET /api/content/by-url?url=<current path>&depth=1` and renders the node.
* The top navigation is the home node (`/`) and its children.
* `PropertyValue` renders each property by shape: text, rich text (`{ markup }`), media (`[{ url }]`),
  content links (`{ route: { path } }`), lists, or raw JSON as a fallback.
* To build a dedicated view for a document type, branch on `node.contentType` in `content-page.ts`.

Requires Node.js 22.22.3+ or 24.15+.
