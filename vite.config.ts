import { defineConfig } from 'vite';

export default defineConfig({
  root: 'webview-ui',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  base: './',
});
