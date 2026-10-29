/**
 * 响应式对象（`ref` / `reactive` 产出的是 Proxy）不能直接交给 Dexie：
 * 写库走 structured-clone，遇到 Proxy 直接抛 `DataCloneError`，且类型检查与单测都抓不到。
 */
export const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
