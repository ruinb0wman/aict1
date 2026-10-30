// 运行环境判定：Tauri（桌面/移动）与普通浏览器。
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
