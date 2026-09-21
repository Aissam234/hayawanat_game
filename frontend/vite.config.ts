import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', 'Referrer-Policy': 'no-referrer-when-downgrade' },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.WS_PROXY_TARGET || process.env.VITE_WS_URL || 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
