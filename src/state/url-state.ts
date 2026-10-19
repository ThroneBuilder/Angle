// The design link (contracts/url-state.md; FR-024, FR-025). The link is the only place a
// design is saved, so this format is a public contract.
import { DEFAULT_MIN_SPACING, DEFAULT_TOLERANCE_LBU, SOLVE_TOLERANCE_LBU } from '../solver/constants.ts';
import { DEFAULT_PRESET, PRESETS, PRESET_IDS, type PresetId } from '../surfaces/presets.ts';
import { effectiveSteps, normalizeSpec, SURFACE_TYPES } from '../surfaces/surface-types.ts';
import { structuralMinimum, validateConfiguration } from '../surfaces/validate.ts';
import type { AngleTenths, Configuration, FilterSettings, SurfaceSpec, SurfaceTypeId } from '../types.ts';

export interface AppLinkState {
  readonly preset: PresetId | 'custom';
  readonly config: Configuration;
  readonly filters: FilterSettings;
  readonly trim: boolean;
  readonly angle: AngleTenths | null;
}

export const LINK_VERSION = 1;

function sameSurface(a: SurfaceSpec, b: SurfaceSpec): boolean {
  const sa = effectiveSteps(a);
  const sb = effectiveSteps(b);
  return (
    a.typeId === b.typeId &&
    a.sizeX === b.sizeX &&
    (a.sizeY ?? null) === (b.sizeY ?? null) &&
    sa.stepX === sb.stepX &&
    sa.stepY === sb.stepY
  );
}

export function matchesPreset(config: Configuration, id: PresetId): boolean {
  const preset = PRESETS[id].config;
  return sameSurface(config.top, preset.top) && sameSurface(config.bottom, preset.bottom);
}

/** `typeId:sizeX[xsizeY][@stepX[xstepY]]`; steps are written only when not the type's default. */
export function formatSurface(spec: SurfaceSpec): string {
  const s = normalizeSpec(spec);
  const size = s.sizeY === undefined ? `${s.sizeX}` : `${s.sizeX}x${s.sizeY}`;
  if (s.stepX === undefined && s.stepY === undefined) return `${s.typeId}:${size}`;
  const { stepX, stepY } = effectiveSteps(s);
  return SURFACE_TYPES[s.typeId].dimensions === 1 ? `${s.typeId}:${size}@${stepX}` : `${s.typeId}:${size}@${stepX}x${stepY}`;
}

function parseSurface(text: string | null): SurfaceSpec | null {
  if (!text) return null;
  const n = '(\\d+(?:\\.\\d+)?)';
  const m = new RegExp(`^([A-Za-z]+):${n}(?:x${n})?(?:@${n}(?:x${n})?)?$`).exec(text);
  if (!m) return null;
  const typeId = m[1] as SurfaceTypeId;
  const type = SURFACE_TYPES[typeId];
  if (!type) return null;
  const sizeX = Number(m[2]);
  const stepX = m[4] === undefined ? undefined : Number(m[4]);
  if (type.dimensions === 1) {
    if (m[3] !== undefined || m[5] !== undefined) return null;
    return normalizeSpec({ typeId, sizeX, ...(stepX === undefined ? {} : { stepX }) });
  }
  if (m[3] === undefined) return null;
  const stepY = m[5] === undefined ? undefined : Number(m[5]);
  if (stepX !== undefined && stepY === undefined) return null;
  return normalizeSpec({ typeId, sizeX, sizeY: Number(m[3]), ...(stepX === undefined ? {} : { stepX, stepY }) });
}

