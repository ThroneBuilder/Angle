// The vector between the outermost connected holes of a linear top, in the units of
// PythagoreanTriples.ps1: dx in studs, dy in bricks on walls (studs on plates), length in holes.
import type { FilteredAngle } from '../solver/filter.ts';

export interface LinearSteps {
  readonly stepX: number;
  readonly stepY: number;
  /** 12 when the bottom is a wall seen from the side (bricks up), 10 on plates (studs). */
  readonly yUnitLbu: 10 | 12;
}

export interface Span {
  readonly dx: number;
  readonly dy: number;
  /** Straight-line length between the two bottom points, in holes (10 LBU each). */
  readonly length: number;
}

export function spanOf(a: FilteredAngle, steps: LinearSteps): Span | null {
  if (a.kept.length < 2) return null;
  let first = a.kept[0]!;
  let last = a.kept[0]!;
  for (const c of a.kept) {
    if (c.top.i < first.top.i) first = c;
    if (c.top.i > last.top.i) last = c;
  }
  const x = (last.bottom.i - first.bottom.i) * steps.stepX;
  const y = (last.bottom.j - first.bottom.j) * steps.stepY;
  return { dx: x / 10, dy: y / steps.yUnitLbu, length: Math.hypot(x, y) / 10 };
}

/** Holes or studs (10 LBU each), with one decimal only when a half step is involved. */
export function holes(lbu: number): string {
  const v = lbu / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
