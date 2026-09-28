import { ContentNode } from '../content/content.models';

export interface NavItem {
  label: string;
  /** Router path, e.g. "/" or "/about-zoo". */
  path: string;
}

/** A node of the site tree plus its Angular path relative to the site root ("" = home). */
export interface SitePageData {
  node: ContentNode;
  path: string;
}
