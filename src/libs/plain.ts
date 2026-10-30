/**
 * 响应式对象（`ref` / `reactive` 产出的是 Proxy）不能直接交给 structured-clone（Dexie / postMessage）：
 * 会抛 `DataCloneError`，且类型检查与单测都抓不到。
 * 现在写库走 HTTP + JSON，这里还留着是因为迁移旧 IndexedDB 数据时仍需要它。
 */
export const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
