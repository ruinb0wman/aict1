use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Manager, Emitter};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

// ==================== 剪切板监听状态 ====================

#[derive(Debug, Clone)]
struct ClipboardMonitorState {
    enabled: bool,
    interval_ms: u64,
    last_copy_time: Option<Instant>,
    ctrl_pressed: bool,
}

impl ClipboardMonitorState {
    fn new() -> Self {
        Self {
            enabled: false,
            interval_ms: 1000,
            last_copy_time: None,
            ctrl_pressed: false,
        }
    }
}

// ==================== 设置类型 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    api_base_url: String,
    api_key: String,
    model: String,
    temperature: f32,
    history_limit: i32,
}

// ==================== 收藏类型 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FavoriteWord {
    id: String,
    word: String,
    translation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    phonetic: Option<String>,
    created_at: i64,
    query_data: serde_json::Value,
    review_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_reviewed_at: Option<i64>,
    mastery_level: i32,
}

// ==================== 文件操作类型 ====================

#[derive(Debug, Clone, Serialize)]
struct FileOperationResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportData {
    export_date: String,
    app_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    settings: Option<Settings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    favorites: Option<Vec<FavoriteWord>>,
}

#[derive(Debug, Clone, Serialize)]
struct ImportDataResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    settings: Option<Settings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    favorites: Option<Vec<FavoriteWord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    valid_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// ==================== 剪切板监听命令结果 ====================

#[derive(Debug, Clone, Serialize)]
struct ClipboardMonitorConfig {
    enabled: bool,
    interval_ms: u64,
}

// ==================== 英文检测 ====================

/// 检测文本是否为英文
/// 标准：非空字符中 ASCII 字母占比 ≥ 60%，且不是纯数字/纯符号
fn is_english_text(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }

    let mut total_chars = 0usize;
    let mut alpha_count = 0usize;
    let mut _digit_count = 0usize;

    for ch in trimmed.chars() {
        // 忽略常见英文标点和空格
        if ch.is_whitespace() || ch == '.' || ch == ',' || ch == '!' || ch == '?'
            || ch == ';' || ch == ':' || ch == '\'' || ch == '"' || ch == '('
            || ch == ')' || ch == '-' || ch == '[' || ch == ']' || ch == '{' || ch == '}'
            || ch == '/' || ch == '\\' || ch == '_' || ch == '+' || ch == '='
            || ch == '*' || ch == '&' || ch == '^' || ch == '%' || ch == '$'
            || ch == '#' || ch == '@' || ch == '~' || ch == '`' || ch == '|'
            || ch == '<' || ch == '>' || ch == '\n' || ch == '\r' || ch == '\t' {
            continue;
        }

        total_chars += 1;
        if ch.is_ascii_alphabetic() {
            alpha_count += 1;
        } else if ch.is_ascii_digit() {
            _digit_count += 1;
        }
    }

    if total_chars == 0 {
        return false;
    }

    // 排除纯数字或纯符号
    if alpha_count == 0 {
        return false;
    }

    let alpha_ratio = alpha_count as f64 / total_chars as f64;
    alpha_ratio >= 0.60
}

// ==================== 全局键盘监听线程 ====================

