/**
 * 响应式对象（`ref` / `reactive` 产出的是 Proxy）不能直接交给 structured-clone（postMessage 等）：
 * 会抛 `DataCloneError`，且类型检查与单测都抓不到。
 * 现在写库走 HTTP + JSON，POST 前用它把 Proxy 拆成纯对象。
 */
export const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
