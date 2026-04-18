import { describe, it, expect } from 'vitest';
import { renderHome } from '../../../src/ui/tabs/home';

describe('renderHome', () => {
  it('mounts homeTab container with question content placeholder', () => {
    const root = document.createElement('div');
    renderHome(root);
    expect(root.querySelector('#homeTab')).not.toBeNull();
    expect(root.querySelector('#questionContent')).not.toBeNull();
  });

  it('renders no inline handler attributes', () => {
    const root = document.createElement('div');
    renderHome(root);
    expect(root.querySelectorAll('[onclick],[oninput],[onkeydown]').length).toBe(0);
  });
});
