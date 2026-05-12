# 计划：添加开机自启与静默启动功能

## 目标
为 AI Dictionary 桌面应用添加：
1. **开机自启** — 系统启动时自动运行应用（通过 `tauri-plugin-autostart`）
2. **静默启动** — 通过开机自启启动时，不显示主窗口，仅在系统托盘运行
3. **设置页面开关** — 在 Settings 页面提供两个开关控制上述功能

## 当前上下文

- **项目类型**：Tauri 2 + React 19 + TypeScript + Vite，桌面端（Windows）
- **已有托盘**：系统托盘已实现（代码创建 `TrayIconBuilder`），关闭窗口即隐藏到托盘
- **已有设置体系**：`Settings` 类型存储于 IndexedDB，通过 `settingsStore` (Zustand) 管理
- **已有 Tauri 命令体系**：`src/utils/tauri.ts` 封装所有 invoke 调用

## 方案概述

### Rust 后端
- 添加 `tauri-plugin-autostart` 依赖
- 在 `.setup()` 中初始化 autostart 插件，传入 `--autostart` 参数
- 启动时检测 `args` 中是否包含 `--autostart`
- 若同时满足 `--autostart` + 静默启动开启（通过读取设置文件判断），则 `window.hide()`
- 暴露 `get_autostart` / `set_autostart` Tauri 命令

### 前端
- `Settings` 类型新增 `autoStart: boolean`、`silentStart: boolean`
- `settingsStore` 新增加载/保存逻辑，以及 `setAutoStart(enabled)` action
- `src/utils/tauri.ts` 新增 `getAutoStart()` / `setAutoStart(enabled)` 封装
- `Settings.tsx` 新增"系统设置"区块，包含两个 toggle 开关

## 详细步骤

### Step 1 — 添加 Rust 依赖
**文件**：`src-tauri/Cargo.toml`
- 在 `[dependencies]` 下添加 `tauri-plugin-autostart = "2"`

### Step 2 — 添加权限
**文件**：`src-tauri/capabilities/default.json`
- 在 `permissions` 数组中添加 `"autostart:default"` 或 `autostart:allow-enable`/相关权限
- 需要确认 tauri-plugin-autostart 的确切 capability 标识符

### Step 3 — 修改 Rust 主逻辑
**文件**：`src-tauri/src/lib.rs`

1. **导入 autostart**：
   ```rust
   use tauri_plugin_autostart::{ManagerExt, MacosLauncher};
   ```

2. **初始化插件**（在 builder chain 中）：
   ```rust
   .plugin(tauri_plugin_autostart::init(
       MacosLauncher::LaunchAgent,
       Some(vec!["--autostart"]),
   ))
   ```

3. **添加 Tauri 命令**：
   ```rust
   #[tauri::command]
   async fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
       app.autolaunch().is_enabled().map_err(|e| e.to_string())
   }

   #[tauri::command]
   fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
       if enabled {
           app.autolaunch().enable().map_err(|e| e.to_string())?;
       } else {
           app.autolaunch().disable().map_err(|e| e.to_string())?;
       }
       Ok(())
   }
   ```
   ⚠️ 注意：`autolaunch()` 不是 `autostart()`，来自 `ManagerExt` trait。

4. **静默启动逻辑**（在 `.setup()` 中，托盘创建之后）：
   ```rust
   .setup(move |app| {
       // ... tray setup ...

       // 静默启动检测
       let args: Vec<String> = std::env::args().collect();
       let is_autostart = args.contains(&"--autostart".to_string());

       if is_autostart {
           // 读取静默启动设置（从 app_data_dir 下的设置文件或已知位置）
           // 方案：前端在开启静默启动时写入标志文件，Rust 检测该文件
           if let Ok(data_dir) = app.path().app_data_dir() {
               if data_dir.join(".silent_start").exists() {
                   if let Some(window) = app.get_webview_window("main") {
                       let _ = window.hide();
                   }
               }
           }
       }

       // ... clipboard listener ...
       Ok(())
   })
   ```

5. **将命令注册到 `invoke_handler`**：
   在 `generate_handler![]` 中添加 `get_autostart`、`set_autostart`。

### Step 4 — 前端类型扩展
**文件**：`src/types/index.ts`

在 `Settings` 类型和 `defaultSettings` 中新增：
```typescript
export type Settings = {
  // ... existing fields ...
  autoStart: boolean;
  silentStart: boolean;
};

export const defaultSettings: Settings = {
  // ... existing defaults ...
  autoStart: false,
  silentStart: false,
};
```

