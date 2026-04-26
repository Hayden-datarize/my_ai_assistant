export type DetectedLang = 'en' | 'ko' | 'unknown';

const KOREAN_RE = /[가-힣]/;
const ASCII_LETTER_RE = /[A-Za-z]/g;

export function detectLanguage(title: string, description?: string): DetectedLang {
  const text = (title + ' ' + (description ?? '')).trim();
  if (text.length === 0) return 'unknown';

  if (KOREAN_RE.test(text)) return 'ko';

  const asciiLetters = (text.match(ASCII_LETTER_RE) ?? []).length;
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return 'unknown';
  if (asciiLetters / total >= 0.5) return 'en';

  return 'unknown';
}
