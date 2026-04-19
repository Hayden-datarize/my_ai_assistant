import { describe, it, expect, beforeEach } from 'vitest';
import { loadChatHistory, saveChatHistory, appendChatMessage } from '../../src/state/chat';

describe('state/chat', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when empty', () => {
    expect(loadChatHistory('2026-04-19')).toEqual([]);
  });

  it('appendChatMessage writes to per-day key', () => {
    appendChatMessage('2026-04-19', { role: 'user', text: 'hi', at: 1 });
    appendChatMessage('2026-04-19', { role: 'ai', text: 'hello', at: 2 });
    expect(loadChatHistory('2026-04-19')).toHaveLength(2);
    expect(localStorage.getItem('chat_2026-04-19')).toContain('hello');
  });

  it('saveChatHistory overwrites prior entries for the same day', () => {
    appendChatMessage('2026-04-19', { role: 'user', text: 'a', at: 1 });
    saveChatHistory('2026-04-19', [{ role: 'user', text: 'b', at: 2 }]);
    expect(loadChatHistory('2026-04-19')).toHaveLength(1);
    expect(loadChatHistory('2026-04-19')[0]?.text).toBe('b');
  });

  it('keys are scoped per day', () => {
    appendChatMessage('2026-04-19', { role: 'user', text: 'a', at: 1 });
    appendChatMessage('2026-04-20', { role: 'user', text: 'b', at: 2 });
    expect(loadChatHistory('2026-04-19')).toHaveLength(1);
    expect(loadChatHistory('2026-04-20')).toHaveLength(1);
  });
});
