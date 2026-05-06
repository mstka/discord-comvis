import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // ローカル開発時のみ使用 (Docker稼働時は nginx が /api を backend にプロキシ)
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws':  { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
})
