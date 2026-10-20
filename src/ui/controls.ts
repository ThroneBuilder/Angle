// Surface, placement, and filter controls (T031; FR-001–FR-005, FR-008, FR-011).
import { SOLVE_TOLERANCE_LBU } from '../solver/constants.ts';
import { PRESETS, PRESET_IDS, type PresetId } from '../surfaces/presets.ts';
import { effectiveSteps, normalizeSpec, sizeChoices, SURFACE_TYPES, SURFACE_TYPE_IDS } from '../surfaces/surface-types.ts';
import { structuralMinimum } from '../surfaces/validate.ts';
import type { AppLinkState } from '../state/url-state.ts';
import type { FilterSettings, PlacementMode, StepChoice, SurfaceSpec, SurfaceTypeId, UnitCount } from '../types.ts';
import { collapsible } from './collapsible.ts';
import { h } from './dom.ts';

export interface ControlEvents {
  preset(id: PresetId | 'custom'): void;
  surface(which: 'top' | 'bottom', spec: SurfaceSpec): void;
  placement(mode: PlacementMode): void;
  filters(filters: FilterSettings): void;
  trim(on: boolean): void;
}

export interface Controls {
  sync(state: AppLinkState, configErrors: string[], filterErrors: string[]): void;
}

function defaultSpec(typeId: SurfaceTypeId): SurfaceSpec {
  const t = SURFACE_TYPES[typeId];
  return t.dimensions === 1 ? { typeId, sizeX: t.maxX } : { typeId, sizeX: t.maxX, sizeY: t.maxY ?? t.maxX };
}

/** Fill a size select with whole-unit choices, keeping an off-list size (from a link) selectable. */
function fillSizes(select: HTMLSelectElement, count: UnitCount, value: number) {
  const choices = sizeChoices(count);
  const options = choices.map((c) => h('option', { value: c.lbu }, c.label));
  if (!choices.some((c) => c.lbu === value)) options.push(h('option', { value }, `${value} LBU`));
  select.replaceChildren(...options);
  select.value = String(value);
}

function fillSteps(select: HTMLSelectElement, choices: readonly StepChoice[], value: number) {
  select.replaceChildren(...choices.map((c) => h('option', { value: c.lbu }, c.label)));
  select.value = String(value);
  select.disabled = choices.length < 2;
}

function surfaceFieldset(which: 'top' | 'bottom', events: ControlEvents) {
  const label = which === 'top' ? 'Top surface' : 'Bottom surface';
  const types = SURFACE_TYPE_IDS.filter((id) =>
    which === 'top' ? SURFACE_TYPES[id].canBeTop : SURFACE_TYPES[id].dimensions === 2,
  );
  const id = (part: string) => `${which}-${part}`;
  const typeSelect = h('select', { id: id('type') }, ...types.map((t) => h('option', { value: t }, SURFACE_TYPES[t].name)));
  const sizeX = h('select', { id: id('x') });
  const stepX = h('select', { id: id('step-x') });
  const sizeY = h('select', { id: id('y') });
  const stepY = h('select', { id: id('step-y') });
  const field = (forId: string, text: string, control: HTMLElement) =>
    h('div', { class: 'field' }, h('label', { for: forId }, text), control);
  const heightRow = h('div', { class: 'field-row' }, field(id('y'), 'Height max', sizeY), field(id('step-y'), 'Height step', stepY));

  const read = (): SurfaceSpec => {
    const typeId = typeSelect.value as SurfaceTypeId;
    const two = SURFACE_TYPES[typeId].dimensions === 2;
    return normalizeSpec({
      typeId,
      sizeX: Number(sizeX.value),
      stepX: Number(stepX.value),
      ...(two ? { sizeY: Number(sizeY.value), stepY: Number(stepY.value) } : {}),
    });
  };
  typeSelect.addEventListener('change', () => events.surface(which, defaultSpec(typeSelect.value as SurfaceTypeId)));
  for (const select of [sizeX, stepX, sizeY, stepY]) {
    select.addEventListener('change', () => events.surface(which, read()));
  }

  // Foldable, remembered per browser; the heading summarizes the surface when folded.
  const panel = collapsible(`surface-def-${which}`, label, 'surface-def');
  panel.body.append(
    field(id('type'), 'Type', typeSelect),
    h('div', { class: 'field-row' }, field(id('x'), 'Width max', sizeX), field(id('step-x'), 'Width step', stepX)),
    heightRow,
  );
  const fieldset = panel.element;

  const sync = (spec: SurfaceSpec) => {
    const type = SURFACE_TYPES[spec.typeId];
    const steps = effectiveSteps(spec);
    const size = spec.sizeY === undefined ? `${spec.sizeX}` : `${spec.sizeX}×${spec.sizeY}`;
    panel.summary.textContent = `${label}: ${type.name}, ${size} LBU`;
    typeSelect.value = spec.typeId;
    fillSizes(sizeX, type.countX, spec.sizeX);
    fillSteps(stepX, type.stepChoicesX, steps.stepX);
    heightRow.hidden = type.dimensions === 1;
    if (type.dimensions === 2 && type.countY && type.stepChoicesY) {
      fillSizes(sizeY, type.countY, spec.sizeY ?? sizeChoices(type.countY).at(-1)!.lbu);
      fillSteps(stepY, type.stepChoicesY, steps.stepY);
    }
  };
  return { fieldset, sync };
}

