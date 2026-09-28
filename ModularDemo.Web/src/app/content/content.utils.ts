import { KeyValue } from '@angular/common';

export function hasValue(v: unknown): boolean {
  return !(v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0));
}

/** "bodyText" -> "Body text" */
export function label(alias: string): string {
  const words = alias.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Comparator for the keyvalue pipe that keeps Umbraco's property order. */
export const keepOrder = (_a: KeyValue<string, unknown>, _b: KeyValue<string, unknown>) => 0;
