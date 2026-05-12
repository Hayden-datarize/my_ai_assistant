import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // v3.29 T3 (Codex 사전 P1-3 / R4 P1): vendor split placeholder — 자주 변경되지
          // 않는 외부 lib 분리 (cache 효율). 현재 외부 deps 없음 (Vite SPA + raw TS) — 향후
          // 추가 시 활성. Real trim win은 nav.ts/main.ts의 await import() 자체에서 옴.
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/smoke/**'],
    // 신규: KST 강제 (v3.14.5 T4 패턴 D — 모든 vitest spec이 KST anchor 가정)
    env: {
      TZ: 'Asia/Seoul',
    },
  },
});
