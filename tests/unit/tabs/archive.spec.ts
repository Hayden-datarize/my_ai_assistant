import { describe, it, expect, beforeEach } from 'vitest';
import { renderArchive } from '../../../src/ui/tabs/archive';

beforeEach(() => {
  localStorage.clear();
});

describe('renderArchive', () => {
  it('mounts archive container', () => {
    const root = document.createElement('div');
    renderArchive(root);
    expect(root.querySelector('#archiveTab')).not.toBeNull();
    expect(root.querySelector('#archiveList')).not.toBeNull();
  });
  it('renders empty state with friendly message when no entries', () => {
    const root = document.createElement('div');
    renderArchive(root);
    const list = root.querySelector('#archiveList');
    expect(list?.textContent).toMatch(/아직 저장된 답변이 없어요/);
  });
  it('renders no inline handler attributes', () => {
    const root = document.createElement('div');
    renderArchive(root);
    expect(root.querySelectorAll('[onclick],[oninput],[onchange],[onkeydown]').length).toBe(0);
  });
});
