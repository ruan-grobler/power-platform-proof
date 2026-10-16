/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Fixed ports so this project never collides with other local Vite apps.
// `npm run dev` serves on 5180, `npm run preview` (built output) on 4180.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
  build: {
    // Keep the default Vite output (dist/assets/index-[hash].js and .css)
    // so the bundleFilePatterns in powerpages.config.json stay accurate.
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
