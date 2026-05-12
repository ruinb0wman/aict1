# 移除 ESC 键隐藏窗口功能

## Goal
移除 AI Dictionary 桌面应用中按 `ESC` 键隐藏窗口的行为，同时保留 `Ctrl+Shift+I` 打开开发者工具的快捷键。

## Current Context
- 项目：`aict1`（Tauri 2 + React 19 + TypeScript + Vite 桌面应用）
- 相关文件：`src/App.tsx`（第 58~73 行）
- 当前代码在 `AppContent` 组件的 `useEffect` 中注册了全局 `keydown` 监听器：
  - `Escape` → 调用 `hideWindow()`（调用 Tauri API 隐藏当前窗口）
  - `Ctrl+Shift+I` → 调用 `openDevTools()`（保留）

## Proposed Approach
精确删除 `Escape` 键处理分支，保留其余快捷键逻辑及事件监听器的注册/清理结构。

## Step-by-Step Plan
1. **修改 `src/App.tsx`**
   - 定位 `AppContent` 组件内的 `handleKeyDown` 函数
   - 删除以下代码块：
     ```tsx
     if (e.key === 'Escape') {
       hideWindow()
     }
     ```
   - 保留 `Ctrl+Shift+I` 分支及 `addEventListener` / `removeEventListener` 的清理逻辑
   - 更新注释，从 `// Esc 键隐藏窗口，Ctrl+Shift+I 打开 DevTools` 改为 `// Ctrl+Shift+I 打开 DevTools`

2. **验证 `hideWindow` 是否仍被引用**
   - 检查 `src/App.tsx` 中 `hideWindow` 是否还有其他调用点
   - 若已无其他引用，可考虑从 `import` 语句中移除 `hideWindow`，减少未使用导入

3. **验证编译**
   - 运行 `bun run build`（或 `npm run build`）确保 TypeScript 编译通过

## Files Likely to Change
- `src/App.tsx`

## Tests / Validation
- 手动验证：启动应用后按 `ESC` 键，窗口不应再被隐藏
- 手动验证：`Ctrl+Shift+I` 仍能正常打开开发者工具
- 编译验证：`bun run build` 无报错

## Risks & Tradeoffs
- **风险极低**：仅删除一个条件分支，不涉及状态管理或业务逻辑
- **副作用**：用户不能再通过 `ESC` 快速隐藏窗口，需通过标题栏的最小化/关闭按钮操作
