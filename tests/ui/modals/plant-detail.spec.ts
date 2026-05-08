import { describe, it, expect, beforeEach } from 'vitest';
import { openPlantDetailModal } from '../../../src/ui/modals/plant-detail';
import { saveUser } from '../../../src/state/user';
import { closeModal } from '../../../src/ui/modals/shared';
import { mkUser } from '../../unit/state/userFixture';

describe('plant-detail modal shell', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('openPlantDetailModal — modal DOM 존재', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as any },
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.dg-modal')).toBeTruthy();
    expect(document.querySelector('.plant-detail-modal')).toBeTruthy();
  });

  it('closeModal() 호출 시 DOM 제거', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as any },
    }));
    openPlantDetailModal('leadership');
    closeModal();
    expect(document.querySelector('.dg-modal')).toBeFalsy();
  });
});
