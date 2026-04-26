import { describe, it, expect } from 'vitest';
import { swapTitleInDOM } from '../../src/ui/handlers/home';

describe('swapTitleInDOM scoping', () => {
  it('scopes query to provided root, not document', () => {
    document.body.innerHTML = `
      <div id="rootA">
        <div data-briefing-id="dup"><span class="card-title">A</span></div>
      </div>
      <div id="rootB">
        <div data-briefing-id="dup"><span class="card-title">B</span></div>
      </div>
    `;
    const rootA = document.getElementById('rootA') as HTMLElement;
    swapTitleInDOM('dup', '교체됨', rootA);
    expect(rootA.querySelector('.card-title')?.textContent).toBe('교체됨');
    const rootB = document.getElementById('rootB') as HTMLElement;
    expect(rootB.querySelector('.card-title')?.textContent).toBe('B');
  });

  it('defaults to document when root omitted (back-compat)', () => {
    document.body.innerHTML = `
      <div data-briefing-id="solo"><span class="card-title">old</span></div>
    `;
    swapTitleInDOM('solo', 'new');
    expect(document.querySelector('[data-briefing-id="solo"] .card-title')?.textContent).toBe('new');
  });
});
