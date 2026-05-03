/**
 * Home 탭 정적 마크업을 container에 렌더링한다.
 * 인라인 핸들러 없이 CustomEvent를 dispatch하여 Task 18에서 연결한다.
 */
export function renderHome(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div id="homeTab">
      <div class="header">
        <div class="header-left">
          <h1>🌱 Daily Growth</h1>
          <div class="greeting" id="greetingText"></div>
        </div>
        <div class="header-right">
          <button class="header-btn" title="테마 변경" id="themeBtn">🌙</button>
        </div>
      </div>

      <!-- Backup Reminder Banner -->
      <div class="backup-banner hidden" id="backupBanner">
        <span>데이터가 이 브라우저에만 저장돼요. 백업을 권장합니다.</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <a>백업하기</a>
          <button class="dismiss">&times;</button>
        </div>
      </div>

      <!-- Demo Mode Banner -->
      <div class="demo-banner hidden" id="demoBanner">
        💡 지금은 체험 모드예요. AI 기능을 활성화하려면 <a id="demoBannerSettingsLink">설정에서 API 키 입력</a>
      </div>

      <!-- Streak Banner -->
      <div class="streak-banner" id="streakBanner">
        <div class="streak-info">
          <span class="streak-fire">🔥</span>
          <span class="streak-count" id="streakCount">0</span>
          <span class="streak-label">일 연속 성장 중!</span>
        </div>
        <span class="xp-badge" id="xpBadge">0 XP</span>
      </div>

      <!-- Garden Mini Preview -->
      <div id="gardenMini"></div>

      <!-- Briefing Section -->
      <div class="section-header">
        <h2>📰 오늘의 브리핑</h2>
        <span class="see-all" id="refreshBriefing">🔄 새로고침</span>
      </div>
      <div class="briefing-scroll" id="briefingScroll">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
      <div class="scroll-indicator" id="scrollIndicator"></div>

      <!-- Question Section -->
      <div class="section-header">
        <h2>🧠 오늘의 질문</h2>
      </div>
      <div class="question-section" id="questionSection">
        <div id="questionContent">
          <div class="skeleton" style="height:20px;width:80px;margin-bottom:12px;"></div>
          <div class="skeleton" style="height:60px;margin-bottom:16px;"></div>
        </div>
        <textarea class="answer-area" id="answerArea" placeholder="여기에 답변을 입력하세요... ✍️"></textarea>
        <div class="answer-footer">
          <span class="char-count" id="charCount">0자</span>
          <button class="hint-toggle">💡 힌트가 필요하세요?</button>
        </div>
        <div class="hint-box" id="hintBox"></div>
        <div class="submit-row">
          <button class="btn btn-primary btn-block" id="submitBtn">
            💬 답변 제출하기
          </button>
        </div>
      </div>

      <!-- AI Chat -->
      <div class="chat-container" id="chatContainer">
        <div class="chat-header">
          <h3>💬 AI와 대화하기</h3>
          <span class="turn-counter" id="turnCounter">턴 0/5</span>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-row">
          <input class="chat-input" id="chatInput" placeholder="메시지를 입력하세요...">
          <button class="chat-send-btn">▶</button>
        </div>
        <button class="chat-summary-btn" id="summarizeChatBtn">📋 대화 정리하기</button>
        <button class="chat-summary-btn" id="generateInsightBtn" style="margin-top:4px;background:linear-gradient(135deg,var(--primary),#7C3AED);color:#fff;">🎴 인사이트 카드 만들기</button>
      </div>
    </div>

    <!-- Action Suggestion (shown after AI chat summary) -->
    <div class="action-card hidden" id="actionCard">
      <div class="action-card-title">오늘의 액션 아이템</div>
      <div class="action-card-text" id="actionCardText"></div>
    </div>
  `;

  bindHandlers(container);
}

/** CustomEvent 핸들러를 등록한다. Task 18에서 실제 로직으로 교체 예정. */
function bindHandlers(container: HTMLElement): void {
  // toggleTheme
  const themeBtn = container.querySelector<HTMLButtonElement>('#themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:toggle-theme'));
  });

  // exportData (backup 배너의 백업하기 링크)
  const backupBanner = container.querySelector<HTMLElement>('#backupBanner');
  const backupLink = backupBanner?.querySelector('a') ?? null;
  if (backupLink) backupLink.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:export-data'));
  });

  // dismissBackupBanner
  const dismissBtn = backupBanner?.querySelector<HTMLButtonElement>('button.dismiss') ?? null;
  if (dismissBtn) dismissBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:dismiss-backup'));
  });

  // switchTab('settings', ...) — demo 배너의 설정 링크
  const demoBannerSettingsLink = container.querySelector<HTMLAnchorElement>('#demoBannerSettingsLink');
  if (demoBannerSettingsLink) demoBannerSettingsLink.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:switch-tab', { detail: { tab: 'settings' } }));
  });

  // refreshBriefings
  const refreshBriefing = container.querySelector<HTMLElement>('#refreshBriefing');
  if (refreshBriefing) refreshBriefing.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:refresh-briefings'));
  });

  // updateCharCount (oninput)
  const answerArea = container.querySelector<HTMLTextAreaElement>('#answerArea');
  if (answerArea) answerArea.addEventListener('input', () => {
    document.dispatchEvent(new CustomEvent('dg:home:update-char-count'));
  });

  // toggleHint
  const hintToggle = container.querySelector<HTMLButtonElement>('.hint-toggle');
  if (hintToggle) hintToggle.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:toggle-hint'));
  });

  // submitAnswer
  const submitBtn = container.querySelector<HTMLButtonElement>('#submitBtn');
  if (submitBtn) submitBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:submit-answer'));
  });

  // sendChatMessage — Enter 키
  const chatInput = container.querySelector<HTMLInputElement>('#chatInput');
  if (chatInput) chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.dispatchEvent(new CustomEvent('dg:home:send-chat'));
    }
  });

  // sendChatMessage — 전송 버튼
  const chatSendBtn = container.querySelector<HTMLButtonElement>('.chat-send-btn');
  if (chatSendBtn) chatSendBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:send-chat'));
  });

  // summarizeChat
  const summarizeChatBtn = container.querySelector<HTMLButtonElement>('#summarizeChatBtn');
  if (summarizeChatBtn) summarizeChatBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:summarize-chat'));
  });

  // generateInsightCard
  const generateInsightBtn = container.querySelector<HTMLButtonElement>('#generateInsightBtn');
  if (generateInsightBtn) generateInsightBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:home:generate-insight-card'));
  });
}
