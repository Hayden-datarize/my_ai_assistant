import { describe, it, expect, vi } from 'vitest';
import { createLangToggle } from '../../src/ui/components/cardLangToggle';

describe('cardLangToggle', () => {
  it('renders button with default "한글로 보기" label and aria-label', () => {
    const onToggle = vi.fn();
    const btn = createLangToggle({ initialState: 'en', onToggle });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toContain('한글로 보기');
    expect(btn.getAttribute('aria-label')).toBe('한글로 보기');
  });

  it('switches label to "영문으로 보기" when state is ko', () => {
    const btn = createLangToggle({ initialState: 'ko', onToggle: () => {} });
    expect(btn.textContent).toContain('영문으로 보기');
    expect(btn.getAttribute('aria-label')).toBe('영문으로 보기');
  });

  it('calls onToggle with next state and stops propagation', () => {
    const onToggle = vi.fn();
    const btn = createLangToggle({ initialState: 'en', onToggle });
    const ev = new MouseEvent('click', { bubbles: true });
    const stopSpy = vi.spyOn(ev, 'stopPropagation');
    btn.dispatchEvent(ev);
    expect(onToggle).toHaveBeenCalledWith('ko');
    expect(stopSpy).toHaveBeenCalled();
  });

  it('disables button + sets aria-disabled when disabled=true', () => {
    const btn = createLangToggle({ initialState: 'en', onToggle: () => {}, disabled: true, disabledReason: '오늘 한도 도달' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.title).toBe('오늘 한도 도달');
  });

  it('setLangState swaps label without re-creating element', () => {
    const btn = createLangToggle({ initialState: 'en', onToggle: () => {} });
    expect(btn.textContent).toContain('한글로 보기');
    btn.setLangState('ko');
    expect(btn.textContent).toContain('영문으로 보기');
  });

  it('updates aria-label on state change via setLangState', () => {
    const btn = createLangToggle({ initialState: 'en', onToggle: () => {} });
    expect(btn.getAttribute('aria-label')).toBe('한글로 보기');
    btn.setLangState('ko');
    expect(btn.getAttribute('aria-label')).toBe('영문으로 보기');
  });
});
