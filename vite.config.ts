import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'
import { sitePlugin } from './build/simplePage.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Absolute URL for Open Graph tags. Set SITE_URL in Vercel once you have a domain.
  const siteUrl = (
    env.SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173')
  ).replace(/\/$/, '')

  return {
    plugins: [react(), sitePlugin(siteUrl)],
    build: {
      target: 'es2022',
      // The 3D bundle is intentionally one lazy chunk, loaded behind the loader.
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          simple: resolve(import.meta.dirname, 'simple/index.html'),
        },
      },
    },
  }
})
