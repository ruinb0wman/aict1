import Dexie, { type EntityTable } from 'dexie'
import { WordEntry, QueryResult, FavoriteWord, HistoryItem, Settings } from '@/types'

// 定义 Dexie 数据库
interface DictDB extends Dexie {
  words: EntityTable<WordEntry, 'id'>
  favorites: EntityTable<FavoriteWord, 'id'>
  history: EntityTable<HistoryItem, 'id'>
  settings: EntityTable<{ key: string; value: Settings }, 'key'>
}

const DB_NAME = 'DictDB'
const DB_VERSION = 3  // 升级数据库版本以添加 history 和 settings 表

export class IndexedDBService {
  private db: DictDB

  constructor() {
    this.db = new Dexie(DB_NAME) as DictDB

    // 定义数据库结构
    this.db.version(DB_VERSION).stores({
      words: 'id, word, updatedAt',
      favorites: 'id, word, createdAt',
      history: 'id, word, timestamp',
      settings: 'key'
    })
  }

  // 获取单词（不区分大小写）
  async getWord(word: string): Promise<WordEntry | null> {
    const result = await this.db.words.get(word.toLowerCase())
    return result || null
  }

  // 添加或更新单词
  async saveWord(word: string, queryResult: QueryResult): Promise<WordEntry> {
    const existingWord = await this.getWord(word)
    const now = Date.now()

    const wordEntry: WordEntry = existingWord
      ? {
          ...existingWord,
          phonetic: queryResult.phonetic || existingWord.phonetic,
          translation: queryResult.translation,
          example: queryResult.example,
          updatedAt: now,
          queryCount: existingWord.queryCount + 1,
        }
      : {
          id: word.toLowerCase(),
          word: word,
          phonetic: queryResult.phonetic,
          translation: queryResult.translation,
          example: queryResult.example,
          createdAt: now,
          updatedAt: now,
          queryCount: 1,
        }

    await this.db.words.put(wordEntry)
    return wordEntry
  }

  // 更新单词（用于编辑功能）
  async updateWord(wordId: string, updates: Partial<WordEntry>): Promise<WordEntry> {
    const existingWord = await this.getWord(wordId)
    if (!existingWord) {
      throw new Error('Word not found')
    }

    const updatedWord: WordEntry = {
      ...existingWord,
      ...updates,
      updatedAt: Date.now(),
    }

    await this.db.words.put(updatedWord)
    return updatedWord
  }

  // 添加/更新批注
  async addNote(wordId: string, note: string): Promise<WordEntry> {
    return this.updateWord(wordId, { note })
  }

  // 删除批注
  async removeNote(wordId: string): Promise<WordEntry> {
    return this.updateWord(wordId, { note: undefined })
  }

  // 获取所有单词（按更新时间倒序）
  async getAllWords(): Promise<WordEntry[]> {
    return this.db.words.orderBy('updatedAt').reverse().toArray()
  }

  // 搜索单词
  async searchWords(query: string): Promise<WordEntry[]> {
    const lowerQuery = query.toLowerCase()
    const allWords = await this.getAllWords()
    return allWords.filter(w => 
      w.word.toLowerCase().includes(lowerQuery) ||
      Object.values(w.translation).some(translations =>
        translations.some(t => t.toLowerCase().includes(lowerQuery))
      )
    )
  }

  // 删除单词
  async deleteWord(wordId: string): Promise<void> {
    await this.db.words.delete(wordId.toLowerCase())
  }

  // 将 WordEntry 转换为 QueryResult
  static toQueryResult(wordEntry: WordEntry): QueryResult {
    return {
      word: wordEntry.word,
      phonetic: wordEntry.phonetic,
      translation: wordEntry.translation,
      example: wordEntry.example,
    }
  }

  // ==================== 收藏相关方法 ====================

  // 获取所有收藏（按收藏时间倒序）
  async getAllFavorites(): Promise<FavoriteWord[]> {
    return this.db.favorites.orderBy('createdAt').reverse().toArray()
  }

  // 根据单词获取收藏
  async getFavoriteByWord(word: string): Promise<FavoriteWord | undefined> {
    return this.db.favorites.get({ word: word.toLowerCase() })
  }

  // 添加收藏
  async addFavorite(favorite: FavoriteWord): Promise<void> {
    await this.db.favorites.put(favorite)
  }

  // 删除收藏
  async removeFavorite(id: string): Promise<void> {
    await this.db.favorites.delete(id)
  }

  // 更新收藏
  async updateFavorite(id: string, updates: Partial<FavoriteWord>): Promise<void> {
    const favorite = await this.db.favorites.get(id)
    if (favorite) {
      await this.db.favorites.put({ ...favorite, ...updates })
    }
  }

  // 检查单词是否已收藏
  async isFavorite(word: string): Promise<boolean> {
    const count = await this.db.favorites.where({ word: word.toLowerCase() }).count()
    return count > 0
  }

  // ==================== 历史记录相关方法 ====================

  // 获取所有历史记录（按时间倒序）
  async getAllHistory(): Promise<HistoryItem[]> {
    return this.db.history.orderBy('timestamp').reverse().toArray()
  }

  // 添加历史记录
  async addHistory(item: HistoryItem): Promise<void> {
    await this.db.history.put(item)
  }

  // 保存所有历史记录（清空后重新保存）
  async saveHistory(history: HistoryItem[]): Promise<void> {
    await this.db.history.clear()
    if (history.length > 0) {
      await this.db.history.bulkPut(history)
    }
  }

  // 删除单条历史记录
  async removeHistory(id: string): Promise<void> {
    await this.db.history.delete(id)
  }

  // 清空历史记录
  async clearHistory(): Promise<void> {
    await this.db.history.clear()
  }

  // 根据单词查找历史记录
  async getHistoryByWord(word: string): Promise<HistoryItem | undefined> {
    return this.db.history.get({ word: word.toLowerCase() })
  }

  // ==================== 设置相关方法 ====================

  // 获取设置
  async getSettings(): Promise<Settings | null> {
    const result = await this.db.settings.get('app_settings')
    return result?.value || null
  }

  // 保存设置
  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put({ key: 'app_settings', value: settings })
  }
}

export const indexedDBService = new IndexedDBService()
