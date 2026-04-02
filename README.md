# Tauri2 Template

一个现代化的 Tauri 2 + React + Vite + Tailwind CSS 应用模板，支持桌面端和移动端。

## 特性

- ⚡ **Tauri 2** - 使用 Rust 构建轻量级桌面应用
- ⚛️ **React 19** - 现代 UI 框架
- 🔥 **Vite** - 极速构建工具
- 🎨 **Tailwind CSS 4** - 原子化 CSS 框架
- 🖥️ **跨平台** - 支持 Windows、macOS、Linux 和移动端
- 📦 **预配置插件** - 对话框、文件系统、通知、全局快捷键等

## 快速开始

### 1. 使用 GitHub Template 创建项目

1. 点击 GitHub 页面上的 **"Use this template"** 按钮
2. 填写你的仓库名称（如 `my-tauri-app`）
3. 选择仓库可见性（公开/私有）
4. 点击 **"Create repository from template"**

### 2. 克隆新项目

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 3. 配置项目（关键步骤）

**需要将以下占位符替换为你的实际项目名称：**

| 文件 | 占位符 | 替换为 |
|------|--------|--------|
| `package.json` | `"name": "tauri2template"` | 你的包名（如 `my-tauri-app`） |
| `src-tauri/Cargo.toml` | `name = "tauri2template"` | 你的 Rust crate 名（如 `my_tauri_app`） |
| `src-tauri/Cargo.toml` | `name = "tauri2template_lib"` | 你的 lib 名（如 `my_tauri_app_lib`） |
| `src-tauri/tauri.conf.json` | `"productName": "tauri2template"` | 应用显示名称（如 `"My Tauri App"`） |
| `src-tauri/tauri.conf.json` | `"identifier": "com.example.tauri2template"` | Bundle ID（如 `"com.company.myapp"`） |
| `src-tauri/tauri.conf.json` | `"title": "tauri2template"` | 窗口标题 |
| `src-tauri/src/main.rs` | `tauri2template_lib::run()` | 你的 lib 名（如 `my_tauri_app_lib::run()`） |
| `index.html` | `<title>Tauri2 Template</title>` | 网页标题 |

**推荐做法：** 使用 IDE 的全局查找替换功能（VS Code: `Ctrl+Shift+H`）搜索 `tauri2template` 并替换为你的项目名。

### 4. 安装依赖

使用 [bun](https://bun.sh/)（推荐）：

```bash
bun install
```

### 5. 运行开发服务器

```bash
# 仅前端开发
bun run dev

# 完整 Tauri 开发（推荐）
bun run dev:pc
```

### 6. 构建应用

```bash
# 构建前端
bun run build

# 构建 Tauri 应用
bun run build:pc
```

构建完成后，可在 `src-tauri/target/release/` 找到可执行文件。

## 项目结构

```
.
├── src/                    # 前端源码
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主应用组件
│   └── index.css          # 全局样式
├── src-tauri/             # Tauri Rust 后端
│   ├── Cargo.toml         # Rust 配置
│   ├── tauri.conf.json    # Tauri 配置
│   └── src/
│       ├── main.rs        # 程序入口
│       └── lib.rs         # 核心逻辑
├── package.json           # Node 依赖
├── vite.config.ts         # Vite 配置
└── tsconfig.json          # TypeScript 配置
```

## 添加 Tauri 插件

Tauri 提供了丰富的官方插件，可按需添加：

```bash
# 添加插件（以 HTTP 为例）
bun add @tauri-apps/plugin-http
```

然后在 `src-tauri/Cargo.toml` 添加：

```toml
[dependencies]
tauri-plugin-http = "2"
```

在 `src-tauri/src/lib.rs` 初始化插件：

```rust
.plugin(tauri_plugin_http::init())
```

## 常见问题

### Q: 如何修改应用图标？

替换 `src-tauri/icons/` 目录下的图标文件，并更新 `tauri.conf.json` 中的 `icon` 路径。

### Q: 如何启用/禁用托盘图标？

在 `src-tauri/src/lib.rs` 的 `setup` 函数中修改或删除托盘相关代码。

### Q: 如何支持移动端？

本模板已配置移动端支持。运行：

```bash
# 确保已安装移动开发依赖
bun install -g @tauri-apps/cli

# Android 开发
bun run tauri android dev
```

### Q: 如何禁用单例模式？

在 `src-tauri/src/lib.rs` 中删除单例插件相关的代码块。

## 许可证

MIT

## 相关链接

- [Tauri 官方文档](https://tauri.app)
- [React 文档](https://react.dev)
- [Vite 文档](https://vitejs.dev)
- [Tailwind CSS 文档](https://tailwindcss.com)
