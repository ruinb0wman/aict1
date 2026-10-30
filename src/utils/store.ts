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

// web 端永远同源（dev 靠 vite proxy，prod 同源）；Tauri 打包版没有同源，靠打包时注入的绝对地址
// localStorage / location 在 node（vitest）里不存在，取不到就退回空串
const BASE = (() => {
  try {
    return localStorage.getItem('apiBase') || (import.meta.env.VITE_API_BASE as string | undefined) || location.origin
  } catch {
    return ''
  }
})()

let tauriFetch: typeof fetch | undefined

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE}${path}`
  if (!isTauri()) return fetch(url, init)
  // Tauri 走 Rust 侧请求：不吃 CORS，也不吃 Android 的 cleartext 限制
  tauriFetch ??= (await import('@tauri-apps/plugin-http')).fetch as typeof fetch
  return tauriFetch(url, init)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
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
    const response = await apiFetch('/api/export')
    return response.text()
  },
  importData: (data: unknown) => send<{ imported: number; skipped: number }>('/api/import', 'POST', data),
}

export { BASE as apiBase }
