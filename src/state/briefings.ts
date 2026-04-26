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

function isValidImageUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https:\/\//i.test(v);
}

export function loadBriefings(): Briefing[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map((b) => {
      const briefing = b as Briefing;
      // Drop imageUrl only if present-but-invalid; leave undefined alone
      if (briefing.imageUrl !== undefined && !isValidImageUrl(briefing.imageUrl)) {
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

export function toggleScrap(index: number): void { mutate(index, b => { b.scrapped = !b.scrapped; }); }
export function setRead(index: number): void { mutate(index, b => { b.read = true; }); }
export function saveMemo(index: number, memo: string): void { mutate(index, b => { b.memo = memo; }); }

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
