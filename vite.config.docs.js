import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'examples'),
  build: {
    outDir: resolve(__dirname, 'docs'),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    /*
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ara3d-webgl',    // Global name in UMD build if needed
      fileName: (format) => `ara3d-webgl.${format}.js`,
      formats: ['es']           // ES module output (could add 'umd' or others)
    }
    */
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
