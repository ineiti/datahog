import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/blocks/index': 'src/plugins/blocks/index.ts',
    'plugins/inlines/index': 'src/plugins/inlines/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['rxjs'],
  onSuccess: async () => {
    // Copy CSS file to dist for npm package distribution
    copyFileSync('src/md-editor.css', 'dist/md-editor.css');
    console.log('✓ Copied md-editor.css to dist/');
  }
});
