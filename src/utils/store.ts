// 数据层：所有数据在服务端（server/db.ts + SQLite），这里只做 HTTP。
// 页面由同一个 server 提供，所以请求一律是相对路径（同源），没有地址配置这回事。
import type {
  WordEntry,
  QueryResult,
  FavoriteWord,
  HistoryItem,
  Settings,
  QueryResponse,
  GrammarCheckResult,
} from '@/types'

const DEFAULT_TIMEOUT = 8000
// 服务端自己给上游 LLM 30s，这里要比它宽
const LLM_TIMEOUT = 60000

function timeoutFor(path: string): number {
  return path.startsWith('/api/query') || path.startsWith('/api/grammar') ? LLM_TIMEOUT : DEFAULT_TIMEOUT
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(timeoutFor(path)) })
  } catch {
    // 传输层失败 = 服务没起/网络断（业务错误走下面的 !response.ok）
    throw new Error('连不上服务器')
  }

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
    const response = await fetch('/api/export', { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) })
    return response.text()
  },
  importData: (data: unknown) => send<{ imported: number; skipped: number }>('/api/import', 'POST', data),
}
