// 数据层：SQLite 单文件。语义沿用旧版客户端 IndexedDB 的实现，字段不变的存 doc 列。
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { WordEntry, QueryResult, FavoriteWord, HistoryItem, Settings } from '../src/types'
import { insertHistory } from '../src/libs/history'

const DB_PATH = process.env.DB_PATH ?? 'data/dict.db'
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH, { create: true })

db.run(`
  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY, word TEXT NOT NULL, updatedAt INTEGER NOT NULL,
    queryCount INTEGER NOT NULL DEFAULT 0, doc TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY, word TEXT NOT NULL, createdAt INTEGER NOT NULL, doc TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY, word TEXT NOT NULL, timestamp INTEGER NOT NULL, doc TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`)

const docs = <T>(rows: unknown[]): T[] => (rows as { doc: string }[]).map(r => JSON.parse(r.doc) as T)

// ==================== 单词 ====================

export function getWord(word: string): WordEntry | null {
  const row = db.query('SELECT doc FROM words WHERE id = ?').get(word.toLowerCase()) as { doc: string } | null
  return row ? (JSON.parse(row.doc) as WordEntry) : null
}

export function getAllWords(): WordEntry[] {
  return docs<WordEntry>(db.query('SELECT doc FROM words ORDER BY updatedAt DESC').all())
}

function putWord(entry: WordEntry): WordEntry {
  db.run(
    'INSERT INTO words (id, word, updatedAt, queryCount, doc) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET word = excluded.word, updatedAt = excluded.updatedAt, ' +
      'queryCount = excluded.queryCount, doc = excluded.doc',
    [entry.id, entry.word, entry.updatedAt, entry.queryCount, JSON.stringify(entry)]
  )
  return entry
}

export function saveWord(word: string, queryResult: QueryResult): WordEntry {
  const existing = getWord(word)
  const now = Date.now()
  const entry: WordEntry = existing
    ? {
        ...existing,
        phonetic: queryResult.phonetic || existing.phonetic,
        translation: queryResult.translation,
        example: queryResult.example,
        synonyms: queryResult.synonyms || existing.synonyms,
        antonyms: queryResult.antonyms || existing.antonyms,
        baseForm: queryResult.baseForm || existing.baseForm,
        updatedAt: now,
        queryCount: existing.queryCount + 1,
      }
    : {
        id: word.toLowerCase(),
        word,
        phonetic: queryResult.phonetic,
        translation: queryResult.translation,
        example: queryResult.example,
        synonyms: queryResult.synonyms,
        antonyms: queryResult.antonyms,
        baseForm: queryResult.baseForm,
        createdAt: now,
        updatedAt: now,
        queryCount: 1,
      }
  return putWord(entry)
}

export function updateWord(wordId: string, updates: Partial<WordEntry>): WordEntry {
  const existing = getWord(wordId)
  if (!existing) throw new Error('Word not found')
  return putWord({ ...existing, ...updates, updatedAt: Date.now() })
}

export function deleteWord(wordId: string): void {
  db.run('DELETE FROM words WHERE id = ?', [wordId.toLowerCase()])
}

// ==================== 收藏 ====================

export function getAllFavorites(): FavoriteWord[] {
  return docs<FavoriteWord>(db.query('SELECT doc FROM favorites ORDER BY createdAt DESC').all())
}

export function saveFavorite(favorite: FavoriteWord): void {
  db.run(
    'INSERT INTO favorites (id, word, createdAt, doc) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET word = excluded.word, createdAt = excluded.createdAt, doc = excluded.doc',
    [favorite.id, favorite.word, favorite.createdAt, JSON.stringify(favorite)]
  )
}

export function removeFavorite(id: string): void {
  db.run('DELETE FROM favorites WHERE id = ?', [id])
}

export function updateFavorite(id: string, updates: Partial<FavoriteWord>): void {
  const row = db.query('SELECT doc FROM favorites WHERE id = ?').get(id) as { doc: string } | null
  if (!row) return
  saveFavorite({ ...(JSON.parse(row.doc) as FavoriteWord), ...updates })
}

// ==================== 历史 ====================

export function getAllHistory(): HistoryItem[] {
  return docs<HistoryItem>(db.query('SELECT doc FROM history ORDER BY timestamp DESC').all())
}

/** 单条追加：同词旧记录顶掉、按 limit 截断（复用 src/libs/history.ts 的纯函数），返回新列表 */
export function appendHistory(item: HistoryItem, limit: number): HistoryItem[] {
  const next = insertHistory(getAllHistory(), item, limit)
  db.transaction(() => {
    db.run('DELETE FROM history')
    for (const h of next) {
      db.run('INSERT INTO history (id, word, timestamp, doc) VALUES (?, ?, ?, ?)', [
        h.id, h.word, h.timestamp, JSON.stringify(h),
      ])
    }
  })()
  return next
}

export function removeHistory(id: string): HistoryItem[] {
  db.run('DELETE FROM history WHERE id = ?', [id])
  return getAllHistory()
}

export function clearHistory(): void {
  db.run('DELETE FROM history')
}

// ==================== 设置 ====================

export function getSettings(): Settings | null {
  const row = db.query('SELECT value FROM settings WHERE key = ?').get('app_settings') as { value: string } | null
  return row ? (JSON.parse(row.value) as Settings) : null
}

export function saveSettings(settings: Settings): void {
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    'app_settings',
    JSON.stringify(settings),
  ])
}

export function getHistoryLimit(): number {
  return getSettings()?.historyLimit || 100
}
