/**
 * v3.32 T6 (v3.30 T5 P2 carry): nav.spec.ts에서 추출된 controlled deferred loader helper.
 *
 * 용도: dynamic import 기반 lazy-loaded module의 out-of-order resolve를 결정론으로 시뮬레이션.
 * - load(): 외부에서 resolve를 호출하기 전까지 pending 상태인 Promise를 반환
 * - resolve(): pending Promise를 settled로 전환 (render 콜백을 payload로 반환)
 *
 * parallel safety: 각 호출이 독립 Promise/resolver를 생성하므로 spec간 간섭 없음.
 *
 * Note: signature는 nav.spec.ts 호출부와 정합 — 호출부 inline 타입 annotation 없이 추론 작동.
 *       추후 다른 spec이 다른 payload 타입을 요구하면 그때 generic 격상 (YAGNI).
 */
export function createDeferredLoader(
  render: (c: HTMLElement) => void,
): { load: () => Promise<(c: HTMLElement) => void>; resolve: () => void } {
  let resolveFn!: () => void;
  const pending = new Promise<(c: HTMLElement) => void>((res) => {
    resolveFn = () => res(render);
  });
  return { load: () => pending, resolve: resolveFn };
}
