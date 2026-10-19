// Notices: replaced link values (FR-025), over-budget fallback (FR-013), stale linked angle.
import { formatAngle } from '../geometry/units.ts';
import type { AngleTenths } from '../types.ts';
import { h } from './dom.ts';

export interface Notices {
  replaced(keys: string[]): void;
  overBudget(estimateMs: number, onSolveAngle: (angle: AngleTenths) => void): void;
  angleGone(angle: AngleTenths): void;
  error(message: string): void;
  clear(kind?: 'overBudget' | 'angleGone' | 'error'): void;
}

export function createNotices(container: HTMLElement): Notices {
  const show = (kind: string, ...children: (Node | string)[]) => {
    container.querySelector(`[data-kind="${kind}"]`)?.remove();
    const close = h('button', { type: 'button', 'aria-label': 'Dismiss' }, '×');
    const notice = h('div', { class: 'notice', 'data-kind': kind }, ...children, ' ', close);
    close.addEventListener('click', () => notice.remove());
    container.append(notice);
  };

  return {
    replaced(keys) {
      if (keys.length === 0) return;
      show('replaced', `Some link values were invalid and were replaced with defaults: ${keys.join(', ')}.`);
    },
    overBudget(estimateMs, onSolveAngle) {
      const input = h('input', { id: 'single-angle', type: 'number', min: 0.1, max: 89.9, step: 0.1, required: true });
      const form = h(
        'form',
        {},
        h('div', { class: 'field' }, h('label', { for: 'single-angle' }, 'Angle (°)'), input),
        h('button', { type: 'submit', class: 'primary' }, 'Solve this angle'),
      );
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const k = Math.round(Number(input.value) * 10);
        if (k >= 1 && k <= 899) onSolveAngle(k);
      });
      show(
        'overBudget',
        `Testing every angle for these surfaces would take about ${Math.round(estimateMs / 1000)} seconds, ` +
          'so it was stopped. The angles found so far are listed. To test one angle, enter it here.',
        form,
      );
    },
    angleGone(angle) {
      show('angleGone', `The selected angle ${formatAngle(angle)} doesn't qualify with these settings.`);
    },
    error(message) {
      show('error', `Something went wrong while solving: ${message}`);
    },
    clear(kind) {
      if (kind) container.querySelector(`[data-kind="${kind}"]`)?.remove();
      else container.replaceChildren();
    },
  };
}
