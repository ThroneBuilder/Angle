// Parts catalog lookups (T041; FR-022, Constitution IV). The catalog lists only parts and colors
// LEGO currently produces, from a dated Rebrickable snapshot.
import type { Catalog, CatalogColor, CatalogPart, ColorRef, PartRef } from '../types.ts';
import snapshot from './lego-angle-2026-10-19.json';

export const CATALOG: Catalog = snapshot as Catalog;

export function part(catalog: Catalog, no: PartRef): CatalogPart | null {
  return catalog.parts[no] ?? null;
}

export function color(catalog: Catalog, id: ColorRef): CatalogColor | null {
  return catalog.colors[String(id)] ?? null;
}

export function isCurrent(catalog: Catalog, no: PartRef, colorId: ColorRef): boolean {
  return part(catalog, no)?.colors.includes(colorId) ?? false;
}

/**
 * The preferred color if the part is current in it; otherwise the part's first current color by
 * name. Returns the preferred color unchanged when the part is not in the catalog at all, so the
 * build can report the part instead of silently recoloring it.
 */
export function colorFor(catalog: Catalog, no: PartRef, preferred: ColorRef): ColorRef {
  const p = part(catalog, no);
  if (!p || p.colors.length === 0 || p.colors.includes(preferred)) return preferred;
  const byName = [...p.colors].sort((a, b) =>
    (color(catalog, a)?.name ?? '').localeCompare(color(catalog, b)?.name ?? ''),
  );
  return byName[0]!;
}
