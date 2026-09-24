import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

/**
 * extension/VERSION is the one version number. It is baked into the app at build
 * time so no view has to hardcode it (a hardcoded copy went stale for weeks).
 */
const KUNCI_VERSION = readFileSync(new URL('./extension/VERSION', import.meta.url), 'utf8').trim()

export default defineConfig({
  plugins: [react()],
  define: { __KUNCI_VERSION__: JSON.stringify(KUNCI_VERSION) },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'https://kunci.tiftazani-cuciin.workers.dev', changeOrigin: true, secure: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: 'https://kunci.tiftazani-cuciin.workers.dev', changeOrigin: true, secure: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
