// Protractor (T037, revised): the match map wrapped onto a 0°–90° quarter circle. Each solution
// is a dot at its build angle, with the chosen measure (spacing by default) as its distance from
// the center, colored by worst error like the match map. The list is the keyboard path.
import { formatBuildAngle, type SolutionGroup } from '../solver/group.ts';
import type { AngleTenths } from '../types.ts';
import { h } from '../ui/dom.ts';
import {
  errorBand,
  matchMapPoints,
  measureLabel,
  placeTooltip,
  tooltipLines,
  type ChartView,
  type MapMeasure,
} from './match-map.ts';

export interface PolarPoint {
  readonly group: SolutionGroup;
  readonly value: number;
  readonly band: number;
  readonly x: number;
  readonly y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Points relative to the center (SVG y points down), radius scaled so rMax reaches `radius`. */
export function polarPoints(
  groups: readonly SolutionGroup[],
  measure: MapMeasure,
  toleranceLbu: number,
  radius: number,
): { points: PolarPoint[]; rMax: number; rings: number[] } {
  // Reuse the match map's values and clean axis maximum so both charts share one scale.
  const { points: flat, yMax, yTicks } = matchMapPoints(groups, measure, toleranceLbu, { width: 90, height: 1 });
  const points = flat.map((p) => {
    const r = (p.value / yMax) * radius;
    const a = rad(p.group.buildDeg);
    return {
      group: p.group,
      value: p.value,
      band: errorBand(p.group.best.shownWorstErrorLbu, toleranceLbu),
      x: Math.cos(a) * r,
      y: -Math.sin(a) * r,
    };
  });
  return { points, rMax: yMax, rings: yTicks.filter((v) => v > 0) };
}

/** The point closest to (x, y), if it is within reach. */
export function nearestPoint(points: readonly PolarPoint[], x: number, y: number, reach: number): PolarPoint | null {
  let best: PolarPoint | null = null;
  let bestD = reach * reach;
  for (const p of points) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const SIZE = 280;
const PAD = 34;
const R = SIZE - PAD * 2;

export function createProtractor(container: HTMLElement, onSelect: (angle: AngleTenths) => void) {
  const subtitle = h('p', { class: 'map-subtitle' });
  const host = h('div', { class: 'protractor-plot' });
  const tooltip = h('div', { class: 'map-tooltip', role: 'tooltip', hidden: true });
  container.append(h('h3', {}, 'Protractor'), subtitle, host, tooltip);
  container.hidden = false;

  function render(view: ChartView) {
    const unit = measureLabel(view);
    subtitle.textContent = `Build angle around, ${unit} outward.`;
    const groups = view.groups ?? [];
    const { points, rMax, rings } = polarPoints(groups, view.measure, view.toleranceLbu, R);
    const selectedGroup = groups.find((g) => g.members.some((m) => m.solution.angle === view.selected)) ?? null;

    const svg = s('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'img', class: 'protractor-svg' });
    svg.setAttribute(
      'aria-label',
      `Protractor of ${points.length} solutions by build angle and ${unit}` +
        (selectedGroup ? `; ${formatBuildAngle(selectedGroup.buildDeg)} selected.` : '.'),
    );
    // Center at the bottom-left corner: 0° points right, 90° points up.
    const g = s('g', { transform: `translate(${PAD},${SIZE - PAD})` });
    svg.append(g);

    // Rings at the shared axis ticks, labelled along the 0° baseline; spokes every 10°.
    for (const v of rings) {
      const r = (v / rMax) * R;
      g.append(s('path', { d: `M ${r} 0 A ${r} ${r} 0 0 0 0 ${-r}`, class: v === rMax ? 'protractor-arc' : 'map-grid protractor-ring' }));
      const t = s('text', { x: r, y: 14, class: 'map-tick', 'text-anchor': 'middle' });
      t.textContent = String(v);
      g.append(t);
    }
    for (let deg = 0; deg <= 90; deg += 10) {
      const [c, sn] = [Math.cos(rad(deg)), -Math.sin(rad(deg))];
      g.append(s('line', { x1: 0, y1: 0, x2: c * R, y2: sn * R, class: deg % 90 === 0 ? 'protractor-arc' : 'map-grid' }));
      if (deg > 0) {
        const t = s('text', { x: c * (R + 16), y: sn * (R + 16) + 4, class: 'map-tick', 'text-anchor': 'middle' });
        t.textContent = `${deg}°`;
        g.append(t);
      }
    }

    const marks = s('g', { 'aria-hidden': 'true' });
    for (const p of points) {
      marks.append(s('circle', { cx: p.x, cy: p.y, r: 4, class: `map-dot band-${p.band}` }));
    }
    const selected = points.find((p) => p.group === selectedGroup);
    if (selected) marks.append(s('circle', { cx: selected.x, cy: selected.y, r: 7, class: 'map-selected' }));
    g.append(marks);

    // One hit area for the quarter circle: hover and click use the nearest dot within reach.
    const reach = 10;
    const hit = s('path', { d: `M 0 0 L ${R + 8} 0 A ${R + 8} ${R + 8} 0 0 0 0 ${-(R + 8)} Z`, class: 'protractor-hit' });
    const locate = (event: MouseEvent) => {
      const box = svg.getBoundingClientRect();
      const scale = SIZE / box.width;
      return nearestPoint(points, (event.clientX - box.left) * scale - PAD, (event.clientY - box.top) * scale - (SIZE - PAD), reach);
    };
    hit.addEventListener('mousemove', (event) => {
      const p = locate(event);
      if (!p) {
        tooltip.hidden = true;
        return;
      }
      tooltip.replaceChildren(...tooltipLines(p.group, view).map((l) => h('div', {}, l)));
      tooltip.hidden = false;
      placeTooltip(tooltip, host, SIZE, p.x + PAD, p.y + SIZE - PAD);
    });
    hit.addEventListener('mouseleave', () => (tooltip.hidden = true));
    hit.addEventListener('click', (event) => {
      const p = locate(event);
      if (p) onSelect(p.group.best.solution.angle);
    });
    g.append(hit);

    host.replaceChildren(svg);
  }

  return { render };
}
