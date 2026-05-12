# 智能剪切板翻译功能实施计划

## 目标

实现"双击 Ctrl+C 触发翻译"功能：用户在任意应用内 1 秒内连续按下两次 Ctrl+C，应用读取剪切板内容，若检测到英文文本，则自动显示窗口并执行翻译。该功能可在设置中开关，并自定义两次按下的最大间隔时间。

## 当前上下文

- **项目类型**：Tauri 2 + React 19 + TypeScript + Vite 桌面词典应用
- **状态管理**：Zustand（settingsStore、appStore 等）
- **本地存储**：IndexedDB（Dexie.js）用于设置和单词数据
- **Rust 后端**：已有窗口显隐、托盘、导入导出、单例模式等功能
- **已有依赖**：`tauri-plugin-global-shortcut = "2"`（已安装但未用于此功能）
- **缺失能力**：全局键盘监听（非拦截式）、剪切板读取

## 方案概述

采用 **Rust 后台线程全局键盘监听 + 官方剪切板插件** 的架构：

1. **Rust 侧**：使用 `rdev` crate 以非拦截模式监听全局键盘事件，检测 Ctrl+C 双击行为；使用 `tauri-plugin-clipboard-manager` 读取剪切板；通过 Tauri Emitter 向前端发送事件。
2. **前端侧**：监听 Rust 事件，自动显示窗口、跳转搜索页、填入剪切板文本并触发查询；在设置页面提供开关和间隔时间滑块。

> 选用 `rdev::listen`（非拦截）而非 `rdev::grab`，确保系统复制操作不受影响。

---

## Step-by-Step 实施计划

### Phase 1: Rust 后端基础设施

#### 1.1 添加 Rust 依赖

**文件**：`src-tauri/Cargo.toml`

- 添加 `rdev = "0.5"`（全局键盘监听）
- 添加 `tauri-plugin-clipboard-manager = "2"`（剪切板读取）
- 确认 `tokio` 已有 `time` feature（已具备）

#### 1.2 注册 Clipboard Manager 插件

**文件**：`src-tauri/src/lib.rs`

- 在 `builder` 链上添加 `.plugin(tauri_plugin_clipboard_manager::init())`
- 添加 `tauri-plugin-clipboard-manager` 的 capability 权限到 `default.json`

#### 1.3 定义状态结构

**文件**：`src-tauri/src/lib.rs`

新建 `ClipboardMonitorState`：

```rust
struct ClipboardMonitorState {
    enabled: bool,           // 功能开关
    interval_ms: u64,        // 两次 Ctrl+C 最大间隔（毫秒）
    last_copy_time: Option<Instant>,
    ctrl_pressed: bool,
}
```

使用 `Arc<Mutex<ClipboardMonitorState>>` 作为 Tauri State，供命令和监听线程共享。

#### 1.4 实现全局键盘监听线程

**文件**：`src-tauri/src/lib.rs`

在 `setup` 中：

1. 初始化 `ClipboardMonitorState`（默认关闭，interval 1000ms）
2. `app.manage(state.clone())`
3. 启动 `std::thread::spawn` 运行 `rdev::listen`：
   - 监听 `ControlLeft/ControlRight` 的 Press/Release 来追踪 Ctrl 状态
   - 监听 `KeyC` Press + `ctrl_pressed == true`：
     - 若 `enabled == false`，忽略
     - 若与上次按下间隔 ≤ `interval_ms`，触发翻译流程
     - 否则更新 `last_copy_time`
4. 触发翻译流程：
   - 延迟 150ms（等待系统复制完成）
   - 使用 `app_handle.clipboard().read_text()` 读取剪切板
   - 判断是否为英文文本（见 1.5）
   - 若是：获取 `main` 窗口 → `show()` + `set_focus()` + `emit("clipboard-translate", { text })`

#### 1.5 英文检测逻辑

实现辅助函数 `is_english_text(text: &str) -> bool`：

- 去除首尾空白后非空
- 非空字符中，ASCII 字母占比 ≥ 60%
- 允许常见英文标点（.,!?;:'"()-[]{} 和空格）
- 排除纯数字或纯符号的情况

#### 1.6 新增 Tauri Commands

**文件**：`src-tauri/src/lib.rs`

新增以下 command 并注册到 `invoke_handler`：

| Command | 参数 | 功能 |
|---------|------|------|
| `update_clipboard_monitor` | `{ enabled: bool, intervalMs: u64 }` | 更新监听配置，实时生效 |
| `get_clipboard_monitor_state` | 无 | 返回当前配置 `{ enabled, intervalMs }` |

---

### Phase 2: Tauri 权限配置

#### 2.1 更新 Capability

**文件**：`src-tauri/capabilities/default.json`

添加权限：
- `clipboard-manager:allow-read`
- 已有的 `core:window:allow-show`、`core:window:allow-set-focus` 已满足

---

### Phase 3: 前端类型与状态层

#### 3.1 扩展 Settings 类型

**文件**：`src/types/index.ts`

```typescript
export type Settings = {
  // ... 现有字段 ...
  clipboardTranslationEnabled: boolean;
  clipboardTranslationInterval: number; // 毫秒，默认 1000
};

export const defaultSettings: Settings = {
  // ... 现有字段 ...
  clipboardTranslationEnabled: false,
  clipboardTranslationInterval: 1000,
};
```

#### 3.2 更新 Settings Store

**文件**：`src/stores/settingsStore.ts`

- `loadSettings`：从 IndexedDB 读取新字段，缺失时使用默认值
- `saveSettings`：合并并保存新字段
- 新增 `initClipboardMonitor()`：应用启动时读取设置并调用 Rust command 同步配置
- 新增 `updateClipboardMonitor(enabled, intervalMs)`：保存设置并实时同步到 Rust

