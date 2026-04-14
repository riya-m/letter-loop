import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/jsonBlob': {
        target: 'https://jsonblob.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
