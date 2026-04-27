# Tests — Isolation & Stability Guidelines

이 디렉토리는 vitest unit/integration spec과 Playwright e2e spec의 컨벤션을 따릅니다. 본 문서는 spec 작성 시 isolation 패턴과 flake 방지 가이드라인을 정리합니다.

## 1. Dynamic Import 패턴

`vi.mock()` 또는 module-state-sharing 우려가 있는 spec에서는 정적 import 대신 동적 import를 사용합니다. **동적 import 사용 시 반드시 `vi.resetModules()`를 사전에 호출**하세요.

```ts
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

it('does X', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(/* ... */);
  const { someFn } = await import('../../src/foo');
  // ...
});
```

## 2. 비동기 폴링 — `setTimeout` 금지

비동기 effect를 기다릴 때 `setTimeout(resolve, N)`로 sleep하지 마세요. **`vi.waitFor`** 또는 Playwright의 **`expect.poll`**을 사용하세요.

```ts
// ❌ 금지 — flaky
await new Promise((r) => setTimeout(r, 100));

// ✅ vitest
await vi.waitFor(() => expect(document.querySelector('.toast')).not.toBeNull());

// ✅ Playwright
await expect.poll(() => page.locator('.toast').count()).toBeGreaterThan(0);
```

예외: `vi.useFakeTimers()` + `vi.advanceTimersByTime(N)`로 의도적 timer 검증은 OK.

## 3. Module-level Mock — Hoisting 주의

`vi.mock()`는 spec 상단에서 hoisting됩니다. 순서 의존이 있을 때 `vi.unmock()` 또는 `vi.doMock()` (no hoisting) 사용을 고려하세요.

## 4. DOM 테스트 Cleanup

jsdom 기반 spec에서 DOM mutation은 spec 간 leak됩니다. `afterEach`에 cleanup 강제:

```ts
afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
```

⚠️ `document.body.innerHTML = ''`는 ESLint 룰(`no-inner-html`)에 의해 금지됩니다. `replaceChildren()` 또는 명시적 `removeChild` 사용.

## 5. afterEach 위치 컨벤션

`afterEach`는 첫 `it` 블록 **앞**에 배치하세요. Vitest는 위치와 무관하게 모든 `it`에 적용하지만, 후속 spec 작성자가 못 보는 함정을 만듭니다.

```ts
describe('X', () => {
  beforeEach(() => { /* setup */ });
  afterEach(() => { vi.restoreAllMocks() });   // ✅ 첫 it 앞

  it('case A', () => { /* ... */ });
  it('case B', () => { /* ... */ });
});
```

## 6. N=5 연속 Pass DoD

신규/수정 spec은 5회 연속 pass 확인을 권장합니다:

```bash
for i in {1..5}; do npx vitest run tests/unit/your-spec.ts || break; done
```

전체 테스트 안정성 확인:

```bash
for i in {1..5}; do npm test || break; done
```

flake 발견 시 — 대부분 isolation 문제 (mock leak, DOM leak, module state leak)입니다. §1, §4 가이드 우선 적용.

## 7. localStorage 모킹

`Storage.prototype.setItem`을 spy해서 throw 시뮬:

```ts
// 단발 throw
vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
  throw new DOMException('quota', 'QuotaExceededError');
});

// 특정 key만 throw (다른 key는 정상 동작)
vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
  if (key === 'user') throw new DOMException('quota', 'QuotaExceededError');
});
```

후자 사용 시 spec 끝에 `vi.restoreAllMocks()` 필수 (`afterEach`에 자동화 권장).

## 8. 신규 spec 추가 체크리스트

- [ ] `beforeEach`에 `localStorage.clear()` + `document.body.replaceChildren()` (필요 시)
- [ ] `afterEach`에 `vi.restoreAllMocks()` (mock 사용 시) — 첫 `it` 앞에 배치
- [ ] dynamic import 사용 시 `vi.resetModules()` (필요 시)
- [ ] 비동기 effect는 `vi.waitFor` 사용 (직접 `setTimeout` 금지)
- [ ] N=5 연속 pass 확인

---

본 가이드라인은 v3.7 사이클에서 정립되었습니다. 새 패턴 발견 시 PR로 갱신하세요.
