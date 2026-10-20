// Wires link state, controls, the solver worker, and the angle list together (T034).
import { SolverClient } from './solver/client.ts';
import { qualifyingAngles } from './solver/filter.ts';
import { groupSolutions, type SolutionGroup } from './solver/group.ts';
import { toSolverInput } from './solver/grid.ts';
import { readState, writeState, matchesPreset, type AppLinkState } from './state/url-state.ts';
import { PRESETS } from './surfaces/presets.ts';
import { effectiveSteps, SURFACE_TYPES } from './surfaces/surface-types.ts';
import { structuralMinimum, validateConfiguration, validateFilters } from './surfaces/validate.ts';
import type { AngleTenths, Configuration, FilterSettings, SolveResult, SurfaceSpec } from './types.ts';
import { createCharts } from './render/charts.ts';
import { makeBuild } from './build/build.ts';
import { CATALOG } from './catalog/catalog.ts';
import { groupOf } from './solver/group.ts';
import { createAngleList } from './ui/angle-list.ts';
import { createDrawings } from './ui/drawings.ts';
import type { LinearSteps } from './ui/span.ts';
import { createControls } from './ui/controls.ts';
import { createNotices } from './ui/notices.ts';

const initial = readState(location.search);
let state: AppLinkState = initial.state;
let result: SolveResult | null = null;
let progress: { done: number; total: number } | null = null;
let filterErrors: string[] = [];
let groups: SolutionGroup[] | null = null;

const notices = createNotices(document.getElementById('notices')!);
const client = new SolverClient();
/** True when the next selection came from a chart, so the list centers that row. */
let centerNext = false;
const charts = createCharts(
  document.getElementById('charts')!,
  (angle) => {
    centerNext = true;
    select(angle);
  },
  (maxWorstErrorLbu) => update({ ...state, filters: { ...state.filters, maxWorstErrorLbu } }, false),
);

const controls = createControls(document.getElementById('controls')!, {
  preset(id) {
    if (id === 'custom') {
      update({ ...state, preset: 'custom' }, false);
    } else {
      update({ ...state, preset: id, config: PRESETS[id].config, filters: PRESETS[id].filters, angle: null }, true);
    }
  },
  surface(which, spec) {
    const config: Configuration = { ...state.config, [which]: spec };
    const preset = state.preset !== 'custom' && matchesPreset(config, state.preset) ? state.preset : 'custom';
    const minimum = structuralMinimum(SURFACE_TYPES[config.top.typeId]);
    const filters = { ...state.filters, minConnections: Math.max(state.filters.minConnections, minimum) };
    update({ ...state, preset, config, filters, angle: null }, true);
  },
  placement(mode) {
    update({ ...state, config: { ...state.config, placement: mode }, angle: null }, true);
  },
  filters(filters: FilterSettings) {
    filterErrors = validateFilters(filters, SURFACE_TYPES[state.config.top.typeId]);
    if (filterErrors.length > 0) {
      render();
      return;
    }
    update({ ...state, filters }, false);
  },
  trim(on) {
    update({ ...state, trim: on }, false);
  },
});

const drawings = createDrawings(document.getElementById('drawings')!);

const list = createAngleList(
  document.getElementById('angle-list')!,
  (angle) => select(angle),
  () => {
    client.cancel();
    progress = null;
    render();
  },
);

client.onUpdate((update) => {
  switch (update.kind) {
    case 'progress':
      progress = { done: update.done, total: update.total };
      render();
      break;
    case 'result':
      progress = null;
      result = update.result;
      refilter();
      render();
      break;
    case 'overBudget':
      progress = null;
      result = update.partial;
      refilter();
      notices.overBudget(update.estimateMs, (angle) => {
        notices.clear('overBudget');
        state = { ...state, angle };
        progress = { done: 0, total: 1 };
        client.startSingle(state.config, angle);
        render();
      });
      render();
      break;
    case 'error':
      progress = null;
      notices.error(update.message);
      render();
      break;
  }
});

