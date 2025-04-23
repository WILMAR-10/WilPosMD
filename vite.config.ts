import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinModules } from 'module';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        ...builtinModules,
        'electron'
      ]
    }
  },
  server: {
    port: 3000
  },
  optimizeDeps: {
    exclude: ['electron']
  }
});