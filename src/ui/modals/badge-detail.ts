import { openModal } from './shared';
import { findBadge } from '../../state/badgeCatalog';
import { loadUserData } from '../../state/user';
import { escapeHtml } from '../../utils/escapeHtml';

export function openBadgeDetail(badgeId: string): void {
  const def = findBadge(badgeId);
  if (!def) return;
  const u = loadUserData();
  const unlockedAt = u?.earnedBadges?.[badgeId];
  const dateText = unlockedAt
    ? `${new Date(unlockedAt).toISOString().slice(0, 10)} 획득`
    : `달성 조건: ${escapeHtml(def.description)}`;

  const bodyHtml = `
    <div class="badge-modal">
      <div class="badge-modal-icon">${escapeHtml(def.icon)}</div>
      <div class="badge-modal-name">${escapeHtml(def.name)}</div>
      <div class="badge-modal-desc">${escapeHtml(def.description)}</div>
      <div class="badge-modal-date">${dateText}</div>
    </div>
  `;
  openModal({ title: '뱃지', bodyHtml });
}
