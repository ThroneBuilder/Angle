// Shifted placement (research R4, R15; FR-007a–c): for each tolerance tier, find the sideways
// offset of the rotated top that gives the most connections within that tolerance, preferring the
// tightest cluster, without forcing any single connection to zero error.
import { minEnclosingCircle, type Pt } from '../geometry/circle.ts';
import { COS, SIN } from '../geometry/trig-table.ts';
import type { AngleSolution, AngleTenths, Placement, SolverInput } from '../types.ts';
import { solveAngleCentered } from './centered.ts';
import { TIERS_LBU } from './constants.ts';
import { matchPrepared, prepare, toSolution, within, type Prepared } from './match.ts';

/** Most distinct top-scoring clusters refined per tier, to bound the running time. */
const MAX_CANDIDATES = 32;

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

/** Difference wrapped into [-m/2, m/2). */
function wrapDiff(d: number, m: number): number {
  return mod(d + m / 2, m) - m / 2;
}

interface Rotated {
  readonly rx: Float64Array;
  readonly ry: Float64Array;
  /** In-cell offset that lands each point exactly on a bottom grid point. */
  readonly targetX: Float64Array;
  readonly targetY: Float64Array;
}

function rotate(p: Prepared, k: AngleTenths): Rotated {
  const cos = COS[k]!;
  const sin = SIN[k]!;
  const { stepX: sx, stepY: sy } = p.input.bottom;
  const rx = new Float64Array(p.n);
  const ry = new Float64Array(p.n);
  const targetX = new Float64Array(p.n);
  const targetY = new Float64Array(p.n);
  for (let n = 0; n < p.n; n++) {
    rx[n] = p.tx[n]! * cos - p.ty[n]! * sin;
    ry[n] = p.tx[n]! * sin + p.ty[n]! * cos;
    targetX[n] = mod(-(rx[n]! + p.halfX), sx);
    targetY[n] = mod(-(ry[n]! + p.halfY), sy);
  }
  return { rx, ry, targetX, targetY };
}

interface Cluster {
  readonly count: number;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
}

/** Differences smaller than this are floating-point noise, not a better placement. */
const EPS = 1e-9;

/** Snap an in-cell offset to [0, step) on a 1e-9 LBU grid, so equal placements compare equal. */
function snap(v: number, step: number): number {
  const s = Math.round(mod(v, step) / EPS) * EPS;
  return s >= step - EPS / 2 ? 0 : s + 0;
}

function betterCluster(a: Cluster, b: Cluster, sx: number, sy: number): boolean {
  if (a.count !== b.count) return a.count > b.count;
  if (Math.abs(a.radius - b.radius) > EPS) return a.radius < b.radius;
  const da = wrapDiff(a.x, sx) ** 2 + wrapDiff(a.y, sy) ** 2;
  const db = wrapDiff(b.x, sx) ** 2 + wrapDiff(b.y, sy) ** 2;
  return da < db;
}

/**
 * Steps 2–3: the in-cell offset where the most points land within `tol`, preferring the
 * smallest worst error. The coverage grid counts exactly how many points are within `tol` of each
 * grid offset; the points around a top-scoring offset always fit in a circle of radius `tol`, so
 * the smallest enclosing circle's center is a valid offset with an equal or smaller worst error.
 */
