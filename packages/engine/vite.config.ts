import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: '../../builds/default',
    emptyOutDir: true,
  },
})