---

### Phase 4: 前端设置界面

#### 4.1 Settings 页面新增控件

**文件**：`src/pages/Settings.tsx`

在 API 设置区域下方新增"剪切板翻译"区块：

1. **开关**：启用剪切板翻译（`clipboardTranslationEnabled`）
   - 使用 checkbox/toggle 组件
   - 变更时立即调用 `updateClipboardMonitor`
2. **滑块**：触发间隔时间（`clipboardTranslationInterval`）
   - 范围：200ms ~ 3000ms，步进 100ms
   - 标签显示当前值（如"1.0 秒"）
   - 仅当开关开启时可用（disabled 状态）

#### 4.2 表单状态同步

- 扩展 `formData` state
- 扩展 `handleChange` 逻辑
- 扩展 `useEffect` 同步依赖数组

---

### Phase 5: 前端事件监听与翻译触发

#### 5.1 新增 Tauri 工具函数

**文件**：`src/utils/tauri.ts`

```typescript
export async function updateClipboardMonitor(
  enabled: boolean,
  intervalMs: number
): Promise<void> {
  await invoke('update_clipboard_monitor', { enabled, intervalMs });
}

export async function getClipboardMonitorState(): Promise<{ enabled: boolean; intervalMs: number }> {
  return await invoke('get_clipboard_monitor_state');
}
```

#### 5.2 App.tsx 事件监听

**文件**：`src/App.tsx`

新增 `useEffect`：

1. 使用 `listen('clipboard-translate', handler)` 监听 Rust 事件（需从 `@tauri-apps/api/event` 导入）
2. Handler 逻辑：
   - 调用 `showWindow()` 显示并聚焦窗口（已存在此 Rust command）
   - 使用 `useAppStore.getState().setCurrentPage('search')` 切换到搜索页
   - 将剪切板文本设置到搜索框（需要搜索框支持外部设置值，或通过 global state）
   - 触发查询

> **注意**：需要确认 `SearchBox` 是否支持从外部触发搜索。若不支持，需在 `appStore` 中新增 `pendingClipboardText` 字段，SearchBox 组件读取并自动查询后清空。

#### 5.3 搜索框支持外部触发

**文件**：`src/components/SearchBox.tsx`（或相关搜索逻辑）

- 添加 `useEffect` 监听 `pendingClipboardText` 变化
- 若有值：设置输入框内容 → 触发 `handleSearch` → 清空 `pendingClipboardText`

---

### Phase 6: IndexedDB 迁移

#### 6.1 更新数据库 Schema

**文件**：`src/utils/indexedDB.ts`

- 确认 Dexie.js 表结构是否需要升级版本号
- `settings` 表存储为动态对象，通常无需修改 schema，但建议提升 db version 并添加迁移逻辑以处理旧数据

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src-tauri/Cargo.toml` | 修改 | 添加 `rdev` 和 `tauri-plugin-clipboard-manager` 依赖 |
| `src-tauri/src/lib.rs` | 大幅修改 | 添加状态结构、监听线程、commands、英文检测 |
| `src-tauri/capabilities/default.json` | 修改 | 添加剪切板读取权限 |
| `src/types/index.ts` | 修改 | Settings 类型扩展两个新字段 |
| `src/stores/settingsStore.ts` | 修改 | 加载/保存/同步新字段和 Rust 配置 |
| `src/stores/appStore.ts` | 可能修改 | 添加 `pendingClipboardText` 和 `setCurrentPage`（如尚未存在） |
| `src/pages/Settings.tsx` | 修改 | 新增剪切板翻译开关和间隔时间控件 |
| `src/utils/tauri.ts` | 修改 | 新增 Rust commands 的封装函数 |
| `src/App.tsx` | 修改 | 添加 clipboard-translate 事件监听 |
| `src/components/SearchBox.tsx` | 可能修改 | 支持外部文本触发查询 |
| `src/utils/indexedDB.ts` | 可能修改 | Dexie 版本升级（如需） |

---

## 测试与验证

1. **构建测试**：`bun run build:pc` 确认 Rust 编译通过
2. **功能测试**：
   - 在设置中开启功能，默认间隔 1 秒
   - 在记事本中选中英文文本，快速双击 Ctrl+C
   - 验证窗口弹出、搜索框自动填入文本、翻译结果展示
   - 测试非英文文本（如中文）不触发
   - 测试间隔外双击不触发
3. **边界测试**：
   - 关闭功能后双击不再触发
   - 修改间隔时间后实时生效
   - 应用重启后设置持久化

---

## 风险与注意事项

1. **Linux Wayland 兼容性**：`rdev` crate 在 Wayland 环境下不支持全局监听。若目标用户大量使用 Wayland，后续需评估迁移到 `evdev` 或提示功能受限。当前主要面向 Windows 和 macOS/X11 桌面用户。
2. **权限问题**：Linux X11 下 `rdev` 需要 DISPLAY 环境变量和 X11 权限。Tauri 桌面应用通常在用户会话中运行，一般具备此权限。
3. **剪切板读取时机**：系统复制操作在 Ctrl+C 释放后异步完成，Rust 侧延迟 150ms 读取是经验值，在绝大多数系统上足够。若遇极端情况可调整为 200-300ms。
4. **多实例冲突**：项目已启用 `tauri-plugin-single-instance`，仅有一个实例监听键盘，无冲突。
5. **性能影响**：`rdev::listen` 在独立线程运行，对主线程和 UI 性能无影响。
