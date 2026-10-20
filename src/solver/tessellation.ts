// Tessellation (FR-011g): connections that belong to one repeating pattern differ from each
// other by whole multiples of the same one or two step vectors, on the top and the bottom alike.
// Chance connections outside the pattern don't. All arithmetic is on integer grid indices, so the
// result is exact and never varies.
import type { Connection } from '../types.ts';

/** A step between two connections: bottom (di, dj) and top (ti, tj) index differences. */
type Step = readonly [number, number, number, number];

function stepBetween(a: Connection, b: Connection): Step {
  return [b.bottom.i - a.bottom.i, b.bottom.j - a.bottom.j, b.top.i - a.top.i, b.top.j - a.top.j];
}

/** Sign-normalize so a step and its reverse count as one. */
function canonical(s: Step): Step {
  const first = s.find((v) => v !== 0) ?? 0;
  return first < 0 ? [-s[0], -s[1], -s[2], -s[3]] : s;
}

const key = (s: Step) => s.join(',');
const length2 = (s: Step) => s[0] * s[0] + s[1] * s[1];

function parallel(a: Step, b: Step): boolean {
  // All 2 x 2 minors vanish exactly when the 4-vectors are parallel.
  for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) if (a[p]! * b[q]! - a[q]! * b[p]! !== 0) return false;
  return true;
}

/** True if d = m·v1 (+ n·v2) for integers m, n. */
function inLattice(d: Step, v1: Step, v2: Step | null): boolean {
  if (!v2) {
    if (!parallel(d, v1)) return false;
    const p = v1.findIndex((v) => v !== 0);
    const m = d[p]! / v1[p]!;
    return Number.isInteger(m) && d.every((v, k) => v === m * v1[k]!);
  }
  // Solve with the first pair of coordinates whose 2 x 2 determinant is non-zero, then check all four.
  for (let p = 0; p < 4; p++) {
    for (let q = p + 1; q < 4; q++) {
      const det = v1[p]! * v2[q]! - v1[q]! * v2[p]!;
      if (det === 0) continue;
      const m = (d[p]! * v2[q]! - d[q]! * v2[p]!) / det;
      const n = (v1[p]! * d[q]! - v1[q]! * d[p]!) / det;
      if (!Number.isInteger(m) || !Number.isInteger(n)) return false;
      return d.every((v, k) => v === m * v1[k]! + n * v2[k]!);
    }
  }
  return false;
}

export interface Tessellation {
  /** The step vectors (one for a row, two for a grid). */
  readonly basis: readonly Step[];
  /** The connections in the pattern, in their original order. */
  readonly members: readonly Connection[];
}

/**
 * The largest set of connections forming one repeating pattern, or null when no step repeats
 * (every connection is a one-off).
 */
export function findTessellation(connections: readonly Connection[]): Tessellation | null {
  if (connections.length < 2) return null;
  const counts = new Map<string, { step: Step; count: number }>();
  for (let a = 0; a < connections.length; a++) {
    for (let b = a + 1; b < connections.length; b++) {
      const s = canonical(stepBetween(connections[a]!, connections[b]!));
      const entry = counts.get(key(s));
      if (entry) entry.count++;
      else counts.set(key(s), { step: s, count: 1 });
    }
  }
  // Repeating steps, most frequent first, then shortest, then by value (deterministic).
  const repeating = [...counts.values()]
    .filter((e) => e.count >= 2)
    .sort((x, y) => y.count - x.count || length2(x.step) - length2(y.step) || key(x.step).localeCompare(key(y.step)));
  const v1 = repeating[0]?.step;
  if (!v1) return null;
  const v2 = repeating.find((e) => !parallel(e.step, v1))?.step ?? null;

  // Group connections that differ by a lattice vector; keep the largest group (first on ties).
  const group = new Array<number>(connections.length).fill(-1);
  let best: Connection[] = [];
  for (let a = 0; a < connections.length; a++) {
    if (group[a] !== -1) continue;
    const members: Connection[] = [];
    for (let b = a; b < connections.length; b++) {
      if (group[b] !== -1) continue;
      if (b === a || inLattice(stepBetween(connections[a]!, connections[b]!), v1, v2)) {
        group[b] = a;
        members.push(connections[b]!);
      }
    }
    if (members.length > best.length) best = members;
  }
  return best.length >= 2 ? { basis: v2 ? [v1, v2] : [v1], members: best } : null;
}
