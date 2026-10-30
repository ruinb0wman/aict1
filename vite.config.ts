import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const port = 8470;          // 你打开的那个地址（dev 由 vite 提供）
const apiPort = 8471;       // bun server：dev 与 prod 都是这个端口
const hmrPort = 8472;       // 不能等于 apiPort

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // vitest 只跑 src 下的用例；server 的用例走 bun test（bun:test）
  test: { include: ["src/**/*.test.ts"] },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    hmr: {
      protocol: "ws",
      host: host || 'localhost',
      port: hmrPort,
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
