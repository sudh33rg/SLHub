import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The @nx/vite:build executor runs Vite from the workspace root, so we point
// `root` at this app directory where index.html / src live.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});