### Step 5 — Tauri 工具封装
**文件**：`src/utils/tauri.ts`

添加：
```typescript
export async function getAutoStart(): Promise<boolean> {
  try {
    return await invoke<boolean>('get_autostart')
  } catch (error) {
    console.error('Failed to get autostart state:', error)
    return false
  }
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  try {
    await invoke('set_autostart', { enabled })
  } catch (error) {
    console.error('Failed to set autostart:', error)
    throw error
  }
}
```

### Step 6 — 设置 Store 扩展
**文件**：`src/stores/settingsStore.ts`

1. `SettingsState` interface 新增：
   ```typescript
   autoStart: boolean
   silentStart: boolean
   setAutoStart: (enabled: boolean) => Promise<void>
   setSilentStart: (enabled: boolean) => Promise<void>
   ```

2. `loadSettings` 中加载新字段（带向后兼容的 `?? false` 回退）

3. `saveSettings` merge 逻辑中加入新字段

4. `exportAllData` 中加入新字段

5. 新增 action：
   ```typescript
   setAutoStart: async (enabled) => {
     try {
       await setAutoStartTauri(enabled) // 来自 utils/tauri
       set({ autoStart: enabled })
       // 保存到 IndexedDB
       await get().saveSettings({ autoStart: enabled })
     } catch (error) {
       // toast error
     }
   },

   setSilentStart: async (enabled) => {
     set({ silentStart: enabled })
     await get().saveSettings({ silentStart: enabled })
     // 写入/删除标志文件，通知 Rust 静默启动状态
     // 方案：通过 tauri fs API 在 app_data_dir 创建/删除 .silent_start 文件
   }
   ```

   **关于 `.silent_start` 标志文件**：由于 Rust 在启动时需要知道静默启动是否开启，但此时前端尚未加载，无法读取 IndexedDB。因此采用文件标志方案：
   - 开启静默启动 → 前端通过 Tauri `writeFile` 在 `app_data_dir` 下创建 `.silent_start` 空文件
   - 关闭静默启动 → 前端删除该文件
   - Rust 启动时检测该文件存在即隐藏窗口

   需要在前端添加 `writeSilentStartFlag(enabled)` 和 `removeSilentStartFlag()` 辅助函数，使用 `@tauri-apps/api/fs`。

   **权限**：需要在 `capabilities/default.json` 中添加 `fs:allow-appdata-meta` 或相关的 app_data_dir 文件读写权限。Tauri v2 中可用 `fs:allow-write-text-file` 配合 `appData` 作用域。

### Step 7 — Settings 页面 UI
**文件**：`src/pages/Settings.tsx`

在"剪切板翻译"区块之后、"数据管理"区块之前，新增"系统设置"区块：

```tsx
<div className="settings-section system-section">
  <h3 className="section-title">系统设置</h3>

  <div className="form-group toggle-group">
    <div className="toggle-switch-wrapper">
      <span className="toggle-label">开机自启</span>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={formData.autoStart}
          onChange={handleAutoStartToggle}
        />
        <span className="toggle-slider" />
      </label>
    </div>
    <p className="toggle-desc">系统启动时自动运行应用</p>
  </div>

  <div className={`form-group toggle-group ${!formData.autoStart ? 'disabled' : ''}`}>
    <div className="toggle-switch-wrapper">
      <span className="toggle-label">静默启动</span>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={formData.silentStart}
          onChange={handleSilentStartToggle}
          disabled={!formData.autoStart}
        />
        <span className="toggle-slider" />
      </label>
    </div>
    <p className="toggle-desc">开机启动时不显示主窗口，仅在托盘运行</p>
  </div>
</div>
```

添加事件处理函数：
```typescript
const handleAutoStartToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const enabled = e.target.checked
  setFormData(prev => ({ ...prev, autoStart: enabled }))
  await settings.setAutoStart(enabled)
}

const handleSilentStartToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const enabled = e.target.checked
  setFormData(prev => ({ ...prev, silentStart: enabled }))
  await settings.setSilentStart(enabled)
}
```

同步 useEffect 中也需要同步 `autoStart` 和 `silentStart`。

### Step 8 — 权限与 Scope 配置（重要）
**文件**：`src-tauri/capabilities/default.json`

需要添加静默启动标志文件读写权限。Tauri v2 的 fs 权限需要配置 `scope` 才能访问 `app_data_dir`：

