import { isHttpsUrl, isSafeUrl } from '../utils/url';
import { interestKeywords, matchKeyword } from '../utils/interestKeywords';
import { showToast } from '../utils/toast';
import { takeSnapshot, runSweep } from './achievements';
import { getActiveMissions, tickMissionProgress } from './missionEngine';
import type { MissionAction } from './missionTypes';
import { tickPlantActivity } from './plantEngine';
import { getCachedUser, saveUser, getSaveErrorMessage, normalizeBriefingInterestIds } from './user';
import type { User } from './user';

export interface Briefing {
  id: string;
  date: string;
  url: string;
  title: string;
  summary: string;
  scrapped: boolean;
  read: boolean;
  memo: string;
  sourceTitle?: string;
  imageUrl?: string;  // v3.3.3 — persisted from RSS extractImage()
  // v3.4 — translation cache
  detectedLang?: 'en' | 'ko' | 'unknown';
  titleKo?: string;
  summaryKo?: string;
  /** v3.27 T1 → v3.28 T2: archive 핀(즐겨찾기). default false. write-side normalize (P2-2) — `loadBriefings` map 단계에 copy-based backfill (P0-3 idempotency). */
  pinned: boolean;
  /** v3.39 T2: 사용자 관심분야 id (INTERESTS.id 또는 'unknown'). validateInterestId 통과 의무. loadBriefings boundary에서 'unknown' 백필 + normalizeBriefingInterestIds로 invalid 정정. */
  interestId: string;
}

const KEY = 'briefings';

// v3.41 T4 (Codex P1 F4): url field에 isSafeUrl 강제 — javascript:/data:/file: 등
// 차단. imageUrl은 더 엄격한 isHttpsUrl 유지. write + read + render 3-layer
// guard (defense-in-depth) — read에서 drop, write에서 throw, render에서 safeHref
// fallback. 정책 분리: link policy = isSafeUrl, image policy = isHttpsUrl.
export function loadBriefings(): Briefing[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const list = raw.flatMap((b) => {
      // v3.28 T2 (P2-2): copy-based pinned 정규화 (P0-3 idempotency — 원본 mutation 금지).
      const briefing = b as Briefing & { pinned?: boolean; interestId?: string };
      // v3.41 T4: url invalid → item drop (이전: 그대로 통과 → render anchor href 주입).
      if (!isSafeUrl(briefing.url)) {
        console.warn('[briefings] dropping item with unsafe url', briefing.url);
        return [];
      }
      const normalized: Briefing = {
        ...briefing,
        pinned: typeof briefing.pinned === 'boolean' ? briefing.pinned : false,
        // v3.38 T4 fix (Codex 최종 P1-1): legacy 데이터 memo undefined 백필 — saveBriefings strict가
        // toggleScrap 등 read→write 경로에서 throw하는 회귀 차단.
        memo: typeof briefing.memo === 'string' ? briefing.memo : '',
        // v3.39 T2: legacy briefing interestId 'unknown' 백필 (boundary 1회 정규화).
        // invalid string (catalog miss) 정정은 normalizeBriefingInterestIds가 별도 담당.
        interestId: typeof briefing.interestId === 'string' ? briefing.interestId : 'unknown',
      };
      // Drop imageUrl only if present-but-invalid; leave undefined alone.
      if (normalized.imageUrl !== undefined && !isHttpsUrl(normalized.imageUrl)) {
        delete normalized.imageUrl;
      }
      return [normalized];
    });
    // v3.39 T2 (Codex 사전 P1-3 mirror): catalog miss (외부 손상/legacy invalid id) → 'unknown' 정정.
    // normalizeInsightInterestIds 패턴 (user.ts:82) 동치 — pure validator + normalizer 분리.
    normalizeBriefingInterestIds(list);
    return list;
  } catch {
    return [];
  }
}

/**
 * v3.38 T4: write-side schema strict + NFC normalize.
 *
 * - required field (title/summary/memo): 비문자열 거절 (무결성 invariant).
 * - 한국어 NFC normalize: search/highlight/fuzzy 정합 (v3.27+ token search precedent).
 * - sourceTitle (optional): 존재 시 NFC normalize.
 *
 * Codex 사전 review P1-3 ripple — 단일 boundary(saveBriefings)에 통합하여
 * caller(home.ts saveBriefings call site, mutateWithSweep)들이 자동 혜택.
 */
