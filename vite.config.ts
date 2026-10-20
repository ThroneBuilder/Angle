import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  // three.js (about 560 kB) is its own chunk, loaded only when the 3D view first opens.
  build: { chunkSizeWarningLimit: 600 },
});
