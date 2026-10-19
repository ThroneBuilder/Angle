// Match map (FR-014a): every solution as a dot, build angle across and hole spacing, span, or
// connection count up, colored by worst error. One series, so no series legend; a color key
// explains the error bands. The list is the keyboard path and the table view (FR-015).
import { formatBuildAngle, type SolutionGroup } from '../solver/group.ts';
import { formatAngle } from '../geometry/units.ts';
import type { AngleTenths } from '../types.ts';
import { h } from '../ui/dom.ts';
import { holes, spanOf, type LinearSteps } from '../ui/span.ts';

export type MapMeasure = 'spacing' | 'span' | 'connections';

export interface MapPoint {
  readonly group: SolutionGroup;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly band: number;
}

const BANDS = 5;

/** 0 (smallest error) … 4, five equal bands from 0 to the tolerance. */
export function errorBand(errorLbu: number, toleranceLbu: number): number {
  if (toleranceLbu <= 0) return 0;
  return Math.min(BANDS - 1, Math.floor((errorLbu / toleranceLbu) * BANDS + 1e-9));
}

/** A clean axis maximum at or above v. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 4, 5, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function ticksFor(max: number): number[] {
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((s) => max / s <= 5 && Number.isInteger(max / s)) ?? max;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function measureOf(g: SolutionGroup, measure: MapMeasure): number {
  if (measure === 'connections') return g.best.kept.length;
  const lbu = measure === 'spacing' ? g.best.spacingLbu : g.best.spanLbu;
  return (lbu ?? 0) / 10;
}

export function matchMapPoints(
  groups: readonly SolutionGroup[],
  measure: MapMeasure,
  toleranceLbu: number,
  plot: { width: number; height: number },
): { points: MapPoint[]; yMax: number; yTicks: number[] } {
  const sorted = [...groups].sort((a, b) => a.buildDeg - b.buildDeg);
  const values = sorted.map((g) => measureOf(g, measure));
  const yMax = niceMax(Math.max(0, ...values));
  const points = sorted.map((group, n) => ({
    group,
    value: values[n]!,
    x: (group.buildDeg / 90) * plot.width,
    y: plot.height - (values[n]! / yMax) * plot.height,
    band: errorBand(group.best.shownWorstErrorLbu, toleranceLbu),
  }));
  return { points, yMax, yTicks: ticksFor(yMax) };
}

export interface ChartView {
  readonly groups: readonly SolutionGroup[] | null;
  readonly selected: AngleTenths | null;
  readonly toleranceLbu: number;
  readonly linear: LinearSteps | null;
  /** Top units for spacing and span, such as holes or studs. */
  readonly unitLabel: string;
  readonly measure: MapMeasure;
}

export const MEASURES: readonly [MapMeasure, string][] = [
  ['spacing', 'Spacing'],
  ['span', 'Span'],
  ['connections', 'Connections'],
];

export function measureLabel(view: ChartView): string {
  return view.measure === 'connections' ? 'connections' : `${view.measure} (${view.unitLabel})`;
}

/** Details shown when hovering a solution in either chart. */
export function tooltipLines(g: SolutionGroup, view: ChartView): string[] {
  const a = g.best;
  const lines = [
    `${formatBuildAngle(g.buildDeg)} build angle`,
    `Solved at ${g.members.length === 1 ? formatAngle(a.solution.angle) : `${g.members.length} input angles`}`,
    `${a.kept.length} connections, worst error ${a.shownWorstErrorLbu.toFixed(3)} LBU`,
  ];
  if (a.spacingLbu !== null) lines.push(`Spacing ${holes(a.spacingLbu)}, span ${holes(a.spanLbu ?? 0)} ${view.unitLabel}`);
  if (view.linear) {
    const span = spanOf(a, view.linear);
    if (span) lines.push(`dx ${span.dx.toFixed(1)}, dy ${span.dy.toFixed(1)}, length ${span.length.toFixed(3)}`);
  }
  return lines;
}