export function saveBriefings(list: Briefing[]): void {
  const normalized = list.map((b, i) => {
    if (typeof b.title !== 'string') {
      throw new Error(`saveBriefings: invalid title at index ${i} (expected string)`);
    }
    if (typeof b.summary !== 'string') {
      throw new Error(`saveBriefings: invalid summary at index ${i} (expected string)`);
    }
    if (typeof b.memo !== 'string') {
      throw new Error(`saveBriefings: invalid memo at index ${i} (expected string)`);
    }
    // v3.41 T4 (Codex P1 F4): write boundary 차단 — invalid url storage 진입 차단.
    if (!isSafeUrl(b.url)) {
      throw new Error(`saveBriefings: unsafe url at index ${i} (${typeof b.url})`);
    }
    return {
      ...b,
      title: b.title.normalize('NFC'),
      summary: b.summary.normalize('NFC'),
      memo: b.memo.normalize('NFC'),
      ...(b.sourceTitle !== undefined ? { sourceTitle: b.sourceTitle.normalize('NFC') } : {}),
    };
  });
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

function mutate(index: number, fn: (b: Briefing) => void): void {
  const list = loadBriefings();
  const target = list[index];
  if (!target) return;
  fn(target);
  saveBriefings(list);
}

/**
 * briefing 1개에 매칭되는 모든 분야로 tickPlantActivity 호출 (in-memory only).
 *
 * T7 (S7 fix / Codex P1-1): saveUser 호출하지 않음. caller (mutateWithSweep) 가 단일
 * saveUser 시점에 모든 mutate 결과 persist. atomic single-write 원칙 (v3.10/v3.13.1).
 *
 * @param user    - User (in-memory mutate)
 * @param briefing - 분야 매칭 대상
 * @param delta   - 보통 +1 (스크랩 1회 또는 메모 1회)
 */
export function tickPlantsByBriefingInMemory(user: User, briefing: Briefing, delta: number): void {
  const hay = `${briefing.sourceTitle ?? ''} ${briefing.title} ${briefing.summary}`.toLowerCase();
  for (const interestId of user.interests) {
    if (interestKeywords(interestId).some(k => matchKeyword(hay, k))) {
      tickPlantActivity(user, interestId, delta);
    }
  }
}

function mutateWithSweep(index: number, fn: (b: Briefing) => void, action?: MissionAction): void {
  const u = action ? getCachedUser() : null;
  const now = new Date();                                                         // single now capture (v3.13.1 T14 / codex P1-1)
  if (u) getActiveMissions(now, u);  // lazy regen (in-memory, no saveUser)

  const list = loadBriefings();
  const target = list[index];
  if (!target) return;
  const prev = takeSnapshot();

  // T7 (S7 fix): scrap/memo 전환 감지 — pre-mutation snapshot
  const wasScrapped = target.scrapped;
  const memoWasEmpty = !target.memo || target.memo.trim().length === 0;

  fn(target);
  saveBriefings(list);  // throws on Quota — 이후 saveUser 안 함 (false-fire 방지)

  if (u) {
    // T7 (S7 fix): plant tick — in-memory only, mutateWithSweep의 단일 saveUser 활용
    if (action === 'scrap' && target.scrapped && !wasScrapped) {
      tickPlantsByBriefingInMemory(u, target, 1);  // scrap +1 (false→true 전환)
      // C1 catch-up (v3.16 T1): scrap ON 시점에 기존 memo가 있으면 memo도 retroactive +1
      // (backfill 정책 "scrap된 briefing의 memo만 카운트"와 정합).
      if (target.memo && target.memo.trim().length > 0) {
        tickPlantsByBriefingInMemory(u, target, 1);  // memo catch-up +1
      }
    }
    // P1-1 fix (v3.15 T16.1): memo tick은 스크랩된 briefing에만 적용 (backfill 정책과 정합).
    // 스크랩 안 한 briefing의 memo는 활동으로 간주하지 않음.
    if (action === 'memo' && target.scrapped && memoWasEmpty && target.memo.trim().length > 0) {
      tickPlantsByBriefingInMemory(u, target, 1);  // 스크랩+빈→non-빈 전환만
    }

    if (action) tickMissionProgress(u, action, now);
    // mission + plant tick 상태를 단일 write로 커버 (atomic single-write 원칙).
    // P0-2 fix (v3.15 T16.1): saveUser 실패 시 sweep 차단 (atomic invariant 보장).
    // throw 시 briefing은 이미 persist됨 — XP/plant 손실은 next sweep에서 회복 가능
    // (mission instance 자체는 saveUser fail로 미persist, 다음 진입 시 lazy regen).
    let saveOk = false;
    try {
      saveUser(u);
      saveOk = true;
    } catch (err) {
      showToast(getSaveErrorMessage(err));
    }

    if (saveOk) {
      const curr = takeSnapshot();
      runSweep(prev, curr);
    }
    return;
  }

  const curr = takeSnapshot();
  runSweep(prev, curr);
}

export function toggleScrap(index: number): void { mutateWithSweep(index, b => { b.scrapped = !b.scrapped; }, 'scrap'); }
export function setRead(index: number): void { mutate(index, b => { b.read = true; }); }
export function saveMemo(index: number, memo: string): void { mutateWithSweep(index, b => { b.memo = memo; }, 'memo'); }

type TranslationPatch = Partial<Pick<Briefing, 'detectedLang' | 'titleKo' | 'summaryKo'>>;

export function setTranslation(id: string, patch: TranslationPatch): void {
  const list = loadBriefings();
  const target = list.find(b => b.id === id);
  if (!target) return;
  Object.assign(target, patch);
  saveBriefings(list);
}

export function clearAllTranslations(): void {
  const list = loadBriefings();
  for (const b of list) {
    delete b.detectedLang;
    delete b.titleKo;
    delete b.summaryKo;
  }
  saveBriefings(list);
}
