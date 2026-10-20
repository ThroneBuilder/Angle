// Qualifying solutions as a keyboard-operable list (T032; FR-010, FR-011b, FR-011c, FR-014,
// FR-015, FR-023). Each row is one solution: every input angle that builds the same angle.
import { formatAngle } from '../geometry/units.ts';
import type { FilteredAngle } from '../solver/filter.ts';
import { formatBuildAngle, groupOf, type SolutionGroup } from '../solver/group.ts';
import type { AngleTenths } from '../types.ts';
import { h } from './dom.ts';
import { holes, spanOf, type LinearSteps } from './span.ts';

export interface AngleListView {
  readonly settings: string;
  /** Bottom grid steps in LBU when the top is linear; enables the dx/dy columns. */
  readonly linear: LinearSteps | null;
  readonly progress: { done: number; total: number } | null;
  readonly groups: readonly SolutionGroup[] | null;
  readonly selected: AngleTenths | null;
  readonly shifted: boolean;
  readonly toleranceLbu: number;
  /** Center the selected row (selection came from a chart) instead of scrolling it just into view. */
  readonly centerSelection: boolean;
}

export interface AngleList {
  render(view: AngleListView): void;
}

const fmt = (n: number, digits = 3) => n.toFixed(digits);

export function createAngleList(
  container: HTMLElement,
  onSelect: (angle: AngleTenths) => void,
  onCancel: () => void,
): AngleList {
  const settings = h('p', { class: 'settings-line' });
  const status = h('div', { class: 'status-row' });
  const listbox = h('div', { role: 'listbox', tabindex: 0, 'aria-label': 'Qualifying solutions' });
  const wrap = h('div', { class: 'angle-table-wrap' }, listbox);
  const detail = h('div', { class: 'detail' });
  container.append(settings, status, wrap, detail);

  let current: AngleListView | null = null;
  let renderedKey = '';
  let scrolledTo = '';

  /** Scroll only the list's own box (never the page): center the row, or bring it just into view. */
  function scrollRow(row: HTMLElement, center: boolean) {
    const box = wrap.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const header = listbox.firstElementChild?.getBoundingClientRect().height ?? 0;
    if (center) {
      wrap.scrollTop += r.top - box.top - (wrap.clientHeight - r.height + header) / 2;
    } else if (r.top < box.top + header) {
      wrap.scrollTop -= box.top + header - r.top;
    } else if (r.bottom > box.bottom) {
      wrap.scrollTop += r.bottom - box.bottom;
    }
  }

  const move = (delta: number | 'home' | 'end') => {
    const groups = current?.groups;
    if (!groups || groups.length === 0) return;
    const selected = groupOf(groups, current?.selected ?? null);
    const index = selected ? groups.indexOf(selected) : -1;
    let next: number;
    if (delta === 'home') next = 0;
    else if (delta === 'end') next = groups.length - 1;
    else next = index < 0 ? 0 : Math.max(0, Math.min(groups.length - 1, index + delta));
    onSelect(groups[next]!.best.solution.angle);
  };
  listbox.addEventListener('keydown', (event) => {
    const keys: Record<string, number | 'home' | 'end'> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 10,
      PageUp: -10,
      Home: 'home',
      End: 'end',
    };
    const delta = keys[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      move(delta);
    } else if (event.key === 'Enter' && current?.selected === null) {
      event.preventDefault();
      move(0);
    }
  });

  // The focus ring on the selected row follows keyboard focus on the list.
  listbox.addEventListener('focus', () => current && renderSelection(current));
  listbox.addEventListener('blur', () => current && renderSelection(current));

  const rowId = (g: SolutionGroup) => `solution-${g.best.solution.angle}`;

  function renderRows(view: AngleListView) {
    const groups = view.groups ?? [];
    const linear = view.linear;
    const rowClass = linear ? 'angle-row linear' : 'angle-row';
    const header = h(
      'div',
      { class: `${rowClass} header`, 'aria-hidden': 'true' },
      h('span', { title: 'The angle the build makes' }, 'Angle'),
      h('span', {}, 'Links'),
      h('span', {}, 'Worst'),
      h('span', { title: 'Smallest distance between any two connected points' }, 'Spacing'),
      h('span', { title: 'Largest distance between any two connected points' }, 'Span'),
      linear && h('span', { title: 'Studs across, first to last connected hole' }, 'dx'),
      linear && h('span', { title: linear.yUnitLbu === 12 ? 'Bricks up (.3 = 1 plate, .7 = 2 plates)' : 'Studs up' }, 'dy'),
      linear && h('span', { title: 'Straight-line distance in holes' }, 'Length'),
      h('span', {}, view.shifted ? 'Offset (LBU)' : ''),
    );
    const rows = groups.map((g) => {
      const a = g.best;
      const k = a.solution.angle;
      const { offsetX, offsetY } = a.solution.placement;
      const shiftedText = offsetX === 0 && offsetY === 0 ? 'centered' : `${fmt(offsetX, 2)}, ${fmt(offsetY, 2)}`;
      const span = linear ? spanOf(a, linear) : null;
      const spanLabel = span && a.spanLbu !== null ? `, span ${holes(a.spanLbu)}, dx ${fmt(span.dx, 1)} dy ${fmt(span.dy, 1)}` : '';
      const angleText = formatBuildAngle(g.buildDeg);
      const row = h(
        'div',
        {
          class: rowClass,
          role: 'option',
          id: rowId(g),
          'aria-selected': 'false',
          'aria-label':
            `${angleText}, ${a.kept.length} connections, worst error ${fmt(a.shownWorstErrorLbu)} LBU` +
            `${a.spacingLbu !== null ? `, spacing ${holes(a.spacingLbu)}` : ''}${spanLabel}`,
        },
        h('span', {}, angleText),
        h('span', {}, String(a.kept.length)),
        h('span', {}, fmt(a.shownWorstErrorLbu)),
        h('span', {}, a.spacingLbu !== null ? holes(a.spacingLbu) : ''),
        h('span', {}, a.spanLbu !== null ? holes(a.spanLbu) : ''),
        linear && h('span', {}, span ? fmt(span.dx, 1) : ''),
        linear && h('span', {}, span ? fmt(span.dy, 1) : ''),
        linear && h('span', {}, span ? fmt(span.length, 3) : ''),
        h('span', {}, view.shifted ? shiftedText : ''),
      );
      row.addEventListener('click', () => onSelect(k));
      return row;
    });
    listbox.replaceChildren(header, ...rows);
  }

  function renderSelection(view: AngleListView) {
    const selected = groupOf(view.groups ?? [], view.selected);
    const selectedId = selected ? rowId(selected) : '';
    for (const row of listbox.querySelectorAll<HTMLElement>('[role="option"]')) {
      const on = row.id === selectedId;
      row.setAttribute('aria-selected', String(on));
      row.classList.toggle('active', on && document.activeElement === listbox);
    }
    if (!selected) {
      listbox.removeAttribute('aria-activedescendant');
    } else {
      listbox.setAttribute('aria-activedescendant', selectedId);
      // Scroll only when the selection changes, so later re-renders don't fight the builder's scrolling.
      const row = document.getElementById(selectedId);
      if (row && selectedId !== scrolledTo) scrollRow(row, view.centerSelection);
    }
    scrolledTo = selected ? selectedId : '';
  }

  function renderDetail(view: AngleListView) {
    const group = groupOf(view.groups ?? [], view.selected);
    // A linked angle inside a group is shown as itself; otherwise the group's best angle.
    const chosen = group?.members.find((m) => m.solution.angle === view.selected) ?? group?.best;
    if (!group || !chosen) {
      detail.replaceChildren();
      return;
    }
    const { offsetX, offsetY } = chosen.solution.placement;
    const pos = (i: number, j: number) => `column ${i + 1}, row ${j + 1}`;
    const solvedAt = group.members.map((m) => formatAngle(m.solution.angle));
    const notes = [
      h(
        'p',
        {},
        `Solved at ${solvedAt.length === 1 ? solvedAt[0] : `${solvedAt.length} input angles (${solvedAt.join(', ')})`}; ` +
          `showing ${formatAngle(chosen.solution.angle)}.`,
      ),
      offsetX !== 0 || offsetY !== 0
        ? h('p', {}, `Top surface shifted by ${fmt(offsetX)}, ${fmt(offsetY)} LBU from centered.`)
        : null,
    ].filter((n): n is HTMLParagraphElement => n !== null);
    detail.replaceChildren(
      h('h3', {}, `${formatBuildAngle(group.buildDeg)}: ${chosen.kept.length} connections`),
      ...notes,
      h(
        'table',
        { class: 'connections' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Top point'), h('th', {}, 'Bottom point'), h('th', {}, 'Error (LBU)'))),
        h(
          'tbody',
          {},
          ...chosen.kept.map((c) =>
            h('tr', {}, h('td', {}, pos(c.top.i, c.top.j)), h('td', {}, pos(c.bottom.i, c.bottom.j)), h('td', {}, fmt(c.errorLbu))),
          ),
        ),
      ),
    );
  }

  function renderStatus(view: AngleListView) {
    const items: (Node | string)[] = [];
    if (view.progress) {
      items.push(
        h('progress', { max: view.progress.total, value: view.progress.done, 'aria-label': 'Solving' }),
        `${view.progress.done} / ${view.progress.total}`,
        h('button', { type: 'button', onclick: () => onCancel() }, 'Cancel'),
      );
    }
    if (view.groups) {
      const n = view.groups.length;
      const angles = view.groups.reduce((sum, g) => sum + g.members.length, 0);
      items.push(
        h(
          'span',
          { class: 'qualifying-count' },
          `${n} ${n === 1 ? 'solution' : 'solutions'} (${angles} input ${angles === 1 ? 'angle' : 'angles'})`,
        ),
      );
    }
    status.replaceChildren(...items);
    if (view.groups && view.groups.length === 0 && !view.progress) {
      const zero = view.toleranceLbu === 0
        ? ' With a tolerance of 0 only exact matches count, and at 0.1° steps they are rare.'
        : '';
      status.append(
        h(
          'p',
          { class: 'empty' },
          `No angle qualifies with these filters. Try a larger tolerance, fewer minimum connections, or a smaller minimum spacing.${zero}`,
        ),
      );
    }
  }

  return {
    render(view) {
      settings.textContent = view.settings;
      renderStatus(view);
      const key =
        `${view.groups?.map((g) => `${g.from}-${g.to}:${g.best.solution.angle}:${g.best.kept.length}:${g.best.shownWorstErrorLbu}`).join(',')}` +
        `|${view.shifted}|${view.linear !== null}`;
      if (key !== renderedKey) {
        renderRows(view);
        renderedKey = key;
      }
      current = view;
      renderSelection(view);
      renderDetail(view);
    },
  };
}