function describe(spec: SurfaceSpec): string {
  const two = spec.sizeY !== undefined;
  const { stepX, stepY } = effectiveSteps(spec);
  const size = two ? `${spec.sizeX}×${spec.sizeY}` : `${spec.sizeX}`;
  const steps = two ? `${stepX}×${stepY}` : `${stepX}`;
  return `${SURFACE_TYPES[spec.typeId].name} ${size} (step ${steps})`;
}

/** One-line statement of the current settings (FR-023). */
function settingsLine(s: AppLinkState): string {
  const f = s.filters;
  return [
    `${describe(s.config.top)} on ${describe(s.config.bottom)}`,
    s.config.placement,
    `tol ${f.toleranceLbu}`,
    `min ${f.minConnections}`,
    `spacing ${f.minSpacing}–${f.maxSpacing > 0 ? f.maxSpacing : 'any'}`,
    ...(f.maxWorstErrorLbu > 0 ? [`max error ${f.maxWorstErrorLbu}`] : []),
    ...(f.tessellatedOnly ? ['tessellated only'] : []),
  ].join(' · ');
}

/** Re-apply filters to the stored result; never re-solves (FR-008, FR-011). */
function refilter(): void {
  if (!result) {
    groups = null;
    return;
  }
  const input = toSolverInput(state.config);
  const qualifying = qualifyingAngles(result, state.filters, input);
  groups = groupSolutions(qualifying, input);
  if (state.angle !== null && result.complete && !qualifying.some((q) => q.solution.angle === state.angle)) {
    notices.angleGone(state.angle);
    state = { ...state, angle: null };
    history.replaceState(null, '', writeState(state));
  }
}

function update(next: AppLinkState, resolve: boolean): void {
  state = next;
  filterErrors = [];
  history.replaceState(null, '', writeState(state));
  if (resolve) {
    notices.clear('overBudget');
    notices.clear('angleGone');
    result = null;
    groups = null;
    if (validateConfiguration(state.config).length === 0) {
      progress = { done: 0, total: 899 };
      client.start(state.config);
    } else {
      client.cancel();
      progress = null;
    }
  } else {
    refilter();
  }
  render();
}

function select(angle: AngleTenths): void {
  if (angle === state.angle) return;
  notices.clear('angleGone');
  state = { ...state, angle };
  history.pushState(null, '', writeState(state));
  render();
}

function render(): void {
  controls.sync(state, validateConfiguration(state.config), filterErrors);
  const input = toSolverInput(state.config);
  const linear: LinearSteps | null =
    input.top.dimensions === 1
      ? {
          stepX: input.bottom.stepX,
          stepY: input.bottom.stepY,
          // Walls are seen from the side, so their Y runs in bricks; plates run in studs both ways.
          yUnitLbu: SURFACE_TYPES[state.config.bottom.typeId].view === 'side' ? 12 : 10,
        }
      : null;
  const unitLabel = SURFACE_TYPES[state.config.top.typeId].countX.plural;
  charts.render({
    groups,
    selected: state.angle,
    toleranceLbu: state.filters.toleranceLbu,
    maxWorstErrorLbu: state.filters.maxWorstErrorLbu,
    linear,
    unitLabel,
  });
  const group = groupOf(groups ?? [], state.angle);
  const chosen = group?.members.find((m) => m.solution.angle === state.angle) ?? group?.best;
  drawings.render(
    group && chosen
      ? makeBuild({
          solution: chosen,
          buildDeg: group.buildDeg,
          config: state.config,
          filters: state.filters,
          options: { trimToConnections: state.trim },
          catalog: CATALOG,
        })
      : null,
    state.preset,
  );
  list.render({
    settings: settingsLine(state),
    linear,
    progress,
    groups,
    selected: state.angle,
    shifted: state.config.placement === 'shifted',
    toleranceLbu: state.filters.toleranceLbu,
    centerSelection: centerNext,
  });
  centerNext = false;
}

window.addEventListener('popstate', () => {
  const previous = JSON.stringify(state.config);
  const next = readState(location.search).state;
  update(next, JSON.stringify(next.config) !== previous);
});

notices.replaced(initial.replaced);
history.replaceState(null, '', writeState(state));
update(state, true);
