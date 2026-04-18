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
  },
});
