import { defineConfig } from 'vite'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, 'test_dist'),
    minify: false,
    lib: {
      entry: path.resolve(__dirname, 'src', 'main.ts'),
      name: 'native-spa-route',
      formats: ['es'],
      fileName: (format) => `main.${format}.js`
    },
    rollupOptions: {
      treeshake: true,
      external: []
    }
  },
})
