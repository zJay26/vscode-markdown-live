import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { watch: { ignored: ['**/.local-test/**', '**/artifacts/**', '**/test-results/**'] } },
  build: { outDir: 'dist/webview', emptyOutDir: true, chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { entryFileNames: 'main.js', assetFileNames: 'assets/[name]-[hash][extname]' } } },
});
