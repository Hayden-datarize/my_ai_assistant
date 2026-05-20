import { parseJsonText, parseQuestionResponse } from '../utils/gemini-parse';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export interface GenerateTextInput {
  apiKey: string;
  prompt: string;
  maxOutputTokens?: number; // v3.23 신규 (optional, 기존 caller 영향 0)
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function generateText({ apiKey, prompt, maxOutputTokens }: GenerateTextInput): Promise<string> {
  if (!apiKey) throw new Error('Gemini api key missing');
  const body: { contents: unknown[]; generationConfig?: { maxOutputTokens: number } } = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (typeof maxOutputTokens === 'number' && maxOutputTokens > 0) {
    body.generationConfig = { maxOutputTokens };
  }
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export interface GenerateQuestionInput {
  apiKey: string;
  interests: string[];
  preferType: string;
}

export interface QuestionOut {
  type: string;
  question: string;
  hint: string;
  // v3.39 T3 (Codex 사전 P1-2): Gemini가 선택한 분야 (whitelist 통과 또는 userInterests[0] 폴백).
  targetInterestId: string;
}

export async function generateQuestion({ apiKey, interests, preferType }: GenerateQuestionInput): Promise<QuestionOut> {
  const idList = interests.map(i => `"${i}"`).join(', ');
  const prompt = [
    `사용자 관심분야 id: ${idList}`,
    `원하는 유형: ${preferType} (reflection/action/observation/planning 중 하나)`,
    '위 분야 중 하나를 선택하여 그 분야에 맞는 질문을 작성하세요.',
    '아래 형식의 JSON만 정확히 반환 (앞뒤 다른 텍스트 금지):',
    '{"type":"...","question":"...","hint":"...","interestId":"<선택한 분야 id>"}',
    `interestId 필드는 반드시 위 목록 (${idList}) 중 하나여야 합니다.`,
    '질문은 한국어, 한 문장, 30-60자. 힌트는 질문에 어떻게 접근할지 한 문장.',
  ].join('\n');
  const text = await generateText({ apiKey, prompt });
  return parseQuestionResponse(text, interests);
}

interface ChatTurn { role: 'user' | 'ai'; text: string }

export interface ChatInput {
  apiKey: string;
  turns: ChatTurn[];
}

export async function chat({ apiKey, turns }: ChatInput): Promise<string> {
  const body = turns.map(t => `${t.role === 'user' ? '사용자' : 'AI'}: ${t.text}`).join('\n');
  const prompt = body + '\nAI:';
  return generateText({ apiKey, prompt });
}

export interface EvaluateAnswerInput {
  apiKey: string;
  question: string;
  answer: string;
}

export async function evaluateAnswer({ apiKey, question, answer }: EvaluateAnswerInput): Promise<{ score: number; feedback: string }> {
  const prompt = [
    `질문: ${question}`,
    `답변: ${answer}`,
    '1~5점 평가와 한 문장 피드백을 다음 JSON으로만 반환: {"score":N,"feedback":"..."}',
  ].join('\n');
  const text = await generateText({ apiKey, prompt });
  return parseJsonText<{ score: number; feedback: string }>(text);
}
