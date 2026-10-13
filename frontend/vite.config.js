import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/crop': 'http://127.0.0.1:8000',
      '/disease': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/market': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
