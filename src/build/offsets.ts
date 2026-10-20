// Parts that create binding points between whole positions (T046; FR-017, research R9).
// On Technic surfaces a 1 x 1 Technic brick with a hole (its hole on a stud center, half a stud
// from the long bricks' holes) makes a half-stud position; plates underneath raise it by plates.
// The exact arrangement is approximate until the physical prototype check (T051).
import { PLATE_1X1, TECHNIC_BRICK_1X1 } from '../catalog/candidates.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { ColorRef, PlacedPart, SurfaceTypeId } from '../types.ts';

const EPS = 1e-9;

function onGrid(v: number, period: number, phase: number): boolean {
  const r = (((v - phase) % period) + period) % period;
  return r < EPS || period - r < EPS;
}

/** True when (x, y) in local LBU is a whole (native) position of the surface. */
export function isNative(typeId: SurfaceTypeId, x: number, y: number): boolean {
  const t = SURFACE_TYPES[typeId];
  const xOk = onGrid(x, 10, t.nativeXPhase);
  return t.dimensions === 1 ? xOk : xOk && onGrid(y, t.nativeYPeriod, t.nativeYPhase);
}

/** Plates needed to raise an offset part from the row below to y (0 when y is on a row). */
export function platesBelow(typeId: SurfaceTypeId, y: number): number {
  const t = SURFACE_TYPES[typeId];
  if (t.dimensions === 1) return 0;
  const r = (((y - t.nativeYPhase) % t.nativeYPeriod) + t.nativeYPeriod) % t.nativeYPeriod;
  return Math.round(r / 4) % (t.nativeYPeriod / 4);
}

export function offsetParts(typeId: SurfaceTypeId, x: number, y: number, color: ColorRef): PlacedPart[] {
  const t = SURFACE_TYPES[typeId];
  if (t.offsetRule !== 'technic1x1' || isNative(typeId, x, y)) return [];
  const out: PlacedPart[] = [
    { part: TECHNIC_BRICK_1X1, kind: 'offset', x, y, z: 1, widthLbu: 10, heightLbu: 12, rotationDeg: 0, color },
  ];
  const plates = platesBelow(typeId, y);
  for (let q = 0; q < plates; q++) {
    out.push({ part: PLATE_1X1, kind: 'offset', x, y: y - 8 - 4 * q, z: 1, widthLbu: 10, heightLbu: 4, rotationDeg: 0, color });
  }
  return out;
}