function bestInCell(p: Prepared, r: Rotated, tol: number): Cluster | null {
  const { stepX: sx, stepY: sy } = p.input.bottom;
  const resolution = tol / 6;
  const nx = Math.ceil(sx / resolution);
  const ny = Math.ceil(sy / resolution);
  const hx = sx / nx;
  const hy = sy / ny;
  const reach = tol;
  const reach2 = reach * reach;
  const ax = Math.ceil(reach / hx);
  const by = Math.ceil(reach / hy);
  const counts = new Uint16Array(nx * ny);
  let maxCount = 0;
  for (let n = 0; n < p.n; n++) {
    const txn = r.targetX[n]!;
    const tyn = r.targetY[n]!;
    const a0 = Math.round(txn / hx);
    const b0 = Math.round(tyn / hy);
    for (let db = -by; db <= by; db++) {
      const b = b0 + db;
      const dy = b * hy - tyn;
      const dy2 = dy * dy;
      if (dy2 > reach2) continue;
      // Targets lie in [0, step), so one conditional wrap is enough (no modulo in the hot loop).
      const row = (b < 0 ? b + ny : b >= ny ? b - ny : b) * nx;
      for (let da = -ax; da <= ax; da++) {
        const a = a0 + da;
        const dx = a * hx - txn;
        if (dx * dx + dy2 <= reach2) {
          const c = ++counts[row + (a < 0 ? a + nx : a >= nx ? a - nx : a)]!;
          if (c > maxCount) maxCount = c;
        }
      }
    }
  }
  if (maxCount === 0) return null;

  // Top-scoring offsets, nearest centered first. Cells close to one already examined almost
  // always hold the same points, so examine only cells at least tol/4 apart.
  const cells: { cell: number; dist: number }[] = [];
  for (let cell = 0; cell < counts.length; cell++) {
    if (counts[cell] !== maxCount) continue;
    const wx = wrapDiff((cell % nx) * hx, sx);
    const wy = wrapDiff(Math.floor(cell / nx) * hy, sy);
    cells.push({ cell, dist: wx * wx + wy * wy });
  }
  cells.sort((a, b) => a.dist - b.dist || a.cell - b.cell);
  const spacing2 = (tol / 4) ** 2;
  const examined: { x: number; y: number }[] = [];
  let best: Cluster | null = null;
  for (const { cell } of cells) {
    if (examined.length >= MAX_CANDIDATES) break;
    const cx = (cell % nx) * hx;
    const cy = Math.floor(cell / nx) * hy;
    const near = examined.some((e) => {
      const dx = wrapDiff(e.x - cx, sx);
      const dy = wrapDiff(e.y - cy, sy);
      return dx * dx + dy * dy < spacing2;
    });
    if (near) continue;
    examined.push({ x: cx, y: cy });
    let candidate: Cluster = { count: 0, radius: tol, x: cx, y: cy };
    // Refine, then grow: re-gather around the refined center while that adds points and they
    // still fit within the tolerance (catches optima between grid offsets).
    for (let round = 0; round < 3; round++) {
      const pts = gather(r, candidate.x, candidate.y, reach2, sx, sy);
      if (pts.length <= candidate.count && round > 0) break;
      const circle = minEnclosingCircle(pts);
      if (circle.r > tol) {
        if (round === 0) candidate = { count: pts.length, radius: tol, x: cx, y: cy };
        break;
      }
      candidate = { count: pts.length, radius: circle.r, x: circle.x, y: circle.y };
    }
    if (!best || betterCluster(candidate, best, sx, sy)) best = candidate;
  }
  return best && { ...best, x: snap(best.x, sx), y: snap(best.y, sy) };
}

/** Required offsets of the points whose target is within reach of (cx, cy), unwrapped near it. */
function gather(r: Rotated, cx: number, cy: number, reach2: number, sx: number, sy: number): Pt[] {
  const pts: Pt[] = [];
  for (let n = 0; n < r.targetX.length; n++) {
    const dx = wrapDiff(r.targetX[n]! - cx, sx);
    const dy = wrapDiff(r.targetY[n]! - cy, sy);
    if (dx * dx + dy * dy <= reach2) pts.push({ x: cx + dx, y: cy + dy });
  }
  return pts;
}

interface Choice {
  readonly ox: number;
  readonly oy: number;
  readonly count: number;
  readonly worst2: number;
}

/** FR-007c and research R4 step 4: most connections, smallest worst error, nearest centered. */
function betterChoice(a: Choice, b: Choice): boolean {
  if (a.count !== b.count) return a.count > b.count;
  if (Math.abs(a.worst2 - b.worst2) > EPS) return a.worst2 < b.worst2;
  const da = a.ox * a.ox + a.oy * a.oy;
  const db = b.ox * b.ox + b.oy * b.oy;
  if (Math.abs(da - db) > EPS) return da < db;
  if (Math.abs(Math.abs(a.ox) - Math.abs(b.ox)) > EPS) return Math.abs(a.ox) < Math.abs(b.ox);
  if (Math.abs(Math.abs(a.oy) - Math.abs(b.oy)) > EPS) return Math.abs(a.oy) < Math.abs(b.oy);
  if (Math.abs(a.ox - b.ox) > EPS) return a.ox > b.ox;
  return a.oy > b.oy;
}

