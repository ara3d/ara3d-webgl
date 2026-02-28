import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/ara3d-webgl/',
    root: resolve(__dirname, 'examples'),
    build: {
        target: ['es2021'],
        outDir: resolve(__dirname, 'docs'),
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        rollupOptions: {
            input: {
                input: resolve(__dirname, 'examples/index.html'),
                exampleGeometry: resolve(__dirname, 'examples/example-geometry.html'),
                exampleGltf: resolve(__dirname, 'examples/example-gltf-duck.html'),
                exampleBosFilters: resolve(__dirname, 'examples/example-bos-filters.html'),
                exampleBosLevelColors: resolve(__dirname, 'examples/example-bos-level-colors.html'),
                exampleBosSelection: resolve(__dirname, 'examples/example-bos-selection.html'),
                exampleBosSelectionShader: resolve(__dirname, 'examples/example-bos-selection-shader.html'),
                exampleBos: resolve(__dirname, 'examples/example-bos.html'),
            },
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'es2021', // or 'esnext'
            supported: {
                bigint: true, // tell esbuild BigInt is allowed
            },
        },
    },
});
