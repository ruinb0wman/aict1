import { create } from 'zustand'
import { HistoryItem, QueryResponse } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { useAppStore } from '@/stores/appStore'

interface HistoryState {
  history: HistoryItem[]
  isLoading: boolean
  
  // 加载历史
  loadHistory: () => Promise<void>
  // 保存历史
  saveHistory: (history: HistoryItem[]) => Promise<void>
  // 添加历史记录
  addHistory: (word: string, result: QueryResponse, historyLimit: number) => Promise<void>
  // 删除单条历史
  removeHistory: (id: string) => Promise<void>
  // 清空历史
  clearHistory: () => Promise<void>
  // 检查是否存在
  exists: (word: string) => boolean
  // 根据ID获取历史记录
  getById: (id: string) => HistoryItem | undefined
}

// 判断查询结果类型
function isSentenceResult(result: QueryResponse): result is { type: 'sentence'; original: string; translation: string } {
  return typeof result === 'object' && 'type' in result && result.type === 'sentence'
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  isLoading: false,

  // 加载历史
  loadHistory: async () => {
    set({ isLoading: true })
    try {
      const data = await indexedDBService.getAllHistory()
      set({ history: data, isLoading: false })
    } catch (error) {
      console.error('Failed to load history:', error)
      set({ isLoading: false })
      setTimeout(() => {
        useAppStore.getState().showToast('加载历史记录失败', 'error')
      }, 0)
    }
  },

  // 保存历史
  saveHistory: async (history) => {
    try {
      await indexedDBService.saveHistory(history)
      set({ history })
    } catch (error) {
      console.error('Failed to save history:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('保存历史记录失败', 'error')
      }, 0)
    }
  },

  // 添加历史记录
  addHistory: async (word, result, historyLimit) => {
    const { history } = get()
    
    // 如果已存在相同单词，先删除旧的
    const filteredHistory = history.filter(h => h.word.toLowerCase() !== word.toLowerCase())
    
    // 确定查询类型
    const type = isSentenceResult(result) ? 'sentence' : 'word'
    
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      word,
      type,
      result,
      timestamp: Date.now(),
    }

    // 新记录添加到开头，并限制数量
    const newHistory = [newItem, ...filteredHistory].slice(0, historyLimit)
    await get().saveHistory(newHistory)
  },

  // 删除单条历史
  removeHistory: async (id) => {
    const { history } = get()
    const newHistory = history.filter(h => h.id !== id)
    await get().saveHistory(newHistory)
    setTimeout(() => {
      useAppStore.getState().showToast('已删除历史记录', 'info')
    }, 0)
  },

  // 清空历史
  clearHistory: async () => {
    await get().saveHistory([])
    setTimeout(() => {
      useAppStore.getState().showToast('已清空所有历史记录', 'success')
    }, 0)
  },

  // 检查是否存在
  exists: (word) => {
    const { history } = get()
    return history.some(h => h.word.toLowerCase() === word.toLowerCase())
  },

  // 根据ID获取历史记录
  getById: (id) => {
    const { history } = get()
    return history.find(h => h.id === id)
  },
}))
