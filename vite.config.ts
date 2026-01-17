import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['electron']
                        }
                    }
                }
            },
            {
                entry: 'electron/preload.ts',
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        lib: {
                            entry: 'electron/preload.ts',
                            formats: ['cjs'],
                            fileName: () => 'preload.cjs',
                        },
                        minify: false,
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['electron'],
                            output: {
                                format: 'cjs',
                                entryFileNames: 'preload.cjs',
                                inlineDynamicImports: true,
                                manualChunks: undefined,
                                exports: 'none',
                            },
                        },
                    }
                }
            }
        ]),
        renderer()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        port: 14592
    }
})
