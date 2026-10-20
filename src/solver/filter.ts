// Filters applied to stored results, never re-solving (research R5, R15; FR-008, FR-011).
// Order: tolerance, tessellation (optional), spacing, then the qualifying rule (including the
// maximum worst error).
import type { AngleSolution, Connection, FilterSettings, SolveResult, SolverInput } from '../types.ts';
import { tierIndexFor } from './constants.ts';
import { findTessellation } from './tessellation.ts';

export interface FilteredAngle {
  readonly solution: AngleSolution;
  readonly kept: readonly Connection[];
  readonly qualifies: boolean;
  readonly shownWorstErrorLbu: number;
  /** Smallest distance between any two kept top points, in LBU (null with fewer than two). */
  readonly spacingLbu: number | null;
  /** Largest distance between any two kept top points, in LBU (first to last hole on a liftarm). */
  readonly spanLbu: number | null;
}

export function structuralMinimumFor(topDimensions: 1 | 2): number {
  return topDimensions === 1 ? 2 : 3;
}

/** True if any three bottom points are not on one line (exact integer cross products). */
function hasNonCollinearTriple(connections: readonly Connection[]): boolean {
  const a = connections[0]?.bottom;
  const b = connections[1]?.bottom;
  if (!a || !b) return false;
  for (let n = 2; n < connections.length; n++) {
    const c = connections[n]!.bottom;
    if ((b.i - a.i) * (c.j - a.j) - (b.j - a.j) * (c.i - a.i) !== 0) return true;
  }
  return false;
}

function byBottom(a: Connection, b: Connection): number {
  return a.bottom.j - b.bottom.j || a.bottom.i - b.bottom.i;
}

/**
 * Walk the connections in top-point order (along the liftarm for a linear top; row by row for an
 * area top), dropping any closer than the minimum spacing to one already kept. Distances are
 * between top points, in LBU. Returns the kept connections in bottom (j, i) order, the smallest
 * distance between any two (spacing), and the largest (span).
 */
function applySpacing(connections: readonly Connection[], minSpacingLbu: number, top: SolverInput['top']) {
  const x = (c: Connection) => c.top.i * top.stepX;
  const y = (c: Connection) => (top.dimensions === 1 ? 0 : c.top.j * top.stepY);
  const dist2 = (a: Connection, b: Connection) => (x(a) - x(b)) ** 2 + (y(a) - y(b)) ** 2;
  const min2 = minSpacingLbu * minSpacingLbu;
  const ordered = [...connections].sort((a, b) => a.top.j - b.top.j || a.top.i - b.top.i);
  const kept: Connection[] = [];
  for (const c of ordered) {
    if (min2 > 0 && kept.some((k) => dist2(k, c) < min2)) continue;
    kept.push(c);
  }
  if (kept.length < 2) return { kept: kept.sort(byBottom), spacing: null, span: null };
  let near = Infinity;
  let far = 0;
  for (let a = 0; a < kept.length; a++) {
    for (let b = a + 1; b < kept.length; b++) {
      const d = dist2(kept[a]!, kept[b]!);
      if (d < near) near = d;
      if (d > far) far = d;
    }
  }
  return { kept: kept.sort(byBottom), spacing: Math.sqrt(near), span: Math.sqrt(far) };
}

export function applyFilters(solution: AngleSolution, filters: FilterSettings, input: SolverInput): FilteredAngle {
  const withinTolerance = solution.connections.filter((c) => c.errorLbu <= filters.toleranceLbu);
  const pattern = filters.tessellatedOnly ? (findTessellation(withinTolerance)?.members ?? []) : withinTolerance;
  const { kept, spacing: spacingLbu, span: spanLbu } = applySpacing(pattern, filters.minSpacing * 10, input.top);

  const linear = input.top.dimensions === 1;
  const minimum = Math.max(filters.minConnections, structuralMinimumFor(input.top.dimensions));
  // A small epsilon keeps a spacing equal to the maximum (√2 studs, for example) inside it.
  const withinMaxSpacing =
    filters.maxSpacing <= 0 || (spacingLbu !== null && spacingLbu <= filters.maxSpacing * 10 + 1e-9);
  let shownWorstErrorLbu = 0;
  for (const c of kept) if (c.errorLbu > shownWorstErrorLbu) shownWorstErrorLbu = c.errorLbu;
  const withinMaxError = filters.maxWorstErrorLbu <= 0 || shownWorstErrorLbu <= filters.maxWorstErrorLbu + 1e-9;
  const qualifies =
    kept.length >= minimum && withinMaxSpacing && withinMaxError && (linear || hasNonCollinearTriple(kept));
  return { solution, kept, qualifies, shownWorstErrorLbu, spacingLbu, spanLbu };
}

/** Qualifying angles in angle order, using the placement stored for the tolerance's tier. */
export function qualifyingAngles(result: SolveResult, filters: FilterSettings, input: SolverInput): FilteredAngle[] {
  const bit = 1 << tierIndexFor(filters.toleranceLbu);
  const out: FilteredAngle[] = [];
  for (const s of result.solutions) {
    if ((s.tierMask & bit) === 0) continue;
    const f = applyFilters(s, filters, input);
    if (f.qualifies) out.push(f);
  }
  return out;
}
