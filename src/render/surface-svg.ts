// 2D drawings of each surface as LEGO parts (T048; FR-016, FR-017). Local coordinates (LBU, y up,
// origin at the first binding point) become SVG coordinates (top-left origin, y down) only here.
// Colors are written as attributes, not CSS classes, so downloaded SVG and PNG files look the same.
import { CATALOG, color } from '../catalog/catalog.ts';
import { localPoint } from '../build/build.ts';
import { toSolverInput } from '../solver/grid.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { Build, PlacedPart } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';
const PAD = 8;
const RING = '#d01012';
const INK = 'rgba(0, 0, 0, 0.35)';
const HOLE = '#2b2b2b';

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function rgb(id: number): string {
  return color(CATALOG, id)?.rgb ?? '#a0a5a9';
}

/** Darken or lighten a #rrggbb color by a factor, for stud shading. */
function shade(hex: string, f: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.max(0, Math.min(255, Math.round(((n >> sh) & 255) * f))));
  return `rgb(${c.join(',')})`;
}

export interface SurfaceDrawing {
  readonly svg: SVGSVGElement;
  readonly title: string;
}

export function renderSurface(build: Build, which: 'top' | 'bottom'): SurfaceDrawing {
  const surface = which === 'bottom' ? build.bottom : build.top;
  const parts = which === 'bottom' ? build.bottomParts : build.topParts;
  const type = SURFACE_TYPES[surface.spec.typeId];
  const input = toSolverInput(build.config);
  const steps = which === 'bottom' ? input.bottom : input.top;
  const points = build.connections.map((c) =>
    which === 'bottom' ? localPoint(surface, steps, c.bottom.i, c.bottom.j) : localPoint(surface, steps, c.top.i, c.top.j),
  );
  // Connectors are placed in bottom coordinates. Risers are the bottom's fractional adjustments, so
  // only pins, which pass through both surfaces, are drawn on the top, at the top's points.
  const connectors: PlacedPart[] =
    which === 'bottom'
      ? build.connectors.map((c) => c.placed)
      : build.connectors.flatMap((c, n) => (c.placed.kind === 'pin' ? [{ ...c.placed, x: points[n]!.x, y: points[n]!.y }] : []));

  const all = [...parts, ...connectors];
  const minX = Math.min(...all.map((p) => p.x - p.widthLbu / 2)) - PAD;
  const maxX = Math.max(...all.map((p) => p.x + p.widthLbu / 2)) + PAD;
  const minY = Math.min(...all.map((p) => p.y - p.heightLbu / 2)) - PAD;
  const maxY = Math.max(...all.map((p) => p.y + p.heightLbu / 2)) + PAD;
  const width = maxX - minX;
  const height = maxY - minY;
  const X = (x: number) => x - minX;
  const Y = (y: number) => maxY - y;

  const title = `${which === 'bottom' ? 'Bottom' : 'Top'}: ${type.name}, ${surface.spec.sizeX}${
    surface.spec.sizeY !== undefined ? ` × ${surface.spec.sizeY}` : ''
  } LBU, ${build.connections.length} connections`;
  const svg = s('svg', { xmlns: SVG, viewBox: `0 0 ${width} ${height}`, width: width * 3, height: height * 3, role: 'img', class: 'surface-svg' });
  const t = s('title', {});
  t.textContent = title;
  svg.append(t, s('rect', { x: 0, y: 0, width, height, fill: '#ffffff' }));

  const box = (p: PlacedPart, extra: Record<string, string | number> = {}) =>
    s('rect', {
      x: X(p.x - p.widthLbu / 2),
      y: Y(p.y + p.heightLbu / 2),
      width: p.widthLbu,
      height: p.heightLbu,
      fill: rgb(p.color),
      stroke: INK,
      'stroke-width': 0.6,
      ...extra,
    });

  // Base parts with their studs or holes.
  for (const p of parts.filter((q) => q.kind !== 'offset')) {
    svg.append(box(p, p.kind === 'liftarm' ? { rx: 5 } : {}));
    const left = p.x - p.widthLbu / 2;
    const studsAcross = Math.round(p.widthLbu / 10);
    if (type.view === 'top') {
      // Studs at every whole position the part covers.
      const rows = Math.round(p.heightLbu / 10);
      for (let a = 0; a < studsAcross; a++) {
        for (let b = 0; b < rows; b++) {
          const cx = left + 5 + 10 * a;
          const cy = p.y - p.heightLbu / 2 + 5 + 10 * b;
          svg.append(s('circle', { cx: X(cx), cy: Y(cy), r: 3, fill: shade(rgb(p.color), 1.12), stroke: INK, 'stroke-width': 0.4 }));
        }
      }
    } else if (p.kind === 'liftarm') {
      for (let a = 0; a < studsAcross; a++) svg.append(s('circle', { cx: X(left + 5 + 10 * a), cy: Y(p.y), r: 2.4, fill: HOLE }));
    } else if (p.kind === 'technic') {
      // Technic bricks: holes between the studs.
      for (let a = 1; a < studsAcross; a++) svg.append(s('circle', { cx: X(left + 10 * a), cy: Y(p.y), r: 2.4, fill: HOLE }));
    }
  }

  // Offset parts: plates, then 1 x 1 Technic bricks with their hole on the stud center.
  for (const p of parts.filter((q) => q.kind === 'offset')) {
    svg.append(box(p, { stroke: '#000', 'stroke-width': 0.6 }));
    if (p.heightLbu > 4) svg.append(s('circle', { cx: X(p.x), cy: Y(p.y), r: 2.4, fill: HOLE }));
  }

  // Connectors: risers as plates with a stud, pins as dark disks.
  for (const c of connectors) {
    if (c.kind === 'riser') {
      svg.append(box(c, { 'fill-opacity': 0.85 }));
      svg.append(s('circle', { cx: X(c.x), cy: Y(c.y), r: 3, fill: shade(rgb(c.color), 1.6) }));
    } else {
      svg.append(s('circle', { cx: X(c.x), cy: Y(c.y), r: 2.6, fill: rgb(c.color), stroke: '#fff', 'stroke-width': 0.5 }));
    }
  }

  // Mark every connection by filling its stud or hole red.
  const r = type.view === 'top' ? 3 : 2.6;
  for (const p of points) svg.append(s('circle', { cx: X(p.x), cy: Y(p.y), r, fill: RING, stroke: INK, 'stroke-width': 0.4 }));

  return { svg, title };
}
