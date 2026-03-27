import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [vue(), cesium()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('vue')) {
            return 'vendor-vue'
          }

          if (
            id.includes('leaflet')
            || id.includes('cesium')
            || id.includes('@capacitor')
          ) {
            return 'vendor-platform'
          }

          if (
            id.includes('bootstrap')
            || id.includes('bootswatch')
            || id.includes('bootstrap-icons')
            || id.includes('aos')
          ) {
            return 'vendor-ui'
          }

          return undefined
        },
      },
    },
  },
})
