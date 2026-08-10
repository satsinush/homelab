import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    fs: {
      // Allow importing from ../shared
      allow: ['.', '..'],
    },
    // This is the port you are using in your docker-compose.override.yml
    port: 5173,
    // This is the proxy configuration
    proxy: {
      // Any request starting with '/api' will be forwarded
      '/api': {
        // Forward it to the dashboard container on its port 5000
        target: 'http://dashboard:5000',
        // Necessary for virtual hosts
        changeOrigin: true,
      }
    },
    watch: {
      usePolling: true,
    },
    allowedHosts: [
      'http://localhost:5173',
      'dashboard',
      'dashboard-dev'
    ]
  }
})
