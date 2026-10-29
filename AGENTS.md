# AGENTS.md - AI Dictionary App

## Project Overview

**Type:** Tauri 2 + Vue 3 + TypeScript + Vite desktop/mobile application
**Package Manager:** Bun
**UI library:** [`@ruinb0w/ui`](../ui)（`file:../ui`，本地软链，改库即生效）
**Description:** AI-powered dictionary tool with word lookup, favorites, history, and review features

## Build & Development Commands

```bash
# Development
bun run dev          # Frontend dev server only (Vite, port 1420)
bun run dev:pc       # Full Tauri dev mode (desktop)
bun run dev:android  # Android development
bun run dev:ios      # iOS development

# Building
bun run build        # vue-tsc --noEmit && vite build
bun run build:pc     # Build Tauri desktop app
bun run build:android # Build Android app
bun run build:ios    # Build iOS app

# Preview / CLI
bun run preview      # Preview production build
bun run tauri        # Access Tauri CLI directly
```

## Testing Commands

```bash
bunx vitest run                    # 全部测试
bunx vitest run src/libs/history.test.ts   # 单个文件
bunx vitest                        # watch 模式
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
- 密度：桌面 `default`（36px 控件），移动端 `touch`（44px），见 `src/main.ts`
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
| 工具 / 纯逻辑 | camelCase | `api.ts`, `indexedDB.ts`, `libs/history.ts` |
| composable | camelCase，`use` 前缀 | `useNetworkToast.ts` |
| Pinia store | camelCase，`use*Store` | `useWordsStore.ts` |
| 类型 / 接口 | PascalCase | `QueryResult`, `FavoriteWord` |
| 函数 | camelCase | `getWordFromCache`, `insertHistory` |
| 常量 | UPPER_SNAKE_CASE | `API_TIMEOUT`, `MASTERY_MAX` |
| CSS 类 | kebab-case | `.search-box`, `.word-header` |

### Imports Order

1. Vue / vue-router / pinia
2. 第三方库（`@ruinb0w/ui`, `@lucide/vue`, `dexie`…）
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

### 写库必须过 `toPlain()`

Vue 的 `ref` / `reactive` 产出的是 **Proxy**，Dexie 写库走 structured-clone，遇到 Proxy 直接抛
`DataCloneError`。**类型检查和单测都抓不到，只有真跑一次写库才暴露。**

```ts
import { toPlain } from '@/libs/plain'
await indexedDBService.addFavorite(toPlain(newFavorite))
```

凡是「表单/响应式状态直接写库」都要过一道：`addFavorite` / `saveHistory` / `updateWord*` 已处理。

### 错误与提示

- 异步一律 try/catch；`console.error` 打原始错误，用户可见的提示走 `useAppStore().showToast()`
- **不要用 `window.alert` / `window.confirm`**：Android WebView 没实现 `onJsConfirm`（按钮是死的），
  Electron 里会阻塞渲染进程。用库的 `useConfirm()` / `useAlert()`（`RConfirmHost` 已挂在 `App.vue`）

### 路由

`vue-router` + `createWebHashHistory`（Tauri WebView 没有服务端路由，hash 免刷新 404）。
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
src/
├─ components/     # 通用组件（TitleBar / BottomNav / Toast / SearchBox / QueryResult…）
├─ composables/    # 组合式函数
├─ libs/           # 框架无关的纯逻辑（含测试）
├─ pages/          # 路由页面
├─ router/         # 路由表
├─ stores/         # Pinia stores
├─ types/          # 类型
├─ utils/          # api / tauri / indexedDB（框架无关，含测试）
├─ App.vue         # 根组件（外壳 + 全局宿主）
├─ main.ts         # 入口（pinia / router / 主题 / 图标登记）
└─ index.css       # 全局样式

src-tauri/         # Rust 后端（Tauri）
```

## Key Dependencies

- **@tauri-apps/api** - Tauri JavaScript API
- **@ruinb0w/ui** - 跨项目 Vue 组件库（本地软链）
- **@lucide/vue** - 图标（库的 peerDependency）
- **pinia** - 状态管理
- **vue-router** - 路由（hash 模式）
- **dexie** - IndexedDB 封装
- **uuid** - UUID 生成

## Development Notes

- 窗口尺寸：400x600（无边框），桌面构建；Android/iOS 构建共用同一前端
- 本地数据：IndexedDB（Dexie，库名 `DictDB`，`DB_VERSION = 4`）；无 localStorage 依赖
- 系统托盘、剪贴板监听（双击 Ctrl+C 触发翻译）由 Rust 侧驱动，前端只收 `clipboard-translate` 事件
- 支持中英互译；英译中单词会本地缓存，中译英结果和句子不缓存

## Code Sync Rule

- **Always modify code in WSL only** (`~/Workspace/aict1`)
- **Never modify Windows files** under `/mnt/c/Workspace/aict1/`
- The user syncs code from WSL to Windows using `wsync`
- If you need to check something on Windows, read only — do not write
