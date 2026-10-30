# AGENTS.md - AI Dictionary App

## Project Overview

**Type:** Vue 3 + TypeScript + Vite 前端 ＋ Bun 服务端（SQLite）；**没有 App 壳**，纯 C/S
**Package Manager:** Bun
**UI library:** [`@ruinb0w/ui`](../ui)（`file:../ui`，本地软链，改库即生效）
**Description:** AI-powered dictionary tool with word lookup, favorites, history, and review features

## 架构：一个服务，三个入口，全部同源

```
bow 标签页 / 手机浏览器 / bow_mobile 的包装 APK
            │  同一个 URL
            ▼
   bun server ──> data/dict.db
        ├ /api/*          数据、设置、LLM 代理
        └ /* → dist/      静态页面（SPA）
```

- **没有 Tauri、没有 APK 构建、没有 `VITE_API_BASE`**。手机上用就是 `bow_mobile` 里一个只做 WebView 的壳
  APK，指向本服务的地址；改代码只需重启 server，壳不用重打。
- **端口**：`8470` = prod 的 bun server 独占（`bun run serve`，同时给 dist 和 `/api`），
  dev 时改由 vite 占 8470、bun server 退到 `8471`（vite `proxy /api` 过去），`8472` = HMR（**不能等于 8471**）。
- **外网**：tailscale 把 `8470 → 8670` 转发给外网设备（`https://albedo.tail36b860.ts.net:8670` 即本机 8470），
  所以 prod 必须起在 8470，URL 才不会变。
- **同源是唯一形态**：请求一律相对路径（`fetch('/api/…')`），没有服务器地址配置、没有跨源、服务端不需要 CORS 头。
- **数据只在服务端**：`data/dict.db`（gitignore）。客户端零本地状态（连 `localStorage` 都不用了）。
- **LLM 调用在服务端**（`server/llm.ts`）：prompt、API Key、上游请求都不在客户端。

## Build & Development Commands

```bash
# 开发：一条命令起两个进程（vite 8470 + bun server 8471）
bun run dev
bun run serve        # prod：server 独占 8470，dist + /api 同源（先 bun run build）

# 构建
bun run build        # vue-tsc --noEmit && vite build
```

`dev` 与 `serve` **不能同时跑**（都占 8470）。Ctrl-C 没收干净后报 `EADDRINUSE`（8470 是 vite 或 serve、8471 是 dev 的 server、8472 是 HMR），
用 `ss -ltnp | grep -E ':847[0-2]'` 找到 pid 再 `kill`；两个子进程要分别收尸，杀父进程不会带走子进程。

## Testing Commands

```bash
bunx vitest run                    # 全部测试
bunx vitest run src/libs/history.test.ts   # 单个文件
bun test server                    # 服务端用例（bun:test，DB 语义回归）
bun run test                       # vitest + bun test 一起跑
bunx vue-tsc --noEmit              # 类型检查（.vue 也需要跑它）
```

**`vue-tsc` 通过 ≠ `vite build` 通过**：SFC 编译期限制（如 `withDefaults` 默认值里引用局部变量）
vue-tsc 不报，只有 SFC 编译器报。两个都要跑。

## UI 库：`@ruinb0w/ui`

**不要手写库里已有的组件**：先查 `~/Workspace/ui/AI.md`（组件速查）和 `DESIGN.md`（视觉判据）。

```ts
import { RButton, RInput, REmptyState } from '@ruinb0w/ui'
import '@ruinb0w/ui/style.css'   // 入口引入一次（src/main.ts）
```

- 主题：`document.documentElement.dataset.theme = 'exp1-dark'`（深色单主题，色值与本项目一致）
- 密度：桌面浏览器 `default`（36px 控件），移动端 `touch`（44px），见 `src/main.ts`（按窗口宽度判断，不认宿主）
- 图标：`@lucide/vue`（**不是** lucide-react / lucide-vue-next）。按名字传给组件的图标要先
  `registerIcons({ ... })` 登记（`src/main.ts` 里），否则只显示名字
- **不引入 Tailwind**（本项目的 Tailwind 已删除，它从未真正生效过）；样式只读 token：
  `--bg-* --text-* --border-* --color-*`、`--space-05..--space-7`、`--radius-sm|md|lg|full`、
  `--font-*`、`--control-h`、`--motion-*`、`--z-*`
- 禁止在项目里覆盖库组件的 scoped 样式；要改行为就回库改

## Code Style Guidelines

### TypeScript Configuration
- **Target:** ES2020
- **Strict mode:** Enabled (noUnusedLocals, noUnusedParameters)
- **Path alias:** `@/*` maps to `src/*`
- 类型检查走 `vue-tsc`（没有 `jsx` 配置了）

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| 组件（SFC） | PascalCase | `SearchBox.vue`, `QueryResult.vue` |
| 页面 | PascalCase | `pages/Settings.vue` |
| 工具 / 纯逻辑 | camelCase | `store.ts`, `api.ts`, `libs/history.ts` |
| composable | camelCase，`use` 前缀 | `useNetworkToast.ts` |
| Pinia store | camelCase，`use*Store` | `useWordsStore.ts` |
| 类型 / 接口 | PascalCase | `QueryResult`, `FavoriteWord` |
| 函数 | camelCase | `getWordFromCache`, `insertHistory` |
| 常量 | UPPER_SNAKE_CASE | `API_TIMEOUT`, `MASTERY_MAX` |
| CSS 类 | kebab-case | `.search-box`, `.word-header` |

### Imports Order

1. Vue / vue-router / pinia
2. 第三方库（`@ruinb0w/ui`, `@lucide/vue`…）
3. 内部组件（`@/components/*`）
4. composables（`@/composables/*`）
5. stores（`@/stores/*`）
6. 纯逻辑 / 工具（`@/libs/*`, `@/utils/*`）
7. 类型（`@/types`）
8. CSS

