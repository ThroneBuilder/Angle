// Trim to connections (T046; FR-020b): shrink a surface to the smallest standard size, in whole
// units (studs, holes, bricks, layers), that still covers every connection. Trimming never moves
// the angle, placement, or connections; it only changes where the built surface starts and ends.
import { sizeChoices, SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { BuiltSurface, GridIndex, SurfaceSpec, UnitCount } from '../types.ts';

const EPS = 1e-9;

/** Window of whole units covering [min, max] (LBU from the first binding point). */
function window(count: UnitCount, min: number, max: number, fullSize: number): { start: number; size: number } {
  const half = count.insetLbu / 2;
  let k0 = Math.floor((min + half - EPS) / count.unitLbu);
  const k1 = Math.floor((max + half + EPS) / count.unitLbu);
  const fullCount = (fullSize + count.insetLbu) / count.unitLbu;
  const needed = Math.max(k1 - k0 + 1, count.min);
  const choice = sizeChoices(count).find((c) => c.n >= needed && c.n <= fullCount);
  const n = choice ? choice.n : fullCount;
  k0 = Math.max(0, Math.min(k0, fullCount - n));
  return { start: k0 * count.unitLbu, size: n * count.unitLbu - count.insetLbu };
}

export function trimSurface(
  spec: SurfaceSpec,
  used: readonly GridIndex[],
  steps: { stepX: number; stepY: number },
  warnings: string[],
): BuiltSurface {
  const type = SURFACE_TYPES[spec.typeId];
  if (used.length === 0) return { spec, offsetI: 0, offsetJ: 0 };
  if (type.layout === 'baseplate') {
    warnings.push('Baseplates are not trimmed.');
    return { spec, offsetI: 0, offsetJ: 0 };
  }
  const xs = used.map((g) => g.i * steps.stepX);
  const x = window(type.countX, Math.min(...xs), Math.max(...xs), spec.sizeX);
  if (type.dimensions === 1 || !type.countY) {
    return { spec: { ...spec, sizeX: x.size }, offsetI: x.start / steps.stepX, offsetJ: 0 };
  }
  const ys = used.map((g) => g.j * steps.stepY);
  const y = window(type.countY, Math.min(...ys), Math.max(...ys), spec.sizeY ?? 0);
  return {
    spec: { ...spec, sizeX: x.size, sizeY: y.size },
    offsetI: x.start / steps.stepX,
    offsetJ: y.start / steps.stepY,
  };
}
