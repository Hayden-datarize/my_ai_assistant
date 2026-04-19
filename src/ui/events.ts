/**
 * Typed CustomEvent map — single source of truth for DOM-level pub/sub between
 * tabs (dispatchers in src/ui/tabs/*.ts) and handlers (listeners in src/ui/handlers/*.ts).
 *
 * Dispatch target is `document` to match the existing v3.0 tab dispatchers.
 * Handler-rendered DOM (e.g. dynamically created cards, heatmap cells) uses
 * direct `element.addEventListener(...)` and does NOT flow through this map.
 *
 * Phase G scope: event names cover all 16 dispatches currently emitted by
 * src/ui/tabs/*.ts. v3.1 MVP wires 10 of them; the remaining 6 are deferred
 * to v3.2 (their handlers in v3.1 are stubs that show a "준비 중" toast).
 */

export interface EventMap {
  // home (11) — matches tabs/home.ts exactly
  'dg:home:toggle-theme': undefined;
  'dg:home:export-data': undefined;
  'dg:home:dismiss-backup': undefined;
  'dg:home:switch-tab': { tab: string };
  'dg:home:refresh-briefings': undefined;
  'dg:home:update-char-count': undefined;
  'dg:home:toggle-hint': undefined;
  'dg:home:submit-answer': undefined;
  'dg:home:send-chat': undefined;
  'dg:home:summarize-chat': undefined;
  'dg:home:generate-insight-card': undefined;
  // archive (3) — matches tabs/archive.ts exactly
  'dg:archive:search': undefined;
  'dg:archive:period-change': undefined;
  'dg:archive:filter': { filter: string };
  // stats (2) — matches tabs/stats.ts exactly
  'dg:stats:weekly-report': undefined;
  'dg:stats:growth-analysis': undefined;
  // nav (1) — dispatched by nav.ts after a tab is switched-to; consumed by
  // handlers/* to hydrate their own tab's dynamic content.
  'dg:nav:tab-changed': { tab: string };
}

type EventName = keyof EventMap;

export function dispatch<K extends EventName>(name: K, detail: EventMap[K]): void {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends EventName>(
  name: K,
  handler: (detail: EventMap[K]) => void,
): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail);
  document.addEventListener(name, wrapped);
  return () => document.removeEventListener(name, wrapped);
}

export const EVENT_NAMES: readonly EventName[] = [
  'dg:home:toggle-theme', 'dg:home:export-data', 'dg:home:dismiss-backup',
  'dg:home:switch-tab', 'dg:home:refresh-briefings', 'dg:home:update-char-count',
  'dg:home:toggle-hint', 'dg:home:submit-answer', 'dg:home:send-chat',
  'dg:home:summarize-chat', 'dg:home:generate-insight-card',
  'dg:archive:search', 'dg:archive:period-change', 'dg:archive:filter',
  'dg:stats:weekly-report', 'dg:stats:growth-analysis',
  'dg:nav:tab-changed',
] as const;

/** Events deferred to v3.2 — handlers in v3.1 register a stub listener. */
export const V32_DEFERRED_EVENTS: readonly EventName[] = [
  'dg:home:dismiss-backup',
  'dg:home:summarize-chat',
  'dg:home:generate-insight-card',
  'dg:archive:period-change',
  'dg:stats:weekly-report',
  'dg:stats:growth-analysis',
] as const;
