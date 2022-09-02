import { defineConfig } from 'vite'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, 'test_dist'),
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'native-spa-route',
      formats: ['es'],
      fileName: (format) => `main.${format}.js`
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: [
      ]
    }
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, 'src')
    }
  },
})
