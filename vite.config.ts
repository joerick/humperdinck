import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: [
      ...(command === 'serve' && mode === 'fixture' ? [{
        find: '@/model/Auth',
        replacement: fileURLToPath(new URL('./src/dev/fixture-auth.ts', import.meta.url)),
      }] : []),
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
}))
