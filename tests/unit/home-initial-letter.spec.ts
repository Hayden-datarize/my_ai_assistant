import { describe, it, expect } from 'vitest';
import { getInitialLetter } from '../../src/ui/handlers/home';

describe('getInitialLetter (v3.3.4 surrogate-pair safe)', () => {
  it('returns first grapheme for emoji-prefixed sourceTitle', () => {
    // Without spread iteration, [0] returns lone surrogate '\uD83D' (garbage)
    expect(getInitialLetter('🚀TechCrunch')).toBe('🚀');
  });

  it('returns first Korean char', () => {
    expect(getInitialLetter('가나다')).toBe('가');
  });

  it('uppercases ASCII letter', () => {
    expect(getInitialLetter('techcrunch')).toBe('T');
  });

  it('returns ? for empty string', () => {
    expect(getInitialLetter('')).toBe('?');
  });

  it('returns ? for undefined', () => {
    expect(getInitialLetter(undefined)).toBe('?');
  });
});
