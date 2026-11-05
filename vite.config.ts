import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    proxy: {
      // Local dev: forward /api to the dev API server (scripts/dev-api.mts).
      // Production on Vercel serves /api from the serverless functions directly.
      '/api': {
        target: `http://localhost:${process.env.DEV_API_PORT || 8787}`,
        changeOrigin: true,
      },
    },
  },
});
