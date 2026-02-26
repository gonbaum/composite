import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/strapi': {
          target: env.VITE_STRAPI_URL || 'http://localhost:1337',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/strapi/, '/api'),
          headers: {
            Authorization: `Bearer ${env.VITE_STRAPI_TOKEN}`,
          },
        },
      },
    },
  }
})
