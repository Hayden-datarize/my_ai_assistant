/**
 * v3.41 T1 (Codex P0 F1): Firebase App Check — Slack DM relay 공개 abuse 차단.
 *
 * Phase A (현재): site key 등록 + frontend `getAppCheckToken()` deploy.
 *                 Console enforce OFF / Monitor mode → 사용자 충격 없이 token 발급률
 *                 24h monitor.
 * Phase B (T8 retro 후 별도 deploy): backend `enforceAppCheck: true` + Console
 *                 Enforce ON. controller가 사용자 명시 후 진행.
 *
 * 정책:
 * - SITE_KEY 미설정 (env 누락) 시 silent fallback (token null) — 개발 환경 호환
 * - `isTokenAutoRefreshEnabled: true` (재발급 자동)
 * - DEV 환경에서만 debug token 활성 (production 빌드에서 strip)
 */
import { initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from 'firebase/app-check';

const SITE_KEY = import.meta.env['VITE_APP_CHECK_SITE_KEY'] ?? '';

// 개발용 debug token (production 빌드에서 자동 stripped)
// globalThis 사용으로 ESLint browser/worker env 의존 회피.
if (import.meta.env.DEV) {
  (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheck: AppCheck | null = null;

function getAppCheck(): AppCheck | null {
  if (appCheck) return appCheck;
  if (!SITE_KEY) {
    if (import.meta.env.DEV) {
      console.warn('[appCheck] VITE_APP_CHECK_SITE_KEY missing — token will be null');
    }
    return null;
  }
  try {
    const firebaseApp = initializeApp({
      apiKey: import.meta.env['VITE_FIREBASE_API_KEY'] ?? '',
      authDomain: 'my-ai-assistant-904f3.firebaseapp.com',
      projectId: 'my-ai-assistant-904f3',
      appId: import.meta.env['VITE_FIREBASE_APP_ID'] ?? '',
    });
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheck;
  } catch (err) {
    console.warn('[appCheck] init failed', err);
    return null;
  }
}

/**
 * App Check token 발급. Phase A에서는 backend enforce OFF라 null 반환되어도
 * Slack DM 정상 작동. Phase B 이후 token null이면 401 차단됨.
 */
export async function getAppCheckToken(): Promise<string | null> {
  const ac = getAppCheck();
  if (!ac) return null;
  try {
    const result = await getToken(ac, /* forceRefresh */ false);
    return result.token;
  } catch (err) {
    console.warn('[appCheck] getToken failed', err);
    return null;
  }
}
