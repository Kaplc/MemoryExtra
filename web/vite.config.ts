import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // 开发时代理后端 API
      '/status': 'http://localhost:8577',
      '/settings': 'http://localhost:8577',
      '/system-info': 'http://localhost:8577',
      '/chart-data': 'http://localhost:8577',
      '/memory-count': 'http://localhost:8577',
      '/flask': 'http://localhost:8577',
      '/reload-model': 'http://localhost:8577',
      '/wiki': 'http://localhost:8577',
      '/aibrain-config': 'http://localhost:8577',
      '/save-aibrain-config': 'http://localhost:8577',
      '/select-directory': 'http://localhost:8577',
      '/check-path': 'http://localhost:8577',
      '/log': 'http://localhost:8577',
      '/memory': 'http://localhost:8577',
      '/search': 'http://localhost:8577',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    esbuild: {
      drop: [],
    },
  },
})
