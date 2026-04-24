import { describe, it, expect } from 'vitest';
import { extractImage } from '../../src/services/rss';

describe('extractImage', () => {
  describe('tier 1: enclosure (image/*)', () => {
    it('accepts enclosure with image/jpeg type', () => {
      const item = { enclosure: { link: 'https://example.com/a.jpg', type: 'image/jpeg' } };
      expect(extractImage(item)).toBe('https://example.com/a.jpg');
    });

    it('accepts enclosure with image/png type', () => {
      const item = { enclosure: { link: 'https://example.com/a.png', type: 'image/png' } };
      expect(extractImage(item)).toBe('https://example.com/a.png');
    });

    it('rejects non-image enclosure (video)', () => {
      const item = { enclosure: { link: 'https://example.com/v.mp4', type: 'video/mp4' } };
      expect(extractImage(item)).toBeUndefined();
    });

    it('skips enclosure when link missing', () => {
      const item = { enclosure: { type: 'image/jpeg' } };
      expect(extractImage(item)).toBeUndefined();
    });
  });

  describe('tier 2: thumbnail', () => {
    it('accepts thumbnail when enclosure absent', () => {
      const item = { thumbnail: 'https://example.com/t.jpg' };
      expect(extractImage(item)).toBe('https://example.com/t.jpg');
    });

    it('enclosure takes priority over thumbnail', () => {
      const item = {
        enclosure: { link: 'https://a.com/e.jpg', type: 'image/png' },
        thumbnail: 'https://b.com/t.jpg',
      };
      expect(extractImage(item)).toBe('https://a.com/e.jpg');
    });
  });

  describe('tier 3: description <img> via DOMParser', () => {
    it('extracts first <img> src from description', () => {
      const item = { description: '<p>hello</p><img src="https://example.com/d.jpg" alt="" /><img src="https://example.com/e.jpg" />' };
      expect(extractImage(item)).toBe('https://example.com/d.jpg');
    });

    it('returns undefined when description has no img', () => {
      const item = { description: '<p>no images here</p>' };
      expect(extractImage(item)).toBeUndefined();
    });

    it('returns undefined when description is empty string', () => {
      const item = { description: '' };
      expect(extractImage(item)).toBeUndefined();
    });
  });

  describe('sanitization — only https: accepted', () => {
    it('rejects javascript: URL', () => {
      const item = { enclosure: { link: 'javascript:alert(1)', type: 'image/jpeg' } };
      expect(extractImage(item)).toBeUndefined();
    });

    it('rejects http: URL (mixed content)', () => {
      const item = { enclosure: { link: 'http://example.com/a.jpg', type: 'image/jpeg' } };
      expect(extractImage(item)).toBeUndefined();
    });

    it('rejects data: URL', () => {
      const item = { thumbnail: 'data:image/png;base64,iVBORw0KGgo=' };
      expect(extractImage(item)).toBeUndefined();
    });

    it('rejects malformed URL', () => {
      const item = { thumbnail: 'not a url' };
      expect(extractImage(item)).toBeUndefined();
    });

    it('accepts valid https: URL', () => {
      const item = { thumbnail: 'https://example.com/t.jpg' };
      expect(extractImage(item)).toBe('https://example.com/t.jpg');
    });

    it('sanitizes description img with non-https src', () => {
      const item = { description: '<img src="http://example.com/a.jpg" />' };
      expect(extractImage(item)).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('returns undefined for empty input', () => {
      expect(extractImage({})).toBeUndefined();
    });

    it('handles malformed description gracefully (DOMParser does not throw)', () => {
      const item = { description: '<div><img src="https://e.com/a.jpg" oops' };
      // DOMParser is lenient; may still extract or not, but should NOT throw
      expect(() => extractImage(item)).not.toThrow();
    });
  });
});
