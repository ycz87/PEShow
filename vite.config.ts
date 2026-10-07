import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' 让构建产物可以直接放进任意子路径、Tauri 或本地离线打开
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 5173, strictPort: true },
})
