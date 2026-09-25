/** URL builders for the Content module endpoints (proxied to the .NET host in dev). */
const base = '/api/content';

export const contentApi = {
  byUrl: (url: string, depth = 1) =>
    `${base}/by-url?url=${encodeURIComponent(url)}&depth=${depth}`,
  byId: (id: number | string, depth = 1) => `${base}/nodes/${id}?depth=${depth}`,
  byType: (contentTypeAlias: string, depth = 0) =>
    `${base}/by-type/${encodeURIComponent(contentTypeAlias)}?depth=${depth}`,
};
