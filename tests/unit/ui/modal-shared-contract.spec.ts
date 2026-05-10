import { describe, it, expect, beforeEach } from 'vitest';
import { openModal, closeModal, type ModalConfig } from '../../../src/ui/modals/shared';

/**
 * v3.26 T3 (v3.24 P2-3): openModal contract 확장.
 * - discriminated xor union: {bodyHtml: string} | {bodyNode: Node}
 * - bodyHtml path: 기존 caller 0 변경 (contract 보존)
 * - bodyNode path: DOM Node append, innerHTML 직렬화 단계 제거 (XSS round-trip 안전성)
 *
 * Codex 사전 P2-1 흡수: TypeScript negative type assertions (both/neither @ts-expect-error).
 */
describe('openModal discriminated union contract (v3.26 T3)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('accepts bodyHtml (legacy path, escaped HTML string)', () => {
    const modal = openModal({ title: 'T', bodyHtml: '<p>safe</p>' });
    const body = modal.querySelector('.dg-modal-body');
    // eslint-disable-next-line no-restricted-syntax -- innerHTML read for assertion; no DOM mutation
    expect(body?.innerHTML).toBe('<p>safe</p>');
    closeModal();
  });

  it('accepts bodyNode (DOM Node, no innerHTML serialization)', () => {
    const node = document.createElement('div');
    node.textContent = 'nodey';
    const modal = openModal({ title: 'T', bodyNode: node });
    const body = modal.querySelector('.dg-modal-body');
    // Node identity 보존 — append이지 직렬화 X
    expect(body?.firstChild).toBe(node);
    expect(body?.textContent).toBe('nodey');
    closeModal();
  });

  it('bodyNode path preserves DOM event listeners (직렬화 round-trip 0)', () => {
    const node = document.createElement('button');
    node.textContent = 'click';
    let clicked = 0;
    node.addEventListener('click', () => { clicked += 1; });

    openModal({ title: 'T', bodyNode: node });
    node.click();
    expect(clicked).toBe(1); // listener 보존 (innerHTML 직렬화면 listener 손실)
    closeModal();
  });

  it('escapes bodyHtml interpolations per caller contract (caller responsibility)', () => {
    // bodyHtml은 caller-escape 의무 — 본 spec은 contract 보존만 검증
    const modal = openModal({ title: 'T', bodyHtml: '<p>&lt;script&gt;</p>' });
    expect(modal.querySelector('.dg-modal-body')?.textContent).toContain('<script>');
    closeModal();
  });

  // Codex 사전 P2-1: TypeScript negative type assertions
  it('TS rejects "neither bodyHtml nor bodyNode" config (negative type test)', () => {
    // @ts-expect-error — discriminated union: 둘 중 하나 필수
    const cfgNeither: ModalConfig = { title: 'T' };
    expect(cfgNeither).toBeDefined(); // runtime 무관, ts type check만
  });

  it('TS rejects "both bodyHtml and bodyNode" config (negative type test)', () => {
    // @ts-expect-error — xor: 둘 다 지정 시 type error (bodyHtml?: never / bodyNode?: never 위반)
    const cfgBoth: ModalConfig = {
      title: 'T',
      bodyHtml: '<p>x</p>',
      bodyNode: document.createElement('div'),
    };
    expect(cfgBoth).toBeDefined();
  });
});
