export interface EventMap {
  // home (11)
  'dg:home:refresh-briefings': undefined;
  'dg:home:toggle-scrap': { index: number };
  'dg:home:mark-read': { index: number };
  'dg:home:toggle-memo': { index: number };
  'dg:home:save-memo': { index: number; memo: string };
  'dg:home:toggle-hint': undefined;
  'dg:home:submit-answer': { text: string };
  'dg:home:chat-send': { text: string };
  'dg:home:open-api-key-modal': undefined;
  'dg:home:reload-question': undefined;
  'dg:home:char-count-change': { length: number };
  // archive (3)
  'dg:archive:filter': { filter: string };
  'dg:archive:search': { query: string };
  'dg:archive:open-detail': { date: string };
  // stats (2)
  'dg:stats:open-day-detail': { date: string };
  'dg:stats:refresh': undefined;
}

type EventName = keyof EventMap;

export function dispatch<K extends EventName>(name: K, detail: EventMap[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends EventName>(
  name: K,
  handler: (detail: EventMap[K]) => void,
): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail);
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}

export const EVENT_NAMES: EventName[] = [
  'dg:home:refresh-briefings', 'dg:home:toggle-scrap', 'dg:home:mark-read',
  'dg:home:toggle-memo', 'dg:home:save-memo', 'dg:home:toggle-hint',
  'dg:home:submit-answer', 'dg:home:chat-send', 'dg:home:open-api-key-modal',
  'dg:home:reload-question', 'dg:home:char-count-change',
  'dg:archive:filter', 'dg:archive:search', 'dg:archive:open-detail',
  'dg:stats:open-day-detail', 'dg:stats:refresh',
];
