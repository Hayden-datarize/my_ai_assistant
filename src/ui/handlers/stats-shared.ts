/**
 * v3.30 T3 (v3.29 carry C1): stats.ts의 helper 격리.
 * home.ts / welcome-garden.ts static importer 때문에 stats.ts dynamic split이 일부 무효화되던 문제 해소.
 * 본 module은 가벼운 helper만 — 렌더러는 stats.ts 본문에 유지 (dynamic chunk).
 */

/** 환영 모달 등 외부 호출용 — #gardenSection으로 부드럽게 스크롤한다. */
export function scrollToGardenSection(): void {
  const section = document.getElementById('gardenSection');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
