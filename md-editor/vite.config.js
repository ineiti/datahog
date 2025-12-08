import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples',
  resolve: {
    alias: {
      '@styles': resolve(__dirname, 'src'),
      '@dist': resolve(__dirname, 'dist')
    }
  },
  server: {
    port: 3000,
    // Allow serving files from one level up (parent directory)
    fs: {
      allow: ['..']
    }
  }
});