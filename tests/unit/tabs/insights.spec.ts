import { describe, it, expect } from 'vitest';
import { renderInsights } from '../../../src/ui/tabs/insights';

describe('renderInsights', () => {
  it('mounts insights container', () => {
    const root = document.createElement('div');
    renderInsights(root);
    expect(root.querySelector('#insightsTab')).not.toBeNull();
    expect(root.querySelector('#insightContent')).not.toBeNull();
  });
  it('renders empty state message', () => {
    const root = document.createElement('div');
    renderInsights(root);
    const content = root.querySelector('#insightContent');
    expect(content?.textContent).toMatch(/아직 인사이트가 없어요/);
  });
  it('renders no inline handler attributes', () => {
    const root = document.createElement('div');
    renderInsights(root);
    expect(root.querySelectorAll('[onclick],[oninput],[onchange],[onkeydown]').length).toBe(0);
  });
});
