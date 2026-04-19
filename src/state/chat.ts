export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  at: number;
}

const prefix = (date: string): string => `chat_${date}`;

export function loadChatHistory(date: string): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(prefix(date)) ?? '[]') as ChatMessage[]; } catch { return []; }
}

export function saveChatHistory(date: string, history: ChatMessage[]): void {
  localStorage.setItem(prefix(date), JSON.stringify(history));
}

export function appendChatMessage(date: string, msg: ChatMessage): void {
  const hist = loadChatHistory(date);
  hist.push(msg);
  saveChatHistory(date, hist);
}
