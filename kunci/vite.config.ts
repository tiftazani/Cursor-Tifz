import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'https://kunci-tifta.netlify.app', changeOrigin: true, secure: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: 'https://kunci-tifta.netlify.app', changeOrigin: true, secure: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
