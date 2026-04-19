const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export interface GenerateTextInput {
  apiKey: string;
  prompt: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function generateText({ apiKey, prompt }: GenerateTextInput): Promise<string> {
  if (!apiKey) throw new Error('Gemini api key missing');
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseJsonText<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('gemini response: no JSON object');
  const cleaned = match[0].replace(/[\u0000-\u001F]+/g, ' ').replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned) as T;
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
}

export async function generateQuestion({ apiKey, interests, preferType }: GenerateQuestionInput): Promise<QuestionOut> {
  const prompt = [
    '관심사: ' + interests.join(', '),
    `원하는 유형: ${preferType} (reflection/action/observation/planning 중 하나)`,
    '아래 형식의 JSON만 정확히 반환: {"type":"...","question":"...","hint":"..."}',
    '질문은 한국어, 한 문장, 30-60자. 힌트는 질문에 어떻게 접근할지 한 문장.',
  ].join('\n');
  const text = await generateText({ apiKey, prompt });
  return parseJsonText<QuestionOut>(text);
}

export interface ChatTurn { role: 'user' | 'ai'; text: string }

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
