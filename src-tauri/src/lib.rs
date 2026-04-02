use tauri::Manager;
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

// 设置类型
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Settings {
    api_base_url: String,
    api_key: String,
    model: String,
    temperature: f32,
    history_limit: i32,
}

// 收藏类型
#[derive(Debug, Clone, Serialize, Deserialize)]
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

// 文件操作结果
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

// 导入收藏结果
#[derive(Debug, Clone, Serialize)]
struct ImportFavoritesResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    favorites: Option<Vec<FavoriteWord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    valid_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// 导入设置结果
#[derive(Debug, Clone, Serialize)]
struct ImportSettingsResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    settings: Option<Settings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// 导出收藏
#[tauri::command]
async fn export_favorites(
    app: tauri::AppHandle,
    favorites: Vec<FavoriteWord>,
) -> Result<FileOperationResult, String> {
    let file_path = app.dialog().file().blocking_save_file();
    
    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let data = serde_json::to_string_pretty(&favorites)
                .map_err(|e| format!("序列化失败: {}", e))?;
            
            std::fs::write(&path_str, data)
                .map_err(|e| format!("写入文件失败: {}", e))?;
            
            Ok(FileOperationResult {
                success: true,
                cancelled: Some(false),
                file_path: Some(path_str),
                error: None,
            })
        }
        None => Ok(FileOperationResult {
            success: false,
            cancelled: Some(true),
            file_path: None,
            error: None,
        }),
    }
}

// 导入收藏
#[tauri::command]
async fn import_favorites(app: tauri::AppHandle) -> Result<ImportFavoritesResult, String> {
    let file_path = app.dialog().file().blocking_pick_file();
    
    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let data = std::fs::read_to_string(&path_str)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            
            let favorites: Vec<FavoriteWord> = serde_json::from_str(&data)
                .map_err(|e| format!("解析 JSON 失败: {}", e))?;
            
            Ok(ImportFavoritesResult {
                success: true,
                cancelled: Some(false),
                favorites: Some(favorites.clone()),
                total_count: Some(favorites.len()),
                valid_count: Some(favorites.len()),
                error: None,
            })
        }
        None => Ok(ImportFavoritesResult {
            success: false,
            cancelled: Some(true),
            favorites: None,
            total_count: None,
            valid_count: None,
            error: None,
        }),
    }
}

// 导出设置
#[tauri::command]
async fn export_settings(
    app: tauri::AppHandle,
    settings: Settings,
) -> Result<FileOperationResult, String> {
    let file_path = app.dialog().file().blocking_save_file();
    
    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let data = serde_json::to_string_pretty(&settings)
                .map_err(|e| format!("序列化失败: {}", e))?;
            
            std::fs::write(&path_str, data)
                .map_err(|e| format!("写入文件失败: {}", e))?;
            
            Ok(FileOperationResult {
                success: true,
                cancelled: Some(false),
                file_path: Some(path_str),
                error: None,
            })
        }
        None => Ok(FileOperationResult {
            success: false,
            cancelled: Some(true),
            file_path: None,
            error: None,
        }),
    }
}

// 导入设置
#[tauri::command]
async fn import_settings(app: tauri::AppHandle) -> Result<ImportSettingsResult, String> {
    let file_path = app.dialog().file().blocking_pick_file();
    
    match file_path {
        Some(path) => {
            let path_str: String = path.to_string();
            let data = std::fs::read_to_string(&path_str)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            
            let settings: Settings = serde_json::from_str(&data)
                .map_err(|e| format!("解析 JSON 失败: {}", e))?;
            
            Ok(ImportSettingsResult {
                success: true,
                cancelled: Some(false),
                settings: Some(settings),
                error: None,
            })
        }
        None => Ok(ImportSettingsResult {
            success: false,
            cancelled: Some(true),
            settings: None,
            error: None,
        }),
    }
}

/// 打开开发者工具
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

/// 显示窗口
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

/// 隐藏窗口
#[tauri::command]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("窗口未找到".to_string())
    }
}

/// 退出应用程序
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 处理单例模式：当第二个实例启动时，聚焦到已存在的窗口
#[cfg(desktop)]
fn handle_single_instance(app: &tauri::AppHandle, _args: Vec<String>, _cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        // 发送事件到前端，通知是重复启动
        let _ = window.emit("single-instance", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init());

    // 单例模式插件：只在桌面端启用
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(handle_single_instance));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            export_favorites,
            import_favorites,
            export_settings,
            import_settings,
            get_platform,
            open_devtools,
            show_window,
            hide_window,
            quit_app,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::tray::{TrayIconBuilder, TrayIconEvent};
                use tauri::menu::{Menu, MenuItem};
                
                // 创建托盘菜单
                let show_i = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
                
                // 创建托盘图标
                let tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("AI Dictionary")
                    .menu(&menu)
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
                        match event {
                            TrayIconEvent::Click { .. } => {
                                // 左键单击切换显示/隐藏
                                if let Some(window) = tray.app_handle().get_webview_window("main") {
                                    if window.is_visible().unwrap_or(true) {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
                    
                // 存储 tray 引用以防被释放
                app.manage(tray);
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // 阻止默认关闭行为，改为隐藏窗口
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}