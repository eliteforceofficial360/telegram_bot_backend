import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/upload-profile-photo': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/check-membership': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/verify-captcha': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable fast, memory-safe esbuild minification
    minify: 'esbuild',
    // Target universal modern browser standards (iOS Safari, Brave, Chrome, Android WebViews)
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
  },
});
