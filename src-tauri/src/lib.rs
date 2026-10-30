// 这个 app 只剩移动端（Android）：桌面端的托盘、全局快捷键、自启、单实例、
// 窗口控制与原生文件对话框全部移除。数据与业务都在本机 server，前端只发 HTTP。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
