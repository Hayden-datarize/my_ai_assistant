#!/usr/bin/env node
// v3.45 C7: GCP API key HTTP referrer 제한 sanity check.
// ⚠️ Codex P2-2: 이 script는 GCP API key referrer 정책 자체의 동작 검증만. App Check Token API
// 및 production Cloud Functions endpoint 보호는 별개 axis (App Check verify middleware로 처리).
// 즉 "GCP referrer 설정이 의도대로 활성됐는지" sanity check이며, "production endpoint가 보호되는가" 증명 X.
//
// 검증 대상: Firebase Identity Toolkit endpoint (Daily Growth 미사용, 단 GCP key referrer 정책 검증용)
// 1. 정상 referrer (https://my-ai-assistant-904f3.web.app/) → referrer 통과 후 4xx Auth/Bad Request 가능
// 2. 잘못된 referrer (https://attacker.example/) → 401/403 referrer 차단

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.VITE_FIREBASE_API_KEY;
if (!API_KEY) {
  console.error('❌ VITE_FIREBASE_API_KEY missing in .env.local');
  process.exit(1);
}

const ENDPOINT = `https://identitytoolkit.googleapis.com/v1/projects?key=${API_KEY}`;

const ALLOWED_REFERER = 'https://my-ai-assistant-904f3.web.app/';
const BLOCKED_REFERER = 'https://attacker.example/';

async function check(referer, expectedBlocked) {
  const res = await fetch(ENDPOINT, {
    method: 'GET',
    headers: { Referer: referer },
  });
  const status = res.status;
  const blocked = status === 403 || status === 401;
  const label = expectedBlocked ? 'blocked' : 'allowed';
  const ok = expectedBlocked === blocked;
  console.log(`${ok ? '✓' : '✗'} ${label} referrer (${referer}) → ${status}`);
  return ok;
}

const allowed = await check(ALLOWED_REFERER, false);
const blocked = await check(BLOCKED_REFERER, true);

if (allowed && blocked) {
  console.log('\n✅ HTTP referrer 제한 정상 작동');
  process.exit(0);
} else {
  console.log('\n⚠️ HTTP referrer 제한 검증 실패 — Console 설정 또는 적용 대기 확인');
  process.exit(1);
}
