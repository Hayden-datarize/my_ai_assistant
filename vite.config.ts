import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
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
