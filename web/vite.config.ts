import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // No manualChunks: recharts is reached only through the dynamic import
    // in LazyMarginChart, so Rollup keeps it out of the initial graph on its
    // own. Naming it here would pull it back into the static preload set.
    chunkSizeWarningLimit: 700,
  },
});