/// 启动全局键盘监听，检测双击 Ctrl+C（Windows 使用 GetAsyncKeyState 轮询，零冲突）
#[cfg(windows)]
fn start_global_key_listener(app_handle: tauri::AppHandle, state: Arc<Mutex<ClipboardMonitorState>>) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    std::thread::spawn(move || {
        let mut last_copy_time: Option<Instant> = None;
        let is_holding = AtomicBool::new(false);

        loop {
            // 检查是否启用
            let is_enabled = {
                let guard = state.lock().unwrap();
                guard.enabled
            };

            if !is_enabled {
                std::thread::sleep(Duration::from_millis(100));
                last_copy_time = None;
                is_holding.store(false, Ordering::SeqCst);
                continue;
            }

            // 检测 Ctrl 和 C 键状态
            // GetAsyncKeyState 返回值最高位为 1 表示当前被按下
            let ctrl_down = unsafe { GetAsyncKeyState(0x11i32) < 0 }; // VK_CONTROL = 0x11
            let c_down = unsafe { GetAsyncKeyState(0x43i32) < 0 };    // 'C' = 0x43

            if ctrl_down && c_down {
                // 只在首次按下时触发（防止长按连续触发）
                if !is_holding.load(Ordering::SeqCst) {
                    is_holding.store(true, Ordering::SeqCst);

                    let interval = {
                        let guard = state.lock().unwrap();
                        Duration::from_millis(guard.interval_ms)
                    };

                    let now = Instant::now();
                    let should_trigger = match last_copy_time {
                        Some(last) if now.duration_since(last) <= interval => true,
                        _ => false,
                    };

                    if should_trigger {
                        // 双击触发！清空时间避免连续触发
                        last_copy_time = None;
                        let app = app_handle.clone();
                        std::thread::spawn(move || {
                            // 延迟 500ms 等待系统复制完成（某些程序锁定剪切板时间较长）
                            std::thread::sleep(Duration::from_millis(500));
                            handle_double_ctrl_c(&app);
                        });
                    } else {
                        last_copy_time = Some(now);
                    }
                }
            } else {
                is_holding.store(false, Ordering::SeqCst);
            }

            std::thread::sleep(Duration::from_millis(50));
        }
    });
}

#[cfg(not(windows))]
fn start_global_key_listener(_app_handle: tauri::AppHandle, _state: Arc<Mutex<ClipboardMonitorState>>) {
    // 非 Windows 平台暂不支持全局键盘监听
}

/// 处理双击 Ctrl+C 事件
fn handle_double_ctrl_c(app_handle: &tauri::AppHandle) {
    // 读取剪切板，带重试机制（解决剪切板锁竞争）
    let clipboard_text = {
        let mut result = None;
        for attempt in 0..10 {
            match app_handle.clipboard().read_text() {
                Ok(text) => {
                    if !text.trim().is_empty() {
                        result = Some(text);
                    }
                    break;
                }
                Err(e) => {
                    if attempt < 9 {
                        std::thread::sleep(Duration::from_millis(150));
                    } else {
                        eprintln!("[剪切板监听] 读取剪切板失败，已放弃: {}", e);
                    }
                }
            }
        }
        match result {
            Some(text) => text,
            None => return,
        }
    };

    // 检测是否为英文
    if !is_english_text(&clipboard_text) {
        return;
    }

    // 显示窗口并发送事件
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let payload = serde_json::json!({
            "text": clipboard_text.trim()
        });
        let _ = window.emit("clipboard-translate", payload);
    }
}

// ==================== Tauri Commands ====================

#[tauri::command]
async fn update_clipboard_monitor(
    state: tauri::State<'_, Arc<Mutex<ClipboardMonitorState>>>,
    enabled: bool,
    interval_ms: u64,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.enabled = enabled;
    guard.interval_ms = interval_ms.max(200).min(5000);
    Ok(())
}

#[tauri::command]
async fn get_clipboard_monitor_state(
    state: tauri::State<'_, Arc<Mutex<ClipboardMonitorState>>>,
) -> Result<ClipboardMonitorConfig, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(ClipboardMonitorConfig {
        enabled: guard.enabled,
        interval_ms: guard.interval_ms,
    })
}

