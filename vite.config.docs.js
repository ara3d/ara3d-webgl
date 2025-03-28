import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/ara3d-webgl/',
  root: resolve(__dirname, 'examples'),
  build: {
    outDir: resolve(__dirname, 'docs'),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        input: resolve(__dirname, 'examples/index.html'),
        exampleBasic: resolve(__dirname, 'examples/example-basic.html'),
        exampleColors: resolve(__dirname, 'examples/example-colors.html'),
        exampleIsolation: resolve(__dirname, 'examples/example-isolation.html'),
        exampleMultiVim: resolve(__dirname, 'examples/example-multivim.html'),
        exampleOutline: resolve(__dirname, 'examples/example-outline.html'),
        exampleSectionBox: resolve(__dirname, 'examples/example-sectionbox.html'),
        exampleVisibility: resolve(__dirname, 'examples/example-visibility.html'),
      },
    }
  }
})
