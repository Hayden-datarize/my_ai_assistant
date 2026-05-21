# Firebase API Key HTTP Referrer 제한 + App Check Phase B

## 배경
Firebase Web API key는 client-side public이지만, GCP Credentials에서 HTTP referrer 제한 미설정 시
abuser가 본인 도메인에서 Firebase services 호출 가능. App Check Phase B와 함께 다중 보안층 구성.

⚠️ 한계 (Codex P2-2): 이 절차 + verify script는 GCP API key referrer 정책 자체의 동작 검증만.
Production Cloud Functions endpoint (`/api/sendAnswerDm`) 보호는 App Check Phase B `verifyToken()`
middleware (functions/src/sendAnswerDm.ts)가 담당. 다중 보안층의 sanity check 역할.

---

## 1. GCP Console — HTTP referrer 제한 (사용자 manual)

1. https://console.cloud.google.com/apis/credentials?project=my-ai-assistant-904f3 접속
2. **Browser key** (Firebase API key) 선택 — 일반적으로 "Browser key (auto created by Firebase)"
3. **Application restrictions** → "HTTP referrers (web sites)" 선택
4. 다음 referrer 추가:
   - `https://my-ai-assistant-904f3.web.app/*`
   - `https://my-ai-assistant-904f3.firebaseapp.com/*`
   - `http://localhost:*/*` (dev 환경)
5. 저장 → 적용까지 약 5분 대기

---

## 2. 검증 — verify-referrer.mjs

```bash
npm run verify:referrer
```

Expected 출력:

```
✓ allowed referrer (https://my-ai-assistant-904f3.web.app/) → 200 또는 400
✓ blocked referrer (https://attacker.example/) → 403

✅ HTTP referrer 제한 정상 작동
```

설정 직후 적용 대기 (~5분) 후 재실행.

---

## 3. App Check Phase B — Enforce 토글 (사용자 manual)

1. https://console.firebase.google.com/project/my-ai-assistant-904f3/appcheck/apps 접속
2. **Web 앱** 선택 → "API enforcement" 탭
3. Cloud Functions (`sendAnswerDm`) 항목 → "Monitor" → "Enforce" 토글
4. 24h 모니터 결과 ≥ 99% 확인 후 진행 (v3.41 Phase A 결과 인용, v3.45 deploy 직전 확인 완료)

**Note**: onRequest endpoint는 코드 middleware `getAppCheck().verifyToken()` (functions/src/sendAnswerDm.ts)가 primary. Console 토글은 미래 Firestore/RTDB/Storage 도입 대비 deep defense.

---

## 4. Rollback (시나리오 B 단일 확정, 시나리오 A는 미적용)

| 우선순위 | 액션 | 시간 |
|---|---|---|
| 1 | App Check verify middleware 비활성 deploy + `firebase deploy --only functions:sendAnswerDm` | 2~3분 |
| 2 | GCP HTTP referrer 제한 제거 (Console) | 즉시 (적용 ~5분) |
| 3 | 202 → 404/502 응답 contract revert + deploy | 2~3분 |
| 4 | Firebase Console "Enforce" → "Monitor" (현재 onRequest 무영향, 미래 endpoint 대비 deep defense) | 즉시 |

---

## 5. v3.46+ 확장

- API restrictions (App Check API + Identity Toolkit API만 허용) — Daily Growth가 다른 endpoint 도입 시
- dev key 분리 (localhost referrer 대신 별도 dev API key)