```typescript
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RButton, REmptyState } from '@ruinb0w/ui'
import { Star } from '@lucide/vue'
import SearchBox from '@/components/SearchBox.vue'
import { useNetworkToast } from '@/composables/useNetworkToast'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { pickReviewWords } from '@/libs/review'
import type { FavoriteWord } from '@/types'
```

### SFC Structure

```vue
<script setup lang="ts">
// 1. 导入
// 2. props / emits
// 3. 状态（ref / computed）
// 4. 函数
// 5. 生命周期
</script>

<template>
  <!-- 结构；类名沿用 kebab-case -->
</template>

<!-- 只在必要时写 scoped 样式；能读 token 就不要写新样式 -->
```

- 一把 `<script setup lang="ts">`，不用 Options API
- `defineProps<{...}>()` / `defineEmits<{...}>()` 用类型声明式
- 模板里不写 TS 断言，派生值放 `computed`

### State Management (Pinia)

- 一个域一个 store（words / favorites / history / settings / app）
- **setup 写法**（组合式），state 是 `ref`，动作是普通函数
- 组件里**直接用 store 对象**（`const app = useAppStore()` → 模板 `app.queryResult`），
  不要解构 state（会丢响应性）；非要解构就 `storeToRefs`
- 跨 store 调用：在动作里现调 `useXxxStore()`（不要在模块顶层调用，避免循环依赖在 setup 前触发）

```ts
export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<FavoriteWord[]>([])
  const isLoading = ref(false)

  async function loadFavorites() { /* ... */ }

  return { favorites, isLoading, loadFavorites }
})
```

### `toPlain()`：HTTP 之后已非必须

现在写库是 `JSON.stringify` + HTTP，Vue 的 Proxy 能正常序列化，所以 `toPlain()` 不是硬要求，留着是习惯。
**但如果哪天又出现直接进 structured-clone 的路径，Proxy 会抛 `DataCloneError`，类型检查和单测都抓不到。**

### 错误与提示

- 异步一律 try/catch；`console.error` 打原始错误，用户可见的提示走 `useAppStore().showToast()`
- **不要用 `window.alert` / `window.confirm`**：Android WebView 没实现 `onJsConfirm`（按钮是死的），
  Electron 里会阻塞渲染进程。用库的 `useConfirm()` / `useAlert()`（`RConfirmHost` 已挂在 `App.vue`）

### 路由

`vue-router` + `createWebHashHistory`（没有服务端历史路由，hash 模式随便刷新都不会 404）。
页面切换动画用 `<Transition name="page" mode="out-in">`（类名定义在 `src/index.css`）。

### Types

- 类型集中在 `src/types/index.ts`
- 导出函数写显式返回类型；对象形状优先 `type`

### CSS

- 全部样式在 `src/index.css`（单文件，按页面分节），不引入 CSS-in-JS
- 只用库的 token（见上），**不写十六进制色值、不写裸 px 间距**
- 深色主题是唯一主题

## Project Structure

```
server/           # Bun 服务端（bun:sqlite + Bun.serve，无框架依赖）
├─ index.ts       # 路由 + 静态资源 + 端口
├─ db.ts          # SQLite 表与语义（照搬旧 indexedDB 实现）
├─ llm.ts         # prompt 与上游 LLM 调用（key 只在这里）
└─ index.test.ts  # bun:test

src/
├─ components/     # 通用组件（TitleBar / BottomNav / Toast / SearchBox / QueryResult…）
├─ composables/    # 组合式函数
├─ libs/           # 框架无关的纯逻辑（含测试）：history / review / text / plain
├─ pages/          # 路由页面
├─ router/         # 路由表
├─ stores/         # Pinia stores
├─ types/          # 类型
├─ utils/          # store.ts(HTTP 数据层，一律同步相对路径) api.ts(LLM 入口)
├─ App.vue         # 根组件（外壳 + 全局宿主）
├─ main.ts         # 入口（pinia / router / 主题 / 图标登记）
└─ index.css       # 全局样式

data/dict.db       # SQLite（gitignore，备份就是复制它）
```

## Key Dependencies

- **@ruinb0w/ui** - 跨项目 Vue 组件库（本地软链）
- **@lucide/vue** - 图标（库的 peerDependency）
- **pinia** - 状态管理
- **vue-router** - 路由（hash 模式）
- **uuid** - UUID 生成

## Development Notes

- 数据：**服务端** `data/dict.db`（SQLite，`words / favorites / history / settings` 四表，JSON 型字段存 doc 列）。客户端**零本地持久化**（连 `localStorage` 都不用）
- 支持中英互译；英译中单词进服务端缓存，中译英结果和句子不缓存
- 启动时用 `settings.loadSettings()` 当探活：失败只弹一次 toast 并跳过 favorites/history 的加载，**没有**整页接管的离线页（服务停了页面本身就打不开）
- 发音走 Web Speech API：Android WebView 不实现 `speechSynthesis`，手机上点了没反应，待换服务端 TTS 或置灰（见 `src/libs/speech.ts` 顶部 TODO）

## 运行环境（只有 WSL）

- **只在 WSL 里改代码、跑 dev、构建**（`~/Workspace/aict1`）。
- **Windows 侧（`C:\Workspace\aict1`）已废弃**：不再用 wsync 同步，也不在那边验证。不要重建 `.wsync.config.js` / `.sync.config.json`。
- 使用面：**bow 里的网页标签**、**手机浏览器**、**bow_mobile 打的壳 APK**（三者同一个 URL）。
- 本项目不再需要 Rust / NDK / JDK —— Android 出包在 `bow_mobile` 里做，那边才有工具链。
