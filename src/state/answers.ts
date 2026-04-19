export interface Answer {
  id: string;
  date: string;
  questionId: string;
  type: string;
  answer: string;
  evaluation?: { score: number; feedback: string };
}

const KEY = 'answers';
const TYPES = ['reflection', 'action', 'observation', 'planning'] as const;

function read(): Answer[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Answer[]; } catch { return []; }
}

function write(list: Answer[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveAnswer(input: Omit<Answer, 'id'>): string {
  const id = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const list = read();
  list.unshift({ ...input, id });
  write(list);
  return id;
}

export function listAnswers(): Answer[] { return read(); }

export function findAnswer(id: string): Answer | undefined {
  return read().find(a => a.id === id);
}

export function setAnswerEvaluation(id: string, evaluation: { score: number; feedback: string }): void {
  const list = read();
  const idx = list.findIndex(a => a.id === id);
  if (idx < 0) return;
  const target = list[idx];
  if (!target) return;
  target.evaluation = evaluation;
  write(list);
}

export function aggregateStats(): { total: number; byType: Record<string, number>; weakestType: string } {
  const list = read();
  const byType: Record<string, number> = {};
  for (const t of TYPES) byType[t] = 0;
  for (const a of list) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const seen = TYPES.filter(t => (byType[t] ?? 0) > 0);
  const pool = seen.length > 0 ? seen : [...TYPES];
  const weakestType = pool.reduce<string>((min, t) => ((byType[t] ?? 0) < (byType[min] ?? 0) ? t : min), pool[0] ?? TYPES[0]);
  return { total: list.length, byType, weakestType };
}
