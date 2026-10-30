// 数据层：所有数据在服务端（server/db.ts + SQLite），这里只做 HTTP。
// 方法签名与旧的 indexedDB 实现保持一致，调用方（4 个 store + SearchBox）不用改。
import type {
  WordEntry,
  QueryResult,
  FavoriteWord,
  HistoryItem,
  Settings,
  QueryResponse,
  GrammarCheckResult,
} from '@/types'
import { isTauri } from '@/libs/env'
import { markOnline, markUnreachable } from '@/libs/serverState'

const DEFAULT_TIMEOUT = 8000
// 服务端自己给上游 LLM 30s，这里要比它宽
const LLM_TIMEOUT = 60000

/**
 * 规整用户填的地址：补 scheme、去尾斜杠；空串表示「同源」（浏览器端）。
 * 少了这一步，`192.168.1.2:8471` 会被当相对路径，表现成「填了却还是连不上」。
 */
export function normalizeBase(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

function readStoredBase(): string {
  // Tauri 打包版靠打包时注入的 VITE_API_BASE；localStorage 里的值优先
  const baked = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
  try {
    return normalizeBase(localStorage.getItem('apiBase') || baked)
  } catch {
    return normalizeBase(baked)
  }
}

let base = readStoredBase()

/** 当前服务器地址；空串 = 与页面同源 */
export function getBase(): string {
  return base
}

/** 改服务器地址（持久化到 localStorage），立即对后续请求生效 */
export function setBase(input: string): void {
  base = normalizeBase(input)
  try {
    if (base) localStorage.setItem('apiBase', base)
    else localStorage.removeItem('apiBase')
  } catch {
    // 隐私模式等拿不到 localStorage 时忽略：地址仍在本进程内生效
  }
}

function resolveBase(): string {
  return base || location.origin
}

let tauriFetch: typeof fetch | undefined

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isTauri()) return fetch(url, init)
  // Tauri 走 Rust 侧请求：不吃 CORS，也不吃 Android 的 cleartext 限制
  tauriFetch ??= (await import('@tauri-apps/plugin-http')).fetch as typeof fetch
  return tauriFetch(url, init)
}

/** 探活：2s 内拿不到 /api/health 就算不可用 */
export async function probeServer(target?: string): Promise<boolean> {
  const baseUrl = target ? normalizeBase(target) || location.origin : resolveBase()
  try {
    const response = await apiFetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

function timeoutFor(path: string): number {
  return path.startsWith('/api/query') || path.startsWith('/api/grammar') ? LLM_TIMEOUT : DEFAULT_TIMEOUT
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await apiFetch(`${resolveBase()}${path}`, { ...init, signal: AbortSignal.timeout(timeoutFor(path)) })
  } catch (error) {
    // 传输层失败 = 地址/网络问题（连不上、超时、证书不对）→ 交给离线页接管
    markUnreachable(error instanceof Error ? error.message : String(error))
    throw new Error('连不上服务器')
  }

  // 服务端可达：业务错误（404/500）不算连不上
  markOnline()

  const raw = await response.text()
  const data = raw ? (JSON.parse(raw) as unknown) : null
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || `请求失败: ${response.status}`)
  }
  return data as T
}

function send<T>(path: string, method: string, payload?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
}

/** WordEntry → QueryResult（缓存命中时用） */
export function toQueryResult(entry: WordEntry): QueryResult {
  return {
    word: entry.word,
    phonetic: entry.phonetic,
    translation: entry.translation,
    example: entry.example,
    synonyms: entry.synonyms,
    antonyms: entry.antonyms,
    baseForm: entry.baseForm,
  }
}

export const store = {
  // ==================== 单词 ====================
  async getWord(word: string): Promise<WordEntry | null> {
    try {
      return await request<WordEntry>(`/api/words/${encodeURIComponent(word)}`)
    } catch {
      return null
    }
  },
  getAllWords: () => request<WordEntry[]>('/api/words'),
  saveWord: (word: string, queryResult: QueryResult) =>
    send<WordEntry>('/api/words', 'POST', { word, queryResult }),
  updateWord: (wordId: string, updates: Partial<WordEntry>) =>
    send<WordEntry>(`/api/words/${encodeURIComponent(wordId)}`, 'PATCH', updates),
  deleteWord: (wordId: string) => send<{ ok: true }>(`/api/words/${encodeURIComponent(wordId)}`, 'DELETE'),

  // ==================== 收藏 ====================
  getAllFavorites: () => request<FavoriteWord[]>('/api/favorites'),
  addFavorite: (favorite: FavoriteWord) => send<{ ok: true }>('/api/favorites', 'POST', favorite),
  removeFavorite: (id: string) => send<{ ok: true }>(`/api/favorites/${encodeURIComponent(id)}`, 'DELETE'),
  updateFavorite: (id: string, updates: Partial<FavoriteWord>) =>
    send<{ ok: true }>(`/api/favorites/${encodeURIComponent(id)}`, 'PATCH', updates),

  // ==================== 历史（服务端去重 + 按 historyLimit 截断，返回新列表）====================
  getAllHistory: () => request<HistoryItem[]>('/api/history'),
  appendHistory: (item: HistoryItem) => send<HistoryItem[]>('/api/history', 'POST', { item }),
  removeHistory: (id: string) => send<HistoryItem[]>(`/api/history/${encodeURIComponent(id)}`, 'DELETE'),
  clearHistory: () => send<HistoryItem[]>('/api/history', 'DELETE'),

  // ==================== 设置 ====================
  getSettings: () => request<Settings | null>('/api/settings'),
  saveSettings: (settings: Settings) => send<{ ok: true }>('/api/settings', 'PUT', settings),

  // ==================== LLM（服务端代理，key 不出服务）====================
  query: (input: string) => send<QueryResponse>('/api/query', 'POST', { input }),
  grammar: (text: string) => send<GrammarCheckResult>('/api/grammar', 'POST', { text }),
  testConnection: (settings: Settings) =>
    send<{ success: boolean; message: string }>('/api/test-connection', 'POST', { settings }),

  // ==================== 备份 ====================
  exportRaw: async (): Promise<string> => {
    const response = await apiFetch(`${resolveBase()}/api/export`, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) })
    return response.text()
  },
  importData: (data: unknown) => send<{ imported: number; skipped: number }>('/api/import', 'POST', data),
}
