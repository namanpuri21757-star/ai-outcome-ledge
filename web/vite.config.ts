import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // recharts + d3 are ~two thirds of the bundle and are only needed once
        // a row is expanded. Splitting them lets the ledger itself paint first.
        manualChunks: {
          charts: ['recharts'],
          vendor: ['react', 'react-dom', '@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
