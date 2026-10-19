// Solutions are grouped by the angle the build actually makes, not the 0.1° input angle that
// tolerated the error (FR-011c). Every input angle whose connections build the same angle is one
// solution, shown once.
import type { AngleTenths, SolverInput } from '../types.ts';
import type { FilteredAngle } from './filter.ts';

/** Build angles closer than this (0.01°) are the same solution; it is also the display precision. */
const GROUP_RESOLUTION_DEG = 0.01;

export interface SolutionGroup {
  /** The angle the build makes, in degrees (best-fit rotation of the kept connections). */
  readonly buildDeg: number;
  /** Smallest and largest input angles in the group. */
  readonly from: AngleTenths;
  readonly to: AngleTenths;
  /** Most connections, then smallest worst error, then the input angle nearest the build angle. */
  readonly best: FilteredAngle;
  /** In input-angle order. */
  readonly members: readonly FilteredAngle[];
}

/**
 * The rotation that best maps the connected top points onto their bottom points (least squares,
 * after centering both sets). For a linear top with two connections it is exactly the direction
 * between the two bottom points, as in PythagoreanTriples.ps1. Display only: it never feeds back
 * into solving or filtering.
 */
export function buildAngle(f: FilteredAngle, input: SolverInput): number {
  const { top, bottom } = input;
  const pts = f.kept.map((c) => ({
    tx: c.top.i * top.stepX - top.sizeX / 2,
    ty: top.dimensions === 1 ? 0 : c.top.j * top.stepY - top.sizeY / 2,
    bx: c.bottom.i * bottom.stepX - bottom.sizeX / 2,
    by: c.bottom.j * bottom.stepY - bottom.sizeY / 2,
  }));
  const n = pts.length;
  const mean = (key: 'tx' | 'ty' | 'bx' | 'by') => pts.reduce((s, p) => s + p[key], 0) / n;
  const [mtx, mty, mbx, mby] = [mean('tx'), mean('ty'), mean('bx'), mean('by')];
  let cross = 0;
  let dot = 0;
  for (const p of pts) {
    const tx = p.tx - mtx;
    const ty = p.ty - mty;
    const bx = p.bx - mbx;
    const by = p.by - mby;
    cross += tx * by - ty * bx;
    dot += tx * bx + ty * by;
  }
  const deg = (Math.atan2(cross, dot) * 180) / Math.PI;
  return Math.abs(deg) < 1e-9 ? 0 : deg;
}

function better(a: FilteredAngle, b: FilteredAngle, buildDeg: number): boolean {
  if (a.kept.length !== b.kept.length) return a.kept.length > b.kept.length;
  if (a.shownWorstErrorLbu !== b.shownWorstErrorLbu) return a.shownWorstErrorLbu < b.shownWorstErrorLbu;
  const da = Math.abs(a.solution.angle / 10 - buildDeg);
  const db = Math.abs(b.solution.angle / 10 - buildDeg);
  if (da !== db) return da < db;
  return a.solution.angle < b.solution.angle;
}

/** Group qualifying angles into solutions by build angle, in build-angle order. */
export function groupSolutions(angles: readonly FilteredAngle[], input: SolverInput): SolutionGroup[] {
  const bins = new Map<number, FilteredAngle[]>();
  for (const a of angles) {
    const key = Math.round(buildAngle(a, input) / GROUP_RESOLUTION_DEG);
    const bin = bins.get(key);
    if (bin) bin.push(a);
    else bins.set(key, [a]);
  }
  const groups: SolutionGroup[] = [];
  for (const [key, members] of [...bins.entries()].sort((a, b) => a[0] - b[0])) {
    const binDeg = key * GROUP_RESOLUTION_DEG;
    let best = members[0]!;
    for (const m of members) if (better(m, best, binDeg)) best = m;
    const buildDeg = buildAngle(best, input);
    groups.push({
      buildDeg,
      from: members[0]!.solution.angle,
      to: members[members.length - 1]!.solution.angle,
      best,
      members,
    });
  }
  return groups;
}

export function groupOf(groups: readonly SolutionGroup[], angle: AngleTenths | null): SolutionGroup | null {
  if (angle === null) return null;
  return groups.find((g) => g.members.some((m) => m.solution.angle === angle)) ?? null;
}

export function formatBuildAngle(deg: number): string {
  return `${deg.toFixed(2)}°`;
}
