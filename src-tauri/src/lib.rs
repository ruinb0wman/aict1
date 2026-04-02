use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 获取当前平台类型
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

/// 处理单例模式：当第二个实例启动时，聚焦到已存在的窗口（仅桌面端）
#[cfg(desktop)]
fn handle_single_instance(app: &tauri::AppHandle, _args: Vec<String>, _cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init());

    // 只在桌面端启用全局快捷键插件
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    // 单例模式插件：只在桌面端启用
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(handle_single_instance));
    }

    builder
        .invoke_handler(tauri::generate_handler![greet, get_platform,])
        .setup(|app| {
            // 在这里可以添加应用初始化逻辑
            // 例如：创建系统托盘菜单、初始化数据库等

            #[cfg(desktop)]
            {
                use tauri::tray::TrayIconBuilder;
                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Tauri2 Template")
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
