import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // generateSW: Workbox otomatik SW üretir — manifest çakışması olmaz
      strategies: 'generateSW',
      // Üretimde SW'yi otomatik güncelle
      registerType: 'autoUpdate',
      // globPatterns zaten tüm png ikonlarını precache ettiği için manifest ikonlarını mükerrer ekleme
      includeManifestIcons: false,
      // Dev modunda da SW'yi etkinleştir (push test için)
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'FlowDay',
        short_name: 'FlowDay',
        description: 'FlowDay - Kişisel Görev ve Günlük Planlayıcı',
        theme_color: '#0B0D13',
        background_color: '#0B0D13',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // firebase-messaging-sw.js ve push-sw.js Workbox tarafından precache edilmemeli
        globIgnores: ['firebase-messaging-sw.js', 'push-sw.js'],
        // Push bildirimi + notificationclick kodunu üretilen /sw.js içine dahil et
        importScripts: ['/push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    open: true,
  },
});
