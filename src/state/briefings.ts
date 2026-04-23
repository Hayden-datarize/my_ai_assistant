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
}

const KEY = 'briefings';

export function loadBriefings(): Briefing[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Briefing[]; } catch { return []; }
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
