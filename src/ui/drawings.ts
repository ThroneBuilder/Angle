// The Surfaces section (T050): both drawings for the selected solution, with downloads and any
// build warnings.
import { downloadPng, downloadSvg, fileBase } from '../export/image.ts';
import { formatBuildAngle } from '../solver/group.ts';
import { renderSurface } from '../render/surface-svg.ts';
import type { Build } from '../types.ts';
import { h } from './dom.ts';

export function createDrawings(section: HTMLElement) {
  const heading = h('h2', {}, 'Surfaces');
  const warnings = h('ul', { class: 'build-warnings' });
  const figures = h('div', { class: 'drawings' });
  section.append(heading, warnings, figures);

  function render(build: Build | null, preset: string) {
    section.hidden = build === null;
    if (!build) return;
    heading.textContent = `Surfaces at ${formatBuildAngle(build.buildDeg)}`;
    warnings.replaceChildren(...build.warnings.map((w) => h('li', {}, w)));
    figures.replaceChildren(
      ...(['bottom', 'top'] as const).map((which) => {
        const { svg, title } = renderSurface(build, which);
        const name = fileBase(preset, build.buildDeg, which);
        return h(
          'figure',
          { class: 'drawing' },
          h('figcaption', {}, title),
          h('div', { class: 'drawing-plot' }, svg),
          h(
            'div',
            { class: 'drawing-downloads' },
            h('button', { type: 'button', onclick: () => void downloadPng(svg, name) }, 'PNG'),
            h('button', { type: 'button', onclick: () => downloadSvg(svg, name) }, 'SVG'),
          ),
        );
      }),
    );
  }

  return { render };
}
