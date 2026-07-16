/// <reference types="vitest" />
import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Portable "Offline Edition": `PORTABLE=true vite build` inlines everything into
// one self-contained index.html that runs from a USB stick via file://. The PWA
// service worker can't register from file://, so it's dropped in this mode, and
// a relative base lets assets resolve without a server.
const portable = process.env.PORTABLE === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  base: portable ? './' : '/',
  // Build-time flag so portable-only dead code (e.g. the lazy SheetJS import,
  // which vite-plugin-singlefile would otherwise inline wholesale) is dropped
  // statically from the single-file build.
  define: {
    __PORTABLE_BUILD__: JSON.stringify(portable),
  },
  plugins: [
    vue(),
    Vuetify({ autoImport: true }),
    ...(portable
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'pwa-192.png', 'pwa-512.png'],
            manifest: {
              name: 'Drawing Selector',
              short_name: 'Draw',
              description: 'Random prize drawing with CSV import',
              theme_color: '#1e3d59',
              background_color: '#e0f7fa',
              display: 'standalone',
              start_url: '/',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            },
          }),
        ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    // Inlined single-file output can't carry external source maps usefully.
    sourcemap: !portable,
    outDir: portable ? 'dist-portable' : 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
