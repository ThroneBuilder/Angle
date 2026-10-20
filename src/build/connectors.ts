// The part at every connection (T046; FR-020a, research R8). A stud surface underneath gets a
// one-plate riser the top rests on: a 1 x 1 round plate at a whole position, a 1 x 2 jumper at a
// half position in one direction, a 2 x 2 jumper at a half position in both. Anything else is
// joined by a Technic pin.
import { JUMPER_1X2, JUMPER_2X2, ROUND_PLATE_1X1, TECHNIC_PIN } from '../catalog/candidates.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { ColorRef, Connection, Connector, PlacedPart, SurfaceTypeId } from '../types.ts';

const EPS = 1e-9;
const isHalf = (v: number) => Math.abs(((v % 10) + 10) % 10 - 5) < EPS;

export function connectorAt(
  bottomType: SurfaceTypeId,
  at: Connection,
  x: number,
  y: number,
  color: ColorRef,
): Connector {
  const t = SURFACE_TYPES[bottomType];
  let placed: PlacedPart;
  if (t.offsetRule === 'riser') {
    const hx = isHalf(x);
    const hy = isHalf(y);
    const base = { kind: 'riser' as const, x, y, z: 4, color };
    if (hx && hy) placed = { ...base, part: JUMPER_2X2, widthLbu: 20, heightLbu: 20, rotationDeg: 0 };
    else if (hx) placed = { ...base, part: JUMPER_1X2, widthLbu: 20, heightLbu: 10, rotationDeg: 0 };
    else if (hy) placed = { ...base, part: JUMPER_1X2, widthLbu: 10, heightLbu: 20, rotationDeg: 90 };
    else placed = { ...base, part: ROUND_PLATE_1X1, widthLbu: 10, heightLbu: 10, rotationDeg: 0 };
  } else {
    placed = { part: TECHNIC_PIN, kind: 'pin', x, y, z: 0, widthLbu: 10, heightLbu: 10, rotationDeg: 0, color };
  }
  return { at, placed };
}

/** Warnings for risers whose footprints overlap (touching is fine). */
export function overlapWarnings(connectors: readonly Connector[]): string[] {
  const risers = connectors.filter((c) => c.placed.kind === 'riser').map((c) => c.placed);
  const out: string[] = [];
  for (let a = 0; a < risers.length; a++) {
    for (let b = a + 1; b < risers.length; b++) {
      const p = risers[a]!;
      const q = risers[b]!;
      const overlapX = Math.abs(p.x - q.x) < (p.widthLbu + q.widthLbu) / 2 - EPS;
      const overlapY = Math.abs(p.y - q.y) < (p.heightLbu + q.heightLbu) / 2 - EPS;
      if (overlapX && overlapY) {
        out.push(`Risers at (${p.x}, ${p.y}) and (${q.x}, ${q.y}) LBU overlap; raise the minimum spacing to separate them.`);
      }
    }
  }
  return out;
}
