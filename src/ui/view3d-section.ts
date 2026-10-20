// The 3D view section (T055): loads three.js the first time a solution is selected, rebuilds the
// scene only when the build changes, and saves the current view as a PNG.
import { fileBase, save } from '../export/image.ts';
import { formatBuildAngle } from '../solver/group.ts';
import type { Build } from '../types.ts';
import type { View3d } from '../render/view3d.ts';
import { h } from './dom.ts';

export function createView3dSection(section: HTMLElement) {
  const heading = h('h2', {}, '3D view');
  const hint = h('p', { class: 'map-subtitle' }, 'Drag to turn, scroll to zoom, right-drag to move.');
  const canvasBox = h('div', { class: 'view3d-canvas', role: 'img', 'aria-label': '3D view of the build' });
  const saveButton = h('button', { type: 'button' }, 'Save view (PNG)');
  section.append(heading, hint, canvasBox, h('div', { class: 'drawing-downloads' }, saveButton));

  let view: Promise<View3d> | null = null;
  let shownKey = '';
  let current: { build: Build; preset: string } | null = null;

  saveButton.addEventListener('click', async () => {
    if (!view || !current) return;
    const blob = await (await view).savePng();
    if (blob) save(blob, `${fileBase(current.preset, current.build.buildDeg, '3d')}.png`);
  });

  function render(build: Build | null, preset: string, key: string) {
    section.hidden = build === null;
    if (!build) return;
    current = { build, preset };
    heading.textContent = `3D view at ${formatBuildAngle(build.buildDeg)}`;
    if (key === shownKey) return;
    shownKey = key;
    view ??= import('../render/view3d.ts').then((m) => m.createView3d(canvasBox));
    void view.then((v) => {
      // Only the latest build is shown if several arrive while three.js loads.
      if (shownKey === key) v.show(build);
    });
  }

  return { render };
}
