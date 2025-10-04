import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Critical for GitHub Pages
  base: '/aeturnorder-app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // Make sure images (including .webp) are precached in the prod build
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
      },

      // If your card images live in /public/cards, this ensures they’re copied and available
      includeAssets: [
        'cards/*.webp',
        'icons/*.png',
        'apple-touch-icon.png',
      ],

      manifest: {
        name: 'Random Turn Generator',
        short_name: 'RTG',
        description: 'Turn order deck: P1 - P6 / Enemy',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',

        // Match your GitHub Pages base
        start_url: '/aeturnorder-app/',
        scope: '/aeturnorder-app/',

        icons: [
          { src: '/aeturnorder-app/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/aeturnorder-app/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/aeturnorder-app/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // Optional: make runtime image requests blazing fast too
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-v1',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
          },
        },
      ],
    }),
  ],
})