export function createControls(container: HTMLElement, events: ControlEvents): Controls {
  const presetSelect = h(
    'select',
    { id: 'preset' },
    ...PRESET_IDS.map((id) => h('option', { value: id }, PRESETS[id].name)),
    h('option', { value: 'custom' }, 'Custom'),
  );
  presetSelect.addEventListener('change', () => events.preset(presetSelect.value as PresetId | 'custom'));

  const top = surfaceFieldset('top', events);
  const bottom = surfaceFieldset('bottom', events);
  const configErrors = h('ul', { class: 'errors', role: 'alert' });

  // Checked = shifted placement: the top may shift so connections need not be centered (slower).
  const imperfect = h('input', { type: 'checkbox', id: 'allow-imperfect' });
  imperfect.addEventListener('change', () => events.placement(imperfect.checked ? 'shifted' : 'centered'));

  const tolerance = h('input', { id: 'tol', type: 'number', min: 0, max: SOLVE_TOLERANCE_LBU, step: 0.05 });
  const minConnections = h('input', { id: 'min', type: 'number', step: 1 });
  const minSpacing = h('input', { id: 'smin', type: 'number', min: 0, step: 1 });
  const maxSpacing = h('input', { id: 'smax', type: 'number', min: 0, step: 1 });
  const spacingUnit = h('span', {});
  const spacingUnit2 = h('span', {});
  const filterErrors = h('ul', { class: 'errors', role: 'alert' });
  const tessellated = h('input', { type: 'checkbox', id: 'tess' });
  tessellated.addEventListener('change', () => events.filters(readFilters()));
  const trim = h('input', { type: 'checkbox', id: 'trim' });
  trim.addEventListener('change', () => events.trim(trim.checked));
  // The maximum worst error is set from the charts toolbar; carry its current value through.
  let maxWorstErrorLbu = 0;
  const readFilters = (): FilterSettings => ({
    toleranceLbu: Number(tolerance.value),
    minConnections: Number(minConnections.value),
    minSpacing: Number(minSpacing.value),
    maxSpacing: Number(maxSpacing.value),
    maxWorstErrorLbu,
    tessellatedOnly: tessellated.checked,
  });
  for (const input of [tolerance, minConnections, minSpacing, maxSpacing]) {
    input.addEventListener('input', () => events.filters(readFilters()));
  }

  const spacingRow = h(
    'div',
    { class: 'field-row' },
    h('div', { class: 'field' }, h('label', { for: 'smin' }, 'Min. spacing (', spacingUnit, ')'), minSpacing),
    h('div', { class: 'field' }, h('label', { for: 'smax', title: '0 = no limit' }, 'Max. spacing (', spacingUnit2, ')'), maxSpacing),
  );

  // Filters, placement, and trimming together; foldable, with a one-line summary when folded.
  const filtersPanel = collapsible('filters', 'Filters', 'surface-def');
  const check = (input: HTMLInputElement, id: string, text: string, title: string) =>
    h('label', { for: id, title, class: 'check' }, input, text);
  filtersPanel.body.append(
    h('div', { class: 'field' }, h('label', { for: 'tol' }, `Tolerance per pin (LBU, 0–${SOLVE_TOLERANCE_LBU})`), tolerance),
    h('div', { class: 'field' }, h('label', { for: 'min' }, 'Min. connections'), minConnections),
    spacingRow,
    h(
      'div',
      { class: 'check-list' },
      check(imperfect, 'allow-imperfect', 'Allow all imperfect', 'Shift the top surface off center to find more solutions (slower)'),
      check(tessellated, 'tess', 'Trim tessellated connections', 'Keep only connections in the repeating pattern; drop one-off connections'),
      check(trim, 'trim', 'Trim to connections', 'Shrink each built surface to whole units around its connections'),
    ),
    filterErrors,
  );

  container.append(
    h('div', { class: 'field' }, h('label', { for: 'preset' }, 'Preset'), presetSelect),
    top.fieldset,
    bottom.fieldset,
    configErrors,
    filtersPanel.element,
  );

  const setErrors = (list: HTMLUListElement, errors: string[]) => {
    list.replaceChildren(...errors.map((e) => h('li', {}, e)));
  };
  const setIfIdle = (input: HTMLInputElement, value: string) => {
    // Don't rewrite a field the builder is typing in.
    if (document.activeElement !== input) input.value = value;
  };

  return {
    sync(state, cErrors, fErrors) {
      maxWorstErrorLbu = state.filters.maxWorstErrorLbu;
      trim.checked = state.trim;
      tessellated.checked = state.filters.tessellatedOnly;
      presetSelect.value = state.preset;
      top.sync(state.config.top);
      bottom.sync(state.config.bottom);
      imperfect.checked = state.config.placement === 'shifted';
      const topType = SURFACE_TYPES[state.config.top.typeId];

      spacingUnit.textContent = topType.countX.plural;
      spacingUnit2.textContent = topType.countX.plural;
      const spacingStep = String(effectiveSteps(state.config.top).stepX / 10);
      minSpacing.step = spacingStep;
      maxSpacing.step = spacingStep;
      setIfIdle(tolerance, String(state.filters.toleranceLbu));
      setIfIdle(minConnections, String(state.filters.minConnections));
      setIfIdle(minSpacing, String(state.filters.minSpacing));
      setIfIdle(maxSpacing, String(state.filters.maxSpacing));
      minConnections.min = String(structuralMinimum(topType));
      setErrors(configErrors, cErrors);
      setErrors(filterErrors, fErrors);
      const f = state.filters;
      filtersPanel.summary.textContent = [
        'Filters',
        `tol ${f.toleranceLbu}`,
        `min ${f.minConnections}`,
        `spacing ${f.minSpacing}–${f.maxSpacing > 0 ? f.maxSpacing : 'any'}`,
        ...(state.config.placement === 'shifted' ? ['imperfect'] : []),
        ...(f.tessellatedOnly ? ['tessellated'] : []),
        ...(state.trim ? ['trimmed'] : []),
      ].join(' · ');
    },
  };
}
