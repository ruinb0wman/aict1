import { create } from 'zustand'
import { WordEntry, QueryResult, TranslationMap, ExampleSentence } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { useAppStore } from '@/stores/appStore'

interface WordsState {
  // 缓存的单词列表
  cachedWords: WordEntry[]
  // 当前编辑的单词
  editingWord: WordEntry | null
  // 是否正在加载
  isLoading: boolean
  
  // 初始化（加载所有缓存的单词）
  init: () => Promise<void>
  // 从缓存获取单词
  getWordFromCache: (word: string) => Promise<WordEntry | null>
  // 保存单词到缓存
  saveWordToCache: (word: string, queryResult: QueryResult) => Promise<WordEntry>
  // 更新单词翻译
  updateWordTranslation: (wordId: string, translation: TranslationMap) => Promise<void>
  // 更新单词例句
  updateWordExamples: (wordId: string, examples: ExampleSentence[]) => Promise<void>
  // 添加/更新批注
  addNote: (wordId: string, note: string) => Promise<void>
  // 删除批注
  removeNote: (wordId: string) => Promise<void>
  // 开始编辑单词
  startEditing: (wordEntry: WordEntry) => void
  // 取消编辑
  cancelEditing: () => void
  // 保存编辑
  saveEditing: (updates: Partial<WordEntry>) => Promise<void>
  // 删除单词缓存
  deleteWord: (wordId: string) => Promise<void>
  // 检查单词是否在缓存中
  isWordCached: (word: string) => boolean
}

export const useWordsStore = create<WordsState>((set, get) => ({
  cachedWords: [],
  editingWord: null,
  isLoading: false,

  // 初始化 - 加载所有缓存的单词
  init: async () => {
    set({ isLoading: true })
    try {
      const words = await indexedDBService.getAllWords()
      set({ cachedWords: words, isLoading: false })
    } catch (error) {
      console.error('Failed to load cached words:', error)
      set({ isLoading: false })
    }
  },

  // 从缓存获取单词
  getWordFromCache: async (word: string) => {
    try {
      const wordEntry = await indexedDBService.getWord(word)
      return wordEntry
    } catch (error) {
      console.error('Failed to get word from cache:', error)
      return null
    }
  },

  // 保存单词到缓存
  saveWordToCache: async (word: string, queryResult: QueryResult) => {
    try {
      const wordEntry = await indexedDBService.saveWord(word, queryResult)
      // 更新本地缓存列表
      const { cachedWords } = get()
      const existingIndex = cachedWords.findIndex(w => w.id === wordEntry.id)
      let newCachedWords: WordEntry[]
      
      if (existingIndex >= 0) {
        // 更新现有单词
        newCachedWords = [...cachedWords]
        newCachedWords[existingIndex] = wordEntry
      } else {
        // 添加新单词到开头
        newCachedWords = [wordEntry, ...cachedWords]
      }
      
      set({ cachedWords: newCachedWords })
      return wordEntry
    } catch (error) {
      console.error('Failed to save word to cache:', error)
      throw error
    }
  },

  // 更新单词翻译
  updateWordTranslation: async (wordId: string, translation: TranslationMap) => {
    try {
      const updatedWord = await indexedDBService.updateWord(wordId, { translation })
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.map(w => 
        w.id === wordId ? updatedWord : w
      )
      set({ cachedWords: newCachedWords })
      
      useAppStore.getState().showToast('翻译已更新', 'success', 2000)
    } catch (error) {
      console.error('Failed to update word translation:', error)
      useAppStore.getState().showToast('更新翻译失败', 'error')
    }
  },

  // 更新单词例句
  updateWordExamples: async (wordId: string, examples: ExampleSentence[]) => {
    try {
      const updatedWord = await indexedDBService.updateWord(wordId, { example: examples })
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.map(w => 
        w.id === wordId ? updatedWord : w
      )
      set({ cachedWords: newCachedWords })
      
      useAppStore.getState().showToast('例句已更新', 'success', 2000)
    } catch (error) {
      console.error('Failed to update word examples:', error)
      useAppStore.getState().showToast('更新例句失败', 'error')
    }
  },

  // 添加/更新批注
  addNote: async (wordId: string, note: string) => {
    try {
      const updatedWord = await indexedDBService.addNote(wordId, note)
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.map(w => 
        w.id === wordId ? updatedWord : w
      )
      set({ cachedWords: newCachedWords })
      
      useAppStore.getState().showToast('批注已保存', 'success', 2000)
    } catch (error) {
      console.error('Failed to add note:', error)
      useAppStore.getState().showToast('保存批注失败', 'error')
    }
  },

  // 删除批注
  removeNote: async (wordId: string) => {
    try {
      const updatedWord = await indexedDBService.removeNote(wordId)
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.map(w => 
        w.id === wordId ? updatedWord : w
      )
      set({ cachedWords: newCachedWords })
      
      useAppStore.getState().showToast('批注已删除', 'info', 2000)
    } catch (error) {
      console.error('Failed to remove note:', error)
      useAppStore.getState().showToast('删除批注失败', 'error')
    }
  },

  // 开始编辑单词
  startEditing: (wordEntry: WordEntry) => {
    set({ editingWord: wordEntry })
  },

  // 取消编辑
  cancelEditing: () => {
    set({ editingWord: null })
  },

  // 保存编辑
  saveEditing: async (updates: Partial<WordEntry>) => {
    const { editingWord } = get()
    if (!editingWord) return

    try {
      const updatedWord = await indexedDBService.updateWord(editingWord.id, updates)
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.map(w => 
        w.id === editingWord.id ? updatedWord : w
      )
      
      set({ cachedWords: newCachedWords, editingWord: null })
      useAppStore.getState().showToast('单词已更新', 'success', 2000)
    } catch (error) {
      console.error('Failed to save editing:', error)
      useAppStore.getState().showToast('保存失败', 'error')
    }
  },

  // 删除单词缓存
  deleteWord: async (wordId: string) => {
    try {
      await indexedDBService.deleteWord(wordId)
      
      // 更新本地缓存列表
      const { cachedWords } = get()
      const newCachedWords = cachedWords.filter(w => w.id !== wordId)
      set({ cachedWords: newCachedWords })
      
      useAppStore.getState().showToast('单词已删除', 'info', 2000)
    } catch (error) {
      console.error('Failed to delete word:', error)
      useAppStore.getState().showToast('删除失败', 'error')
    }
  },

  // 检查单词是否在缓存中
  isWordCached: (word: string) => {
    const { cachedWords } = get()
    return cachedWords.some(w => w.word.toLowerCase() === word.toLowerCase())
  },
}))
