import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import removeConsole from 'vite-plugin-remove-console'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const plugins = [vue(), vueDevTools()]

  // Додавати плагін видалення console.log тільки для build команди
  if (command === 'build') {
    plugins.push(
      removeConsole({
        external: ['error', 'warn'], // залишити console.error та console.warn
      })
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
