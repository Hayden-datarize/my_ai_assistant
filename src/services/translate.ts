import { parseJsonText } from '../utils/gemini-parse';

const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'] as const;
type Model = typeof MODELS[number];
const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const INPUT_CAP = 1500;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface JsonOut { text: string }

async function callModel(model: Model, apiKey: string, prompt: string): Promise<string> {
  const url = `${ENDPOINT_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callPrimary(apiKey: string, prompt: string): Promise<string> {
  if (!apiKey) throw new Error('Gemini api key missing');
  return callModel(MODELS[0], apiKey, prompt);
}

export async function translateTitle(title: string, apiKey: string): Promise<string> {
  const prompt = [
    '다음 영문 제목을 한국어로 자연스럽게 번역해주세요.',
    '해요체, 한 문장. JSON으로만 반환: {"text":"..."}',
    `제목: ${title.slice(0, INPUT_CAP)}`,
  ].join('\n');
  const text = await callPrimary(apiKey, prompt);
  return parseJsonText<JsonOut>(text).text;
}

export async function summarizeOrTranslateBody(body: string, apiKey: string): Promise<string> {
  const truncated = body.slice(0, INPUT_CAP);
  const isShort = body.length <= 80;
  const prompt = isShort
    ? [
        '다음 영문 본문을 한국어로 자연스럽게 번역해주세요.',
        '해요체. JSON으로만 반환: {"text":"..."}',
        `본문: ${truncated}`,
      ].join('\n')
    : [
        '다음 영문 본문의 핵심을 한국어로 3~4줄 요약해주세요.',
        '해요체, 핵심만 간결하게. JSON으로만 반환: {"text":"..."}',
        `본문: ${truncated}`,
      ].join('\n');
  const text = await callPrimary(apiKey, prompt);
  return parseJsonText<JsonOut>(text).text;
}