function parseNumber(text: string | null): number | null {
  if (text === null || text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Shortest decimal text for a number (no trailing zeros). */
function num(n: number): string {
  return String(Number(n.toFixed(4)));
}

export function readState(search: string): { state: AppLinkState; replaced: string[] } {
  const q = new URLSearchParams(search);
  const replaced: string[] = [];

  let presetId: PresetId = DEFAULT_PRESET;
  let custom = false;
  const presetText = q.get('preset');
  if (presetText === 'custom') {
    custom = true;
  } else if (presetText !== null) {
    if ((PRESET_IDS as string[]).includes(presetText)) presetId = presetText as PresetId;
    else replaced.push('preset');
  }
  const base = PRESETS[presetId];

  // Surfaces: each one falls back to the preset's if missing or invalid.
  const surface = (key: 'top' | 'bottom'): SurfaceSpec => {
    const text = q.get(key);
    if (text === null) return base.config[key];
    const parsed = parseSurface(text);
    // Check this surface alone, against the preset's other surface.
    const errors = parsed ? validateConfiguration({ ...base.config, [key]: parsed }) : ['unparsable'];
    const label = key === 'top' ? 'Top surface' : 'Bottom surface';
    const invalid = errors.some((e) => e === 'unparsable' || e.startsWith(label) || (key === 'bottom' && e.startsWith('The bottom')));
    if (!parsed || invalid) {
      replaced.push(key);
      return base.config[key];
    }
    return parsed;
  };
  const top = surface('top');
  const bottom = surface('bottom');
  const placeText = q.get('place');
  // Default placement follows the presets' rule: linear tops shifted, area tops centered.
  let placement = custom
    ? SURFACE_TYPES[top.typeId].dimensions === 1 ? ('shifted' as const) : ('centered' as const)
    : base.config.placement;
  if (placeText === 's') placement = 'shifted';
  else if (placeText === 'c') placement = 'centered';
  else if (placeText !== null) replaced.push('place');
  const config: Configuration = { top, bottom, placement };
  const matches = matchesPreset(config, presetId);
  const preset: PresetId | 'custom' = custom || !matches ? 'custom' : presetId;

  // Filters: preset defaults, or the structural minimum for a custom top.
  const minimum = structuralMinimum(SURFACE_TYPES[top.typeId]);
  const defaults: FilterSettings =
    preset === 'custom'
      ? { toleranceLbu: DEFAULT_TOLERANCE_LBU, minConnections: minimum, minSpacing: DEFAULT_MIN_SPACING, maxSpacing: 0 }
      : base.filters;

  let toleranceLbu = defaults.toleranceLbu;
  const tol = q.get('tol');
  if (tol !== null) {
    const v = parseNumber(tol);
    if (v !== null && v >= 0 && v <= SOLVE_TOLERANCE_LBU) toleranceLbu = v;
    else replaced.push('tol');
  }
  let minConnections = defaults.minConnections;
  const min = q.get('min');
  if (min !== null) {
    const v = parseNumber(min);
    if (v !== null && Number.isInteger(v) && v >= minimum) minConnections = v;
    else replaced.push('min');
  }
  const spacing = (key: 'smin' | 'smax', fallback: number): number => {
    const text = q.get(key);
    if (text === null) return fallback;
    const v = parseNumber(text);
    if (v !== null && v >= 0) return v;
    replaced.push(key);
    return fallback;
  };
  const minSpacing = spacing('smin', defaults.minSpacing);
  let maxSpacing = spacing('smax', defaults.maxSpacing);
  if (maxSpacing > 0 && maxSpacing < minSpacing) {
    replaced.push('smax');
    maxSpacing = defaults.maxSpacing;
  }
  let trim = false;
  const trimText = q.get('trim');
  if (trimText === '1') trim = true;
  else if (trimText !== null && trimText !== '0') replaced.push('trim');
  let angle: AngleTenths | null = null;
  const a = q.get('a');
  if (a !== null) {
    const v = parseNumber(a);
    if (v !== null && Number.isInteger(v) && v >= 1 && v <= 899) angle = v;
    else replaced.push('a');
  }

  return {
    state: { preset, config, filters: { toleranceLbu, minConnections, minSpacing, maxSpacing }, trim, angle },
    replaced,
  };
}

/** Keys always in the order v, preset, top, bottom, tol, place, min, smin, smax, trim, a. */
export function writeState(state: AppLinkState): string {
  const parts: [string, string][] = [['v', String(LINK_VERSION)]];
  const named = state.preset !== 'custom' && matchesPreset(state.config, state.preset);
  if (named) {
    parts.push(['preset', state.preset]);
  } else {
    parts.push(['preset', 'custom']);
    parts.push(['top', formatSurface(state.config.top)]);
    parts.push(['bottom', formatSurface(state.config.bottom)]);
  }
  parts.push(['tol', num(state.filters.toleranceLbu)]);
  parts.push(['place', state.config.placement === 'shifted' ? 's' : 'c']);
  parts.push(['min', String(state.filters.minConnections)]);
  parts.push(['smin', num(state.filters.minSpacing)]);
  parts.push(['smax', num(state.filters.maxSpacing)]);
  parts.push(['trim', state.trim ? '1' : '0']);
  if (state.angle !== null) parts.push(['a', String(state.angle)]);
  return '?' + parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}
