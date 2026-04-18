import { describe, it, expect } from 'vitest';
import { renderHome } from '../../../src/ui/tabs/home';

describe('renderHome', () => {
  it('mounts homeTab container with question content placeholder', () => {
    const root = document.createElement('div');
    renderHome(root);
    expect(root.querySelector('#homeTab')).not.toBeNull();
    expect(root.querySelector('#questionContent')).not.toBeNull();
  });
});
