// A section the builder can fold away (<details>), remembered per browser. Storage can be
// unavailable (private windows, blocked site data), so every access is guarded.
import { h } from './dom.ts';

// v2: sections start collapsed; the new prefix lets that default apply over earlier choices.
const PREFIX = 'angle.open.v2.';

function remembered(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function remember(key: string, open: boolean): void {
  try {
    localStorage.setItem(PREFIX + key, open ? '1' : '0');
  } catch {
    // Not saved; the section still works.
  }
}

export interface Collapsible {
  readonly element: HTMLDetailsElement;
  readonly summary: HTMLElement;
  readonly body: HTMLDivElement;
}

export function collapsible(key: string, title: string, className = '', openByDefault = false): Collapsible {
  const summary = h('summary', {}, title);
  const body = h('div', { class: 'collapsible-body' });
  const element = h('details', { class: `collapsible ${className}`.trim() }, summary, body);
  element.open = remembered(key, openByDefault);
  element.addEventListener('toggle', () => remember(key, element.open));
  return { element, summary, body };
}
