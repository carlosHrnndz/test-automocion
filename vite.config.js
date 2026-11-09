import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app cuelga de /nombre-del-repo/.
// El workflow de despliegue rellena VITE_BASE automáticamente.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg', 'icono-180.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Las preguntas se consultan primero por red (NetworkFirst) para que
        // los nuevos temas y correcciones lleguen al iPhone sin borrar caché,
        // pero siguen guardadas para funcionar sin cobertura.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Las ilustraciones no: son una por pregunta y descargarlas todas al
        // instalar la app serían muchos megas de golpe, la mayoría de
        // preguntas que quizá no estudies hoy. Se guardan al verlas.
        globIgnores: ['**/images/**', '**/data/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'banco-preguntas',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ilustraciones',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Test de Mecánica · Automoción',
        short_name: 'Test Automoción',
        description: 'Preparación del Técnico Superior en Automoción',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
