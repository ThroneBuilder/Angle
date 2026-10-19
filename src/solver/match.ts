// Exact matching of a rotated, offset top surface against the bottom grid (research R3).
// Rotation uses the committed trig table and squared distances only (research R2).
import { COS, SIN } from '../geometry/trig-table.ts';
import type { AngleSolution, AngleTenths, Connection, Placement, SolverInput } from '../types.ts';
import { SOLVE_TOLERANCE_LBU } from './constants.ts';
import { bindingPoints, columns, rows } from './grid.ts';

const T2 = SOLVE_TOLERANCE_LBU * SOLVE_TOLERANCE_LBU;

/** Top points and bottom grid facts, computed once per configuration. */
export interface Prepared {
  readonly input: SolverInput;
  readonly n: number;
  readonly tx: Float64Array;
  readonly ty: Float64Array;
  readonly ti: Int16Array;
  readonly tj: Int16Array;
  readonly cols: number;
  readonly rows: number;
  readonly halfX: number;
  readonly halfY: number;
}

export function prepare(input: SolverInput): Prepared {
  const points = bindingPoints(input.top);
  const n = points.length;
  const tx = new Float64Array(n);
  const ty = new Float64Array(n);
  const ti = new Int16Array(n);
  const tj = new Int16Array(n);
  points.forEach((p, k) => {
    tx[k] = p.x;
    ty[k] = p.y;
    ti[k] = p.i;
    tj[k] = p.j;
  });
  return {
    input,
    n,
    tx,
    ty,
    ti,
    tj,
    cols: columns(input.bottom),
    rows: rows(input.bottom),
    halfX: input.bottom.sizeX / 2,
    halfY: input.bottom.sizeY / 2,
  };
}

function byBottom(a: Connection, b: Connection): number {
  return a.bottom.j - b.bottom.j || a.bottom.i - b.bottom.i;
}

/** Every top point within the solve tolerance of a bottom point, sorted by bottom (j, i). */
export function matchPrepared(p: Prepared, k: AngleTenths, ox: number, oy: number): Connection[] {
  const cos = COS[k]!;
  const sin = SIN[k]!;
  const { stepX, stepY } = p.input.bottom;
  const out: Connection[] = [];
  for (let n = 0; n < p.n; n++) {
    const x = p.tx[n]!;
    const y = p.ty[n]!;
    const rx = x * cos - y * sin + ox;
    const ry = x * sin + y * cos + oy;
    // `+ 0` turns Math.round's -0 into 0, so packed and unpacked results are identical.
    const bi = Math.round((rx + p.halfX) / stepX) + 0;
    if (bi < 0 || bi >= p.cols) continue;
    const bj = Math.round((ry + p.halfY) / stepY) + 0;
    if (bj < 0 || bj >= p.rows) continue;
    const dx = bi * stepX - p.halfX - rx;
    const dy = bj * stepY - p.halfY - ry;
    const d2 = dx * dx + dy * dy;
    if (d2 <= T2) {
      out.push({
        top: { i: p.ti[n]!, j: p.tj[n]! },
        bottom: { i: bi, j: bj },
        errorLbu: Math.fround(Math.sqrt(d2)),
      });
    }
  }
  return out.sort(byBottom);
}

export function matchAt(input: SolverInput, k: AngleTenths, ox: number, oy: number): Connection[] {
  return matchPrepared(prepare(input), k, ox, oy);
}

export function toSolution(
  angle: AngleTenths,
  tierMask: number,
  placement: Placement,
  connections: Connection[],
): AngleSolution | null {
  if (connections.length === 0) return null;
  let worst = 0;
  for (const c of connections) if (c.errorLbu > worst) worst = c.errorLbu;
  return { angle, tierMask, placement, connections, worstErrorLbu: worst };
}

/** Connections within a tolerance, and the worst error among them. */
export function within(connections: readonly Connection[], toleranceLbu: number): { count: number; worst: number } {
  let count = 0;
  let worst = 0;
  for (const c of connections) {
    if (c.errorLbu > toleranceLbu) continue;
    count++;
    if (c.errorLbu > worst) worst = c.errorLbu;
  }
  return { count, worst };
}
