import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This is the port you are using in your docker-compose.override.yml
    port: 5173,
    // This is the proxy configuration
    proxy: {
      // Any request starting with '/api' will be forwarded
      '/api': {
        // Forward it to the homelab-dashboard container on its port 5000
        target: 'http://homelab-dashboard:5000',
        // Necessary for virtual hosts
        changeOrigin: true,
      }
    },
    watch: {
      usePolling: true,
    },
    allowedHosts: [
      'http://localhost:5173',
      'homelab-dashboard',
      'dashboard-dev'
    ]
  }
})
