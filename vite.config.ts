import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    // v3.30 T6 (v3.29 C2): 빈 manualChunks placeholder drop — 외부 deps 0 상태에서
    // 효과 없음. 향후 vendor split 필요 시 rollupOptions.output.manualChunks 재도입.
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/smoke/**'],
    // Node 22+/26 native Web Storage가 jsdom localStorage/sessionStorage를 가리는 문제 보정
    setupFiles: ['./tests/setup/web-storage-polyfill.ts'],
    // 신규: KST 강제 (v3.14.5 T4 패턴 D — 모든 vitest spec이 KST anchor 가정)
    env: {
      TZ: 'Asia/Seoul',
    },
  },
});
