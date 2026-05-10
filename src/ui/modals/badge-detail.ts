import { openModal } from './shared';
import { findBadge } from '../../state/badgeCatalog';
import { loadUserData } from '../../state/user';
import { escapeHtml } from '../../utils/escapeHtml';
import { KST_FMT_DATE } from '../../utils/intl';

export function openBadgeDetail(badgeId: string): void {
  const def = findBadge(badgeId);
  if (!def) return;
  const u = loadUserData();
  const unlockedAt = u?.earnedBadges?.[badgeId];
  const dateText = unlockedAt
    ? `${KST_FMT_DATE.format(new Date(unlockedAt))} 획득` // v3.26 T1b P1-1: KST anchor (UTC date prefix → KST)
    : `달성 조건: ${escapeHtml(def.description)}`;

  // v3.24 T3: indent 압축 (production-safe).
  const bodyHtml = `<div class="badge-modal"><div class="badge-modal-icon">${escapeHtml(def.icon)}</div><div class="badge-modal-name">${escapeHtml(def.name)}</div><div class="badge-modal-desc">${escapeHtml(def.description)}</div><div class="badge-modal-date">${dateText}</div></div>`;
  openModal({ title: '뱃지', bodyHtml });
}
