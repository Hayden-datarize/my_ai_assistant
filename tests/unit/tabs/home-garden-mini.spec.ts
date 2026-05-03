import { describe, it, expect, beforeEach } from 'vitest';
import { renderHome } from '../../../src/ui/tabs/home';

beforeEach(() => {
  localStorage.clear();
});

describe('홈 #gardenMini integration', () => {
  it('#gardenMini placeholder 존재', () => {
    const c = document.createElement('div');
    renderHome(c);
    expect(c.querySelector('#gardenMini')).toBeTruthy();
  });

  it('#gardenMini는 streakBanner 뒤, 브리핑 섹션 앞', () => {
    const c = document.createElement('div');
    renderHome(c);
    const streakBanner = c.querySelector('#streakBanner');
    const gardenMini = c.querySelector('#gardenMini');
    const briefingScroll = c.querySelector('#briefingScroll');
    if (streakBanner && gardenMini) {
      // gardenMini는 streakBanner 뒤에 위치해야 함
      expect(
        streakBanner.compareDocumentPosition(gardenMini) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    if (gardenMini && briefingScroll) {
      // gardenMini는 briefingScroll 앞에 위치해야 함
      expect(
        gardenMini.compareDocumentPosition(briefingScroll) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
