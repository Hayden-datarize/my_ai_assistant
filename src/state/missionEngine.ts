import type { User } from './user';
import type { MissionInstance, MissionPeriod, MissionAction } from './missionTypes';
import { DAILY_POOL, WEEKLY_FIXED, MONTHLY_FIXED, getMissionDef } from './missionCatalog';
import { assertNever } from '../utils/assertNever';

// en-CA 로케일은 YYYY-MM-DD 형식을 보장 (ISO 8601 준수)
const KST_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function getKSTDateIso(now: Date): string {
  return KST_FMT.format(now);                                            // 'YYYY-MM-DD'
}

function parseKSTYMD(now: Date): [number, number, number] {
  return getKSTDateIso(now).split('-').map(Number) as [number, number, number];
}

export function getKSTMonthIso(now: Date): string {
  return getKSTDateIso(now).slice(0, 7);                                 // 'YYYY-MM'
}

export function getKSTWeekIso(now: Date): string {
  // ISO 8601 week, KST 기준 (월요일 시작). Intl은 weekYear 미지원이라 자체 계산.
  const [y, m, d] = parseKSTYMD(now);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay() || 7;                                      // Sun=0 → 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day);                            // 같은 주 목요일
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getKSTWindowStart(now: Date, period: MissionPeriod): number {
  const [y, m, d] = parseKSTYMD(now);
  switch (period) {
    case 'daily':
      // KST 00:00 = UTC -9h
      return Date.UTC(y, m - 1, d) - 9 * 3600 * 1000;
    case 'monthly':
      return Date.UTC(y, m - 1, 1) - 9 * 3600 * 1000;
    case 'weekly': {
      // KST 월요일 00:00
      const utc = new Date(Date.UTC(y, m - 1, d));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() - (day - 1));                      // 그 주 월요일
      return utc.getTime() - 9 * 3600 * 1000;
    }
    default:
      return assertNever(period);
  }
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// v3.14 T8: T10-B wiring 완료 (briefing-view: home.ts T6, cross-interest-view: home.ts T7).
// DEFERRED_DEFIDS는 비웠지만 const는 향후 deferred 용도 가능성을 위해 유지.
const DEFERRED_DEFIDS = new Set<string>();

export function pickDailyMissions(dateIso: string, now: Date): MissionInstance[] {
  const rng = mulberry32(hashStr(dateIso));
  const pool = DAILY_POOL.filter(d => !DEFERRED_DEFIDS.has(d.id)); // 5 active entries (7 - 2 deferred)
  const picked: MissionInstance[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [def] = pool.splice(idx, 1);
    // pool.length > 0 을 루프 조건으로 보장하므로 def는 항상 존재 (TS 안전 guard)
    if (!def) break;
    const inst: MissionInstance = {
      defId: def.id, period: 'daily',
      windowStart: getKSTWindowStart(now, 'daily'),
      progress: 0, completed: false,
    };
    // active-day triggerOn 미션은 progressDates 배열 초기화 (T4 idempotent dedup에서 사용)
    if (def.triggerOn === 'active-day') inst.progressDates = [];
    picked.push(inst);
  }
  return picked;
}

function makeFixed(
  defs: readonly { id: string; period: MissionPeriod; triggerOn: string }[],
  period: MissionPeriod,
  now: Date,
): MissionInstance[] {
  return defs.map(def => {
    const inst: MissionInstance = {
      defId: def.id, period,
      windowStart: getKSTWindowStart(now, period),
      progress: 0, completed: false,
    };
    // weekly-active-5days (triggerOn: 'active-day')는 progressDates 초기화
    if (def.triggerOn === 'active-day') inst.progressDates = [];
    return inst;
  });
}

/**
 * Lazy regeneration. expired 미션은 새로 생성, 미완수 carry-over X.
 *
 * **caller invariant**: saveUser는 caller 책임 (이중 saveUser race 회피 — spec C6).
 * 이 함수는 localStorage를 절대 건드리지 않는다.
 *
 * **midnight rollover invariant (v3.13.1 T8 / P2-3)**: caller는 prev/curr Snapshot 사이에 같은 `now` 값을 사용해야 한다.
 * 자정을 가로질러 호출하면 `lastDailySeed`가 갱신되어 daily 미션이 regen되고
 * prev/curr defId 매칭이 깨질 수 있다. recordDailyAnswer / fireTrigger / mutateWithSweep 등
 * 모든 sweep 진입점은 단일 `now` 캡처 후 사용한다.
 *
 * @returns `{ active, dirty }` — `dirty=true` 일 때만 caller가 saveUser 호출.
 *          v3.13.1 T2: JSON.stringify 비교 제거를 위해 도입.
 */
export function getActiveMissions(
  now: Date,
  user: User,
): { active: MissionInstance[]; dirty: boolean } {
  const todayIso = getKSTDateIso(now);
  const weekIso = getKSTWeekIso(now);
  const monthIso = getKSTMonthIso(now);
  let dirty = false;

  if (user.missions.lastDailySeed !== todayIso) {
    const newDaily = pickDailyMissions(todayIso, now);
    user.missions.active = user.missions.active.filter(m => m.period !== 'daily').concat(newDaily);
    user.missions.lastDailySeed = todayIso;
    dirty = true;
  }
  if (user.missions.currentWeekIso !== weekIso) {
    const newWeekly = makeFixed(WEEKLY_FIXED, 'weekly', now);
    user.missions.active = user.missions.active.filter(m => m.period !== 'weekly').concat(newWeekly);
    user.missions.currentWeekIso = weekIso;
    dirty = true;
  }
  if (user.missions.currentMonthIso !== monthIso) {
    const newMonthly = makeFixed(MONTHLY_FIXED, 'monthly', now);
    user.missions.active = user.missions.active.filter(m => m.period !== 'monthly').concat(newMonthly);
    user.missions.currentMonthIso = monthIso;
    dirty = true;
  }
  return { active: user.missions.active, dirty };
}

/**
 * progress++ → completed 전환 시 xp 보너스 + cumulative 카운트.
 * **caller invariant**: tick 후 caller가 saveUser 호출 (race 회피, sweep은 read-only).
 * active-day trigger는 progressDates 기반 idempotent (같은 날 중복 push 차단).
 */
export function tickMissionProgress(user: User, action: MissionAction, now: Date = new Date()): void {
  const todayIso = getKSTDateIso(now);
  for (const m of user.missions.active) {
    if (m.completed) continue;
    const def = getMissionDef(m.defId);
    if (!def) continue;                              // catalog 변경 시 unknown defId 방어

    if (def.triggerOn === 'active-day') {
      if (action === 'active-day') continue;         // 'active-day' raw action은 호출되지 않음 (방어)
      m.progressDates = m.progressDates ?? [];
      if (m.progressDates.includes(todayIso)) continue;
      m.progressDates.push(todayIso);
      m.progress = m.progressDates.length;
    } else if (def.triggerOn === action) {
      m.progress++;
    } else {
      continue;
    }

    if (m.progress >= def.target && !m.completed) {
      m.completed = true;
      user.xp += def.rewardXp;
      switch (m.period) {
        case 'daily':   user.missions.cumulative.dailyCount++;   break;
        case 'weekly':  user.missions.cumulative.weeklyCount++;  break;
        case 'monthly': user.missions.cumulative.monthlyCount++; break;
        default:        assertNever(m.period);
      }
    }
  }
}