/** Step 4: choose the whole-step placement of an in-cell offset. */
function bestPlacement(p: Prepared, r: Rotated, tx: number, ty: number, tol: number): Placement | null {
  const { stepX: sx, stepY: sy } = p.input.bottom;
  const tol2 = tol * tol;
  const bi0: number[] = [];
  const bj0: number[] = [];
  const err2: number[] = [];
  for (let n = 0; n < p.n; n++) {
    const x = r.rx[n]! + tx;
    const y = r.ry[n]! + ty;
    const bi = Math.round((x + p.halfX) / sx);
    const bj = Math.round((y + p.halfY) / sy);
    const dx = bi * sx - p.halfX - x;
    const dy = bj * sy - p.halfY - y;
    const e2 = dx * dx + dy * dy;
    if (e2 > tol2) continue;
    bi0.push(bi);
    bj0.push(bj);
    err2.push(e2);
  }
  if (bi0.length === 0) return null;

  // Counts per whole-step placement from a 2D prefix sum over the members' grid indices.
  let minI = Infinity;
  let maxI = -Infinity;
  let minJ = Infinity;
  let maxJ = -Infinity;
  for (let m = 0; m < bi0.length; m++) {
    minI = Math.min(minI, bi0[m]!);
    maxI = Math.max(maxI, bi0[m]!);
    minJ = Math.min(minJ, bj0[m]!);
    maxJ = Math.max(maxJ, bj0[m]!);
  }
  const w = maxI - minI + 1;
  const h = maxJ - minJ + 1;
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let m = 0; m < bi0.length; m++) sum[(bj0[m]! - minJ + 1) * (w + 1) + (bi0[m]! - minI + 1)]!++;
  for (let j = 1; j <= h; j++) {
    for (let i = 1; i <= w; i++) {
      const q = j * (w + 1) + i;
      sum[q]! += sum[q - 1]! + sum[q - (w + 1)]! - sum[q - (w + 1) - 1]!;
    }
  }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  /** Members with grid index i in [i0, i1) and j in [j0, j1). */
  const rect = (i0: number, i1: number, j0: number, j1: number) => {
    const a = clamp(i0 - minI, 0, w);
    const b = clamp(i1 - minI, 0, w);
    const c = clamp(j0 - minJ, 0, h);
    const d = clamp(j1 - minJ, 0, h);
    if (a >= b || c >= d) return 0;
    return sum[d * (w + 1) + b]! - sum[c * (w + 1) + b]! - sum[d * (w + 1) + a]! + sum[c * (w + 1) + a]!;
  };

  const mxFrom = Math.ceil((-p.halfX - tx) / sx);
  const mxTo = Math.floor((p.halfX - tx) / sx);
  const myFrom = Math.ceil((-p.halfY - ty) / sy);
  const myTo = Math.floor((p.halfY - ty) / sy);
  let maxCount = 0;
  for (let my = myFrom; my <= myTo; my++) {
    for (let mx = mxFrom; mx <= mxTo; mx++) {
      maxCount = Math.max(maxCount, rect(-mx, p.cols - mx, -my, p.rows - my));
    }
  }
  if (maxCount === 0) return null;

  // Only placements tied for the most connections need their worst error.
  let best: Choice | null = null;
  for (let my = myFrom; my <= myTo; my++) {
    for (let mx = mxFrom; mx <= mxTo; mx++) {
      if (rect(-mx, p.cols - mx, -my, p.rows - my) !== maxCount) continue;
      let worst2 = 0;
      for (let m = 0; m < bi0.length; m++) {
        const bi = bi0[m]! + mx;
        const bj = bj0[m]! + my;
        if (bi < 0 || bi >= p.cols || bj < 0 || bj >= p.rows) continue;
        if (err2[m]! > worst2) worst2 = err2[m]!;
      }
      const choice = { ox: tx + mx * sx + 0, oy: ty + my * sy + 0, count: maxCount, worst2 };
      if (!best || betterChoice(choice, best)) best = choice;
    }
  }
  return best ? { offsetX: best.ox, offsetY: best.oy } : null;
}

/** The best placement at one tolerance tier, or the centered result if shifting doesn't help. */
export function solveAngleShiftedTier(
  input: SolverInput,
  k: AngleTenths,
  tier: number,
  prepared?: Prepared,
  rotated?: Rotated,
  centered?: AngleSolution | null,
): AngleSolution | null {
  const p = prepared ?? prepare(input);
  const tol = TIERS_LBU[tier]!;
  const c = centered === undefined ? solveAngleCentered(input, k, p) : centered;
  const r = rotated ?? rotate(p, k);
  const cluster = bestInCell(p, r, tol);
  const placement = cluster && bestPlacement(p, r, cluster.x, cluster.y, tol);
  const shifted = placement && toSolution(k, 1 << tier, placement, matchPrepared(p, k, placement.offsetX, placement.offsetY));
  const centeredHere = c && { ...c, tierMask: 1 << tier };
  if (!shifted) return centeredHere;
  if (!centeredHere) return shifted;
  const s = within(shifted.connections, tol);
  const z = within(centeredHere.connections, tol);
  if (s.count > z.count || (s.count === z.count && s.worst < z.worst)) return shifted;
  return centeredHere;
}

/** One solution per distinct placement across all tiers, lowest tier first. */
export function solveAngleShifted(input: SolverInput, k: AngleTenths, prepared?: Prepared): AngleSolution[] {
  const p = prepared ?? prepare(input);
  const centered = solveAngleCentered(input, k, p);
  const r = rotate(p, k);
  const merged: AngleSolution[] = [];
  for (let t = 0; t < TIERS_LBU.length; t++) {
    const s = solveAngleShiftedTier(input, k, t, p, r, centered);
    if (!s) continue;
    const same = merged.find(
      (m) => m.placement.offsetX === s.placement.offsetX && m.placement.offsetY === s.placement.offsetY,
    );
    if (same) {
      merged[merged.indexOf(same)] = { ...same, tierMask: same.tierMask | s.tierMask };
    } else {
      merged.push(s);
    }
  }
  return merged;
}
