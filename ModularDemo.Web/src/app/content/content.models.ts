/** Shape returned by the monolith's Content module (/api/content/...). */
export interface ContentNode {
  id: number;
  key: string;
  name: string;
  contentType: string;
  level: number;
  sortOrder: number;
  templateId: number | null;
  url: string;
  absoluteUrl: string | null;
  createDate: string;
  updateDate: string;
  /** Values use the Umbraco Delivery API format (rich text = { markup }, media = [{ url, ... }], ...). */
  properties: Record<string, unknown>;
  children: ContentNode[];
}
