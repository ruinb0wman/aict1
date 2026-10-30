import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

const port = 8470;          // dev 时你打开的那个地址（prod 由 bun server 独占）
const apiPort = 8471;       // bun server 在 dev 时的端口（/api 由 vite 代理过去）
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

  clearScreen: false,
  server: {
    // 只有 tailscale 域名会被外网设备（手机上打 http://<lan-ip>:8470 或 https://…:8670）用到
    allowedHosts: ['albedo.tail36b860.ts.net'],
    port,
    strictPort: true,
    host: '0.0.0.0',
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    hmr: { protocol: "ws", host: 'localhost', port: hmrPort },
  },
}));
