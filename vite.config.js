import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/aeturnorder-app/', // <-- IMPORTANT for GitHub Pages
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Random Turn Generator",
        short_name: 'RTG',
        description: 'Turn order deck: P1 - P6 / Enemy',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/aeturnorder-app/', // match base for clean PWA launch
        icons: [
          { src: '/aeturnorder-app/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/aeturnorder-app/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/aeturnorder-app/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
