import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Sert de sous-chemin sur GitHub Pages (https://<user>.github.io/rangemaker/).
// En local (npm run dev / preview) la racine reste "/".
const base = process.env.GITHUB_PAGES ? '/rangemaker/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png'],
      manifest: {
        lang: 'fr',
        name: 'RangeMaker — Matrices de ranges poker',
        short_name: 'RangeMaker',
        description: "Créateur, consultation et entraînement de ranges d'ouverture poker (13x13).",
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0b0d13',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '240x240', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '640x640', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '640x640', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})
