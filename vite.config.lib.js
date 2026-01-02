import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        target: ['es2021'],
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        sourcemap: true,
        lib: {
            formats: ['es', 'umd'],
            entry: resolve(__dirname, './src/index.ts'),
            name: 'ara3d',
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'es2021',
            supported: {
                bigint: true,
            },
        },
    },
});
