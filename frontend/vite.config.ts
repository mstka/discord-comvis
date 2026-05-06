import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': backendUrl,
        '/ws': { target: backendUrl.replace('http', 'ws'), ws: true },
      },
    },
    define: {
      // Expose backend URL to runtime for WebSocket construction
      __VITE_API_URL__: JSON.stringify(backendUrl),
    },
  }
})
