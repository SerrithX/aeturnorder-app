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
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        },
        includeAssets: [
          'cards/*.webp',          // public/cards/...
          'icons/*.png',           // public/icons/...
          // remove 'apple-touch-icon.png' if it's inside /icons
          // add it only if you also have public/apple-touch-icon.png at the root
        ],
        manifest: {
          // ...
          start_url: '/aeturnorder-app/',
          scope: '/aeturnorder-app/',
          icons: [
            { src: '/aeturnorder-app/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/aeturnorder-app/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/aeturnorder-app/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      })

  ],
})
