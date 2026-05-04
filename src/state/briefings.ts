import { isHttpsUrl } from '../utils/url';
import { interestKeywords, matchKeyword } from '../utils/interestKeywords';
import { showToast } from '../utils/toast';
import { takeSnapshot, runSweep } from './achievements';
import { getActiveMissions, tickMissionProgress } from './missionEngine';
import type { MissionAction } from './missionTypes';
import { tickPlantActivity } from './plantEngine';
import { getCachedUser, saveUser, getSaveErrorMessage } from './user';
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
}

const KEY = 'briefings';

// `b as Briefing` is an unchecked assertion at the localStorage boundary.
// Today only `imageUrl` is validated downstream (via isHttpsUrl); other
// fields (url, title, summary, sourceTitle, titleKo, summaryKo, ...) are
// accepted as-is. Callers tolerate string drift on those fields.
export function loadBriefings(): Briefing[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map((b) => {
      const briefing = b as Briefing;
      // Drop imageUrl only if present-but-invalid; leave undefined alone.
      if (briefing.imageUrl !== undefined && !isHttpsUrl(briefing.imageUrl)) {
        const normalized: Briefing = { ...briefing };
        delete normalized.imageUrl;
        return normalized;
      }
      return briefing;
    });
  } catch {
    return [];
  }
}

export function saveBriefings(list: Briefing[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
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
