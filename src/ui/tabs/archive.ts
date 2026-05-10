/**
 * Archive 탭 정적 마크업을 container에 렌더링한다.
 * 인라인 핸들러 없이 CustomEvent를 dispatch하여 Task 18에서 연결한다.
 */
import { loadAnswers } from '../../state/persistence';
import { getCachedUser } from '../../state/user';
import { KST_FMT_KO } from '../../utils/intl';
import { renderEntityChipRow } from '../components/archive-entity-chip';

const ONBOARDING_KEY = 'archive-relocated-seen';

export function renderArchive(container: HTMLElement): void {
  // v3.27 T2b: entity chip row(1차) + question type row(2차) 2-row 하이라키.
  // ⭐ 스크랩 chip 제거 (entity chip 'scrap' 흡수, P0-4).
  // is-new 배지 + tutorial overlay 1회 (sessionStorage gate).
  const showOnboarding = sessionStorage.getItem(ONBOARDING_KEY) !== '1';
  const onboardingHtml = showOnboarding
    ? `<div class="archive-relocated-banner" id="archiveRelocatedBanner" role="status"><span class="archive-relocated-badge">NEW</span><p class="archive-tutorial-overlay">인사이트가 아카이브로 이동했어요. 위쪽 카테고리 칩으로 답변·스크랩·인사이트를 분류하세요.</p><button type="button" id="archiveOnboardingDismiss" aria-label="안내 닫기">×</button></div>`
    : '';
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `<div class="archive-section" id="archiveTab"><div class="archive-header-row"><h2 style="margin-bottom:4px;">📚 나의 성장 아카이브</h2><div class="archive-header-actions"><button id="archiveSelectToggle" type="button" aria-pressed="false">선택</button><button id="archiveBulkDelete" type="button" disabled>선택 항목 삭제 (0)</button></div></div>${onboardingHtml}<p id="archiveCount">카테고리별로 기록을 필터링할 수 있어요</p>${renderEntityChipRow('all')}<div class="archive-search-wrap"><span class="archive-search-icon">🔍</span><input type="search" class="archive-search" id="archiveSearch" placeholder="질문, 답변, 인사이트 검색..."></div><div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;"><select class="archive-period" id="archivePeriod"><option value="all">전체 기간</option><option value="week">이번 주</option><option value="month">이번 달</option></select><div class="archive-filters" id="archiveFilters" style="margin-bottom:0;"><button class="filter-chip active" data-filter="all" title="답변 모든 유형">전체</button><button class="filter-chip" data-filter="분석" title="현상을 분석하고 원인을 파악하는 질문">🔍 분석형</button><button class="filter-chip" data-filter="전환" title="기존 관점을 바꿔 새로운 시각으로 보는 질문">🔄 전환형</button><button class="filter-chip" data-filter="실무" title="업무에 바로 적용할 수 있는 실천 중심 질문">🛠️ 실무형</button><button class="filter-chip" data-filter="성장" title="장기적 커리어와 역량 성장을 돌아보는 질문">🌱 성장형</button><button class="filter-chip" data-filter="트렌드" title="업계 트렌드와 변화를 읽는 질문">📊 트렌드</button></div></div><div id="archiveList"></div></div>`;

  populateList(container);
  bindHandlers(container);
}

/**
 * localStorage에서 답변 + insights를 읽어 #archiveList를 채운다.
 * v3.27 T2a: insights tab 폐기 후 archive 통합 렌더 — insights entity 카드 추가.
 */
function populateList(container: HTMLElement): void {
  const list = container.querySelector<HTMLElement>('#archiveList');
  if (!list) return;

  const answers = loadAnswers();
  const user = getCachedUser();
  const insights = user?.insights ?? [];

  if (answers.length === 0 && insights.length === 0) {
    list.textContent = '아직 저장된 답변이 없어요. 첫 답변을 남겨보세요.';
    return;
  }

  for (const a of answers) {
    const card = document.createElement('article');
    card.className = 'archive-card';
    card.dataset['answerId'] = a.id;

    const dateEl = document.createElement('div');
    dateEl.className = 'archive-date';
    dateEl.textContent = KST_FMT_KO.format(new Date(a.createdAt)); // v3.26 T1b: KST anchor (createdAt UTC ISO closing)

    const textEl = document.createElement('div');
    textEl.className = 'archive-text';
    textEl.textContent = a.text; // textContent — XSS 안전

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-card-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', '답변 삭제');
    deleteBtn.textContent = '×';

    card.append(dateEl, textEl, deleteBtn);
    list.append(card);
  }

  // v3.27 T2a: insights entity 카드 (insights tab 흡수). T2b chip filter + T4 핀 정렬에서 통합 처리.
  for (const i of insights) {
    const card = document.createElement('article');
    card.className = 'archive-card archive-insight-card';
    card.dataset['insightId'] = i.id;

    const dateEl = document.createElement('div');
    dateEl.className = 'archive-date';
    dateEl.textContent = KST_FMT_KO.format(new Date(i.createdAt));

    const textEl = document.createElement('div');
    textEl.className = 'archive-text';
    textEl.textContent = i.text;

    card.append(dateEl, textEl);
    list.append(card);
  }
}

/** CustomEvent 핸들러를 등록한다. Task 18에서 실제 로직으로 교체 예정. */
function bindHandlers(container: HTMLElement): void {
  // archiveSearch input → dg:archive:search
  const archiveSearch = container.querySelector<HTMLInputElement>('#archiveSearch');
  if (archiveSearch) archiveSearch.addEventListener('input', () => {
    document.dispatchEvent(new CustomEvent('dg:archive:search'));
  });

  // archivePeriod change → dg:archive:period-change
  const archivePeriod = container.querySelector<HTMLSelectElement>('#archivePeriod');
  if (archivePeriod) archivePeriod.addEventListener('change', () => {
    document.dispatchEvent(new CustomEvent('dg:archive:period-change'));
  });

  // filter-chip click → dg:archive:filter (이벤트 위임)
  const archiveFilters = container.querySelector<HTMLElement>('#archiveFilters');
  if (archiveFilters) archiveFilters.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-chip');
    if (!chip) return;
    const filter = chip.dataset['filter'] ?? 'all';
    document.dispatchEvent(new CustomEvent('dg:archive:filter', { detail: { filter } }));
  });
}
