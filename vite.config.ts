import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    // Old Android WebViews (e.g. Android 7.1, Chrome ~53-58) can't parse
    // ES modules or ES2020 syntax (?., ??). This emits a transpiled,
    // polyfilled fallback bundle that those WebViews load instead.
    legacy({
      targets: ['android >= 5', 'chrome >= 50', 'ios >= 10'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