```json
{
  "permissions": [
    // ... existing ...
    "fs:allow-appdata-read",
    "fs:allow-appdata-write"
  ],
  "fs:scope": {
    "allow": [
      "$APPDATA/*",
      "$APPDATA/.silent_start"
    ]
  }
}
```

或更精确地使用 `fs:allow-write-text-file` 和 `fs:allow-read-text-file`，配合 `scope` 限制。

> ⚠️ 具体 capability 标识符需参考 Tauri v2 文档或插件源码。常见的是 `fs:default`、`fs:allow-write-text-file`、`fs:allow-read-text-file`。

由于项目已使用 `tauri-plugin-fs`（`fs:default` 已包含），`app_data_dir` 的默认 scope 可能已允许。但需要确认 `@tauri-apps/api/fs` 的 `BaseDirectory.AppData` 是否能在无额外 scope 下使用。

**替代方案（更简洁）**：
与其前端写文件，不如在 Rust 中暴露一个命令 `set_silent_start(enabled: bool)`，由 Rust 直接操作文件。这样前端不需要额外的 fs 权限，也避免了 scope 配置的麻烦。

```rust
#[tauri::command]
fn set_silent_start(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let flag_path = data_dir.join(".silent_start");
    if enabled {
        std::fs::write(&flag_path, "").map_err(|e| e.to_string())?;
    } else {
        let _ = std::fs::remove_file(&flag_path);
    }
    Ok(())
}
```

前端只需调用 `invoke('set_silent_start', { enabled })`。

**推荐采用此替代方案**（Rust 端管理标志文件）。

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src-tauri/Cargo.toml` | 修改 | 添加 `tauri-plugin-autostart = "2"` |
| `src-tauri/capabilities/default.json` | 修改 | 添加 `autostart:default` 权限 |
| `src-tauri/src/lib.rs` | 修改 | 初始化插件、添加命令、静默启动逻辑 |
| `src/types/index.ts` | 修改 | 扩展 `Settings` 和 `defaultSettings` |
| `src/utils/tauri.ts` | 修改 | 添加 `getAutoStart` / `setAutoStart` 封装 |
| `src/stores/settingsStore.ts` | 修改 | 加载/保存新字段、新增 actions |
| `src/pages/Settings.tsx` | 修改 | 新增系统设置 UI 区块 |

## 测试与验证

1. **编译测试**：`bun run build:pc` 是否通过
2. **自启开关测试**：
   - 打开设置 → 开启"开机自启" → 查看 Windows 启动项是否添加
   - 关闭开关 → 确认启动项已移除
3. **静默启动测试**：
   - 开启"静默启动" → 模拟 `--autostart` 参数启动应用 → 确认窗口未显示，托盘图标存在
   - 关闭"静默启动" → 模拟 `--autostart` 启动 → 确认窗口正常显示
4. **数据持久化测试**：重启应用后设置是否保持

## 风险与注意事项

1. **autostart 插件的 MacosLauncher 参数**：Windows 下该参数无实际影响，但为代码一致性仍传入 `MacosLauncher::LaunchAgent`
2. **权限最小化**：`autostart:default` 权限标识符需确认，不同版本可能有差异
3. **`.silent_start` 文件残留**：若应用被卸载，该文件可能残留于 app_data_dir。此为可接受的微小残留
4. **单例模式与自启兼容性**：应用已有 `tauri-plugin-single-instance`。自启时若应用已在运行，应由 single instance 插件拉起已有窗口（`handle_single_instance` 已处理 `show` + `set_focus`）
5. **静默启动时 single instance**：若静默启动后用户手动点击 exe，应正常显示窗口（因为不含 `--autostart` 参数）

## 替代方案考虑

- **不采用文件标志，而是命令行参数传递静默状态**：不可行，因为 autostart 插件注册时参数是静态的（`vec!["--autostart"]`），无法动态添加 `--silent`
- **Rust 直接读取 IndexedDB**：过于复杂，IndexedDB 是前端数据库，Rust 端解析成本过高
- **使用 localStorage / Tauri Store 插件**：Tauri v2 有 `tauri-plugin-store`，但引入新插件增加复杂度。当前文件标志方案已足够简洁

---

**计划制定时间**：2026-05-02
**预计实施时间**：中等复杂度，约 7 个文件修改
**前置条件**：用户确认方案后开始实施

**决策点（需用户确认）**：
1. 是否确认采用"Rust 端管理 `.silent_start` 标志文件"的方案？
2. 静默启动开关在"开机自启"关闭时是否仍然可见但 disabled（如计划所示），还是完全隐藏？
3. 设置区块的文案是否需要调整？
