// The protractor and match map side by side, with a shared toolbar: what to plot (spacing by
// default) and the maximum worst error. The maximum worst error is a filter (FR-011f), so it
// also narrows the list and is saved in the link.
import type { AngleTenths } from '../types.ts';
import { h } from '../ui/dom.ts';
import { createMatchMap, MEASURES, type ChartView, type MapMeasure } from './match-map.ts';
import { createProtractor } from './protractor-svg.ts';

export type ChartsView = Omit<ChartView, 'measure'> & { readonly maxWorstErrorLbu: number };

const BANDS = 5;

/** "All" plus the band edges below the tolerance, largest first: 0.20, 0.15, 0.10, 0.05 at 0.25. */
export function maxErrorChoices(toleranceLbu: number): { value: number; label: string }[] {
  const out = [{ value: 0, label: `All (≤ ${toleranceLbu.toFixed(2)})` }];
  if (toleranceLbu <= 0) return out;
  for (let b = BANDS - 1; b >= 1; b--) {
    const v = Number(((b * toleranceLbu) / BANDS).toFixed(4));
    out.push({ value: v, label: `≤ ${v.toFixed(2)}` });
  }
  return out;
}

export function createCharts(
  container: HTMLElement,
  onSelect: (angle: AngleTenths) => void,
  onMaxError: (maxWorstErrorLbu: number) => void,
) {
  const measureSelect = h('select', { id: 'chart-measure' }, ...MEASURES.map(([m, label]) => h('option', { value: m }, label)));
  const errorSelect = h('select', { id: 'chart-max-error' });
  const toolbar = h(
    'div',
    { class: 'charts-toolbar' },
    h('div', { class: 'map-measure' }, h('label', { for: 'chart-measure' }, 'Plot'), measureSelect),
    h('div', { class: 'map-measure' }, h('label', { for: 'chart-max-error' }, 'Worst error (LBU)'), errorSelect),
  );
  const protractorBox = h('div', { class: 'protractor' });
  const mapBox = h('div', { class: 'match-map' });
  container.append(toolbar, h('div', { class: 'charts' }, protractorBox, mapBox));
  const protractor = createProtractor(protractorBox, onSelect);
  const matchMap = createMatchMap(mapBox, onSelect);

  let measure: MapMeasure = 'spacing';
  let last: ChartsView | null = null;
  measureSelect.value = measure;
  measureSelect.addEventListener('change', () => {
    measure = measureSelect.value as MapMeasure;
    if (last) render(last);
  });
  errorSelect.addEventListener('change', () => onMaxError(Number(errorSelect.value)));

  function render(view: ChartsView) {
    last = view;
    const choices = maxErrorChoices(view.toleranceLbu);
    // Keep an off-list value (from a link or a changed tolerance) selectable.
    if (!choices.some((c) => c.value === view.maxWorstErrorLbu)) {
      choices.push({ value: view.maxWorstErrorLbu, label: `≤ ${view.maxWorstErrorLbu.toFixed(2)}` });
    }
    errorSelect.replaceChildren(...choices.map((c) => h('option', { value: c.value }, c.label)));
    errorSelect.value = String(view.maxWorstErrorLbu);
    const chartView: ChartView = { ...view, measure };
    protractor.render(chartView);
    matchMap.render(chartView);
  }

  return { render };
}