/** Position a tooltip next to a point given in a chart's viewBox units. */
export function placeTooltip(tooltip: HTMLElement, host: HTMLElement, viewBoxWidth: number, x: number, y: number): void {
  const box = host.getBoundingClientRect();
  const scale = box.width / viewBoxWidth;
  tooltip.style.left = `${Math.min(box.width - 220, Math.max(0, x * scale + 12))}px`;
  tooltip.style.top = `${host.offsetTop + y * scale - 8}px`;
}

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const W = 640;
const H = 260;
const M = { left: 40, right: 12, top: 12, bottom: 34 };

export function createMatchMap(container: HTMLElement, onSelect: (angle: AngleTenths) => void) {
  const subtitle = h('p', { class: 'map-subtitle' });
  const svgHost = h('div', { class: 'map-plot' });
  const tooltip = h('div', { class: 'map-tooltip', role: 'tooltip', hidden: true });
  const legend = h('div', { class: 'map-legend' });
  container.append(h('h3', {}, 'Match map'), subtitle, svgHost, tooltip, legend);

  function render(view: ChartView) {
    const unit = measureLabel(view);
    subtitle.textContent = `Each dot is a solution: build angle across, ${unit} up. Stronger color = smaller error.`;

    const groups = view.groups ?? [];
    const plot = { width: W - M.left - M.right, height: H - M.top - M.bottom };
    const { points, yMax, yTicks } = matchMapPoints(groups, view.measure, view.toleranceLbu, plot);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'map-svg' });
    svg.setAttribute('aria-label', `Match map of ${points.length} solutions by build angle and ${unit}.`);
    const g = s('g', { transform: `translate(${M.left},${M.top})` });
    svg.append(g);

    for (let deg = 0; deg <= 90; deg += 10) {
      const x = (deg / 90) * plot.width;
      g.append(s('line', { x1: x, x2: x, y1: 0, y2: plot.height, class: 'map-grid' }));
      const t = s('text', { x, y: plot.height + 16, class: 'map-tick', 'text-anchor': 'middle' });
      t.textContent = `${deg}°`;
      g.append(t);
    }
    for (const v of yTicks) {
      const y = plot.height - (v / yMax) * plot.height;
      g.append(s('line', { x1: 0, x2: plot.width, y1: y, y2: y, class: v === 0 ? 'map-axis' : 'map-grid' }));
      const t = s('text', { x: -6, y: y + 4, class: 'map-tick', 'text-anchor': 'end' });
      t.textContent = String(v);
      g.append(t);
    }

    const selectedGroup = groups.find((gr) => gr.members.some((m) => m.solution.angle === view.selected)) ?? null;
    const marks = s('g', { 'aria-hidden': 'true' });
    for (const p of points) {
      marks.append(s('circle', { cx: p.x, cy: p.y, r: 4, class: `map-dot band-${p.band}` }));
    }
    const selected = points.find((p) => p.group === selectedGroup);
    if (selected) {
      marks.append(s('circle', { cx: selected.x, cy: selected.y, r: 7, class: 'map-selected' }));
    }
    // Hit targets larger than the dots, on top.
    for (const p of points) {
      const hit = s('circle', { cx: p.x, cy: p.y, r: 9, class: 'map-hit' });
      hit.addEventListener('mouseenter', () => {
        tooltip.replaceChildren(...tooltipLines(p.group, view).map((l) => h('div', {}, l)));
        tooltip.hidden = false;
        placeTooltip(tooltip, svgHost, W, p.x + M.left, p.y + M.top);
      });
      hit.addEventListener('mouseleave', () => (tooltip.hidden = true));
      hit.addEventListener('click', () => onSelect(p.group.best.solution.angle));
      marks.append(hit);
    }
    g.append(marks);
    svgHost.replaceChildren(svg);

    const t = view.toleranceLbu;
    legend.replaceChildren(
      h('span', { class: 'map-legend-title' }, 'Worst error (LBU)'),
      ...Array.from({ length: BANDS }, (_, b) =>
        h(
          'span',
          { class: 'map-legend-item' },
          h('span', { class: `map-swatch band-${b}` }),
          t > 0 ? `${((b * t) / BANDS).toFixed(2)}–${(((b + 1) * t) / BANDS).toFixed(2)}` : '0',
        ),
      ).slice(0, t > 0 ? BANDS : 1),
    );
  }

  return { render };
}