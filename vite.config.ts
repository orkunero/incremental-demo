import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset paths, so the build works from any folder (GitHub Pages project sites, artifacts)
  base: './',
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
});
