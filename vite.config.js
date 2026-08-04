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
        // Las preguntas también se cachean: la app funciona sin cobertura.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: base + 'index.html',
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
