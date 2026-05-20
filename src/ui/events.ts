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
  // v3.41 T6 (Codex P1 F6): 'dg:archive:period-change' 제거 (dead control, v3.2 deferred placeholder).
  'dg:archive:search': undefined;
  'dg:archive:filter': { filter: string };
  // v3.27 T4 (Codex 사전 P1-4) — togglePin entity별 storage 정합 후 archive re-render trigger.
  'dg:archive:updated': { entity: 'answer' | 'scrap' | 'insight'; id: string };
  // stats (2) — matches tabs/stats.ts exactly
  'dg:stats:weekly-report': undefined;
  'dg:stats:growth-analysis': undefined;
  // nav (1) — dispatched by nav.ts after a tab is switched-to; consumed by
  // handlers/* to hydrate their own tab's dynamic content.
  'dg:nav:tab-changed': { tab: string };
  // v3.12 reward events
  'dg:reward:xp-float': { amount: number; at: number };
  'dg:reward:level-up': { tierId: number; at: number };
  'dg:reward:streak-milestone': { days: number; at: number };
  'dg:reward:badge-unlock': { badgeId: string; at: number };
  // v3.13 T7 — mission-complete toast
  'dg:reward:mission-complete': { defId: string; period: 'daily' | 'weekly' | 'monthly'; rewardXp: number; at: number };
  // v3.15 T5 — plant stage-up (consumer in T14)
  'dg:reward:plant-stage-up': { interestId: string; newStage: 1 | 2 | 3 | 4 | 5; at: number };
  // v3.21 T5 — streak freeze consumed (caller-side direct dispatch from recordDailyAnswer)
  // 사전 review P0-2 fix: sweep delta(net=0 false-negative) 우회. Option B (saveUser-after).
  'dg:reward:streak-freeze-used': { days: number };
  // v3.23 T8 — insight 카드 추가 (T8 dispatch + listener placeholder)
  // v3.23 T9 — insight 카드 삭제 (dispatch + listener 함께 추가)
  'dg:insights:added': { id: string };
  'dg:insights:removed': { id: string };
  // v3.25 T1 — insight 분야 chip 수동 정정 (dispatch from interest-edit dropdown,
  //   listener: insights tab refresh — T5+T6에서 wiring)
  'dg:insights:updated': { id: string };
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
  'dg:archive:search', 'dg:archive:filter', 'dg:archive:updated',
  'dg:stats:weekly-report', 'dg:stats:growth-analysis',
  'dg:nav:tab-changed',
  'dg:reward:xp-float',
  'dg:reward:level-up',
  'dg:reward:streak-milestone',
  'dg:reward:badge-unlock',
  'dg:reward:mission-complete',
  'dg:reward:plant-stage-up',
  'dg:reward:streak-freeze-used',
  'dg:insights:added',
  'dg:insights:removed',
  'dg:insights:updated',
] as const;

/**
 * Events deferred to v3.2 — handlers in v3.1 register a stub listener.
 * v3.23 T8 graduate: summarize-chat / generate-insight-card / weekly-report / growth-analysis
 * 4건 실구현으로 제거.
 * v3.41 T6 graduate: archive:period-change 제거 (dead control, v3.42+에 search/pin 통합 검토).
 * dismiss-backup 1건만 잔존.
 */
export const V32_DEFERRED_EVENTS: readonly EventName[] = [
  'dg:home:dismiss-backup',
] as const;
