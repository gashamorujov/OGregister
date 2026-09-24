import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Portable config: works locally, on Vercel/Netlify/Firebase Hosting/GitHub Pages/
// any static host, or any container platform. No required env vars.
//
// - PORT: dev/preview server port (defaults to 5173)
// - BASE_PATH: set this if deploying under a sub-path (e.g. GitHub Pages
//   project sites: "/repo-name/"). Defaults to "/" for everything else.
const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    host: '0.0.0.0',
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
});
