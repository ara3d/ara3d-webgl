import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      formats: ['es', 'umd'],
      entry: resolve(__dirname, './src/index.ts'),
      name: 'ara3d',
    }
  }
})
