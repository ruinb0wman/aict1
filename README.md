# dict - AI 词典工具

一个 AI 驱动的词典工具：输入单词或句子，由配置好的大模型按固定格式返回内容并渲染。

架构是**纯 C/S**：一个 bun 服务同时给页面和 API，数据与 API Key 都在服务端。bow 标签页、手机浏览器、
bow_mobile 里那个只做 WebView 的壳 APK 打开的是**同一个 URL、同一份代码**，天然同源。

```
bow 标签页 / 手机浏览器 / bow_mobile 壳 ──HTTP──> bun server (8470) ──> data/dict.db
                                                        ├ /api/*      数据、设置、LLM 代理
                                                        ├ /*          dist/ 静态页面
                                                        └ /api/query  → 上游大模型（key 只在服务端）
```

## 功能特性

- 🔍 **单词查询** - 音标、词性、翻译、近义词/反义词、单词原型
- 🔊 **单词发音** - Web Speech API（**注意**：Android WebView 不支持 `speechSynthesis`，手机壳里点了没反应，待换成服务端 TTS 或置灰）
- 📝 **语句翻译** - 自动识别单词 / 句子，支持中英互译
- ⭐ **收藏单词** - 搜索、复习评分、导出导入（JSON）
- 📚 **复习单词** - 卡片式翻转复习，「认识/不认识」调整掌握度
- 📝 **查询历史** - 自动保存，支持查看、单条删除、清空
- ✏️ **单词编辑** - 自定义翻译、例句、近反义词，添加个人批注
- 🧐 **语法检查** - 给出修正文本、逐条修改原因与整体评价
- 💾 **服务端缓存** - 查过的单词进 SQLite，重复查询免 API 调用，三端共享

## Preview

|查询|语法|收藏|学习|历史|设置|
|-|-|-|-|-|-|
|![](./README/Trans.png)|![](./README/Grammar.png)|![](./README/Fav.png)|![](./README/Review.png)|![](./README/History.png)|![](./README/Setting.png)|

## 技术栈

**客户端**

- Vue 3 + Vite + TypeScript（有效载荷是一个静态 SPA，没有 App 壳）
- 状态管理 Pinia、路由 vue-router（hash 模式）
- UI 组件库 [`@ruinb0w/ui`](../ui)（token 化的深色单主题，不引 Tailwind）
- 图标 `@lucide/vue`

**服务端**

- Bun 原生（`Bun.serve` + `bun:sqlite`），零框架依赖
- 数据库：SQLite 单文件 `data/dict.db`
- 不引入 ORM：JSON 型字段存 `doc` 列，用 `json_extract` 查询

## 快速开始

前置：只需要 **bun**（[安装](https://bun.sh/docs/installation)）。

```bash
bun install
bun run dev        # 一条命令起两个进程：vite(8470) + bun server(8471)
```

浏览器打开 **http://127.0.0.1:8470** 即可使用；进「设置」填大模型 API 地址 / Key / 模型后开始查询。

- **prod**（`bun run serve`）时 server 独占 **8470**，页面和 `/api` 同源；dev 时 vite 占 8470、server 退到 8471 由 vite 代理。
- 数据在 `data/dict.db`（已 gitignore）——备份就是复制这个文件。
- 从旧版（独立 APK + 客户端 IndexedDB）升上来时，旧数据只在那台机器的旧 APK 里：先在旧 APK 里走一次「迁移」再卸载，迁移入口已从本仓库移除。

## 命令

```bash
bun run dev          # vite 8470 + server 8471（HMR 走 8472）
bun run serve        # prod：server 独占 8470，dist + /api 同源（先 bun run build）

bun run build        # vue-tsc --noEmit && vite build

bun run test         # vitest（前端）+ bun test server（服务端）
bun run typecheck    # vue-tsc --noEmit
```

`dev` 与 `serve` 不能同时跑（都占 8470）。

## 手机上用

手机上什么都不用配——打开 `https://albedo.tail36b860.ts.net:8670` 就是本机 `8470`：

```bash
# 已配好的一次性设置：tailscale 把 8470 转发到 8670 给外网设备用
tailscale serve --bg --https=8670 http://127.0.0.1:8470
```

所以 prod 必须起在 8470（`bun run serve` 默认就是）。桌面图标用 `bow_mobile` 打出来的壳 APK
（`bow.apps.json` 里指向这个 URL），壳里没有任何业务代码，服务端改了什么它刷新即得。

## 视觉风格

样式全部读 `@ruinb0w/ui` 的 token（`--bg-*` `--text-*` `--border-*` `--color-*` `--space-*` `--radius-*`），主题是唯一的深色 `exp1-dark`，项目里**不写十六进制色值、不引 Tailwind**。图标统一 Lucide 线性 1.5px。

## 开发环境补充

开发和构建**只在 WSL 里做**（Windows 侧的检出已废弃）。本项目不再需要 Rust / NDK / JDK：
APK 由 [`bow_mobile`](../bow_mobile) 统一出包（那里才有 Android 工具链）。

## Licence

本项目采用双重许可模式：

### 开源许可

本项目源代码在 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 下发布。

**核心要求：**

- ✅ 允许个人学习、研究使用
- ✅ 允许修改，但**修改后的项目必须开源**（相同许可证）
- ✅ 允许分发，但必须提供源代码
- ❌ **禁止闭源商用**（需获得商业许可）

### 商业许可

如需闭源使用或商业用途，请联系获得商业许可：

📧 **邮箱**: <ruinb0wman@gmail.com>

商业许可提供：

- 闭源使用权利
- 技术支持服务
- 专利授权保护
- 定制开发选项

---

## ⚠️ 重要声明

未获得书面商业许可前，任何商业使用、闭源集成均视为侵权。