#[tauri::command]
async fn export_data(
    app: tauri::AppHandle,
    data: ExportData,
    default_file_name: String,
) -> Result<FileOperationResult, String> {
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_file_name)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let json_data = match serde_json::to_string_pretty(&data) {
                Ok(d) => d,
                Err(e) => {
                    return Ok(FileOperationResult {
                        success: false,
                        cancelled: Some(false),
                        file_path: None,
                        error: Some(format!("序列化失败: {}", e)),
                    });
                }
            };

            match std::fs::write(&path_str, json_data) {
                Ok(_) => Ok(FileOperationResult {
                    success: true,
                    cancelled: Some(false),
                    file_path: Some(path_str),
                    error: None,
                }),
                Err(e) => Ok(FileOperationResult {
                    success: false,
                    cancelled: Some(false),
                    file_path: None,
                    error: Some(format!("写入文件失败: {}", e)),
                }),
            }
        }
        None => Ok(FileOperationResult {
            success: false,
            cancelled: Some(true),
            file_path: None,
            error: None,
        }),
    }
}

#[tauri::command]
async fn import_data(app: tauri::AppHandle) -> Result<ImportDataResult, String> {
    let file_path = app.dialog().file().blocking_pick_file();

    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let data = std::fs::read_to_string(&path_str)
                .map_err(|e| format!("读取文件失败: {}", e))?;

            let export_data: ExportData = serde_json::from_str(&data)
                .map_err(|e| format!("解析 JSON 失败: {}", e))?;

            let favorites_count = export_data.favorites.as_ref().map(|f| f.len()).unwrap_or(0);

            Ok(ImportDataResult {
                success: true,
                cancelled: Some(false),
                settings: export_data.settings,
                favorites: export_data.favorites,
                total_count: Some(favorites_count),
                valid_count: Some(favorites_count),
                error: None,
            })
        }
        None => Ok(ImportDataResult {
            success: false,
            cancelled: Some(true),
            settings: None,
            favorites: None,
            total_count: None,
            valid_count: None,
            error: None,
        }),
    }
}

#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("窗口未找到".to_string())
    }
}

#[tauri::command]
fn get_platform() -> &'static str {
    #[cfg(desktop)]
    {
        "desktop"
    }
    #[cfg(mobile)]
    {
        "mobile"
    }
}

#[cfg(desktop)]
#[tauri::command]
async fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("窗口未找到".to_string())
    }
}

#[cfg(mobile)]
#[tauri::command]
async fn show_window(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("窗口未找到".to_string())
    }
}

#[cfg(mobile)]
#[tauri::command]
async fn hide_window(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(desktop)]
fn handle_single_instance(app: &tauri::AppHandle, _args: Vec<String>, _cwd: String) {
    use tauri::Emitter;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("single-instance", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化剪切板监听状态
    let clipboard_state = Arc::new(Mutex::new(ClipboardMonitorState::new()));
    let clipboard_state_for_setup = clipboard_state.clone();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // 单例模式插件：只在桌面端启用
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(handle_single_instance));
    }

    builder
        .manage(clipboard_state)
        .invoke_handler(tauri::generate_handler![
            export_data,
            import_data,
            get_platform,
            open_devtools,
            show_window,
            hide_window,
            quit_app,
            update_clipboard_monitor,
            get_clipboard_monitor_state,
        ])
        .setup(move |app| {
            #[cfg(desktop)]
            {
                use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
                use tauri::menu::{Menu, MenuItem};

                // 创建托盘菜单
                let show_i = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

                // 创建托盘图标
                let tray_icon = tauri::image::Image::from_bytes(
                    include_bytes!("../icons/tray_icon.png")
                )?;

                let tray = TrayIconBuilder::new()
                    .icon(tray_icon)
                    .tooltip("AI Dictionary")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click { button, button_state, .. } = event {
                            if button == MouseButton::Left && button_state == MouseButtonState::Up {
                                if let Some(window) = tray.app_handle().get_webview_window("main") {
                                    if let Ok(visible) = window.is_visible() {
                                        if visible {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                    }
                                }
                            }
                        }
                    })
                    .build(app)?;

                app.manage(tray);

                // 启动全局键盘监听线程
                let app_handle = app.app_handle().clone();
                start_global_key_listener(app_handle, clipboard_state_for_setup);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
