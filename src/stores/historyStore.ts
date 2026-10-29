import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryItem, QueryResponse } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { insertHistory, isSentenceResult } from '@/libs/history'
import { toPlain } from '@/libs/plain'
import { useAppStore } from '@/stores/appStore'

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryItem[]>([])
  const isLoading = ref(false)

  async function loadHistory() {
    isLoading.value = true
    try {
      history.value = await indexedDBService.getAllHistory()
    } catch (error) {
      console.error('Failed to load history:', error)
      useAppStore().showToast('加载历史记录失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  async function saveHistory(items: HistoryItem[]) {
    try {
      // 过 toPlain：history.value 里的元素是响应式 Proxy，直接进 Dexie 会 DataCloneError
      const plain = toPlain(items)
      await indexedDBService.saveHistory(plain)
      history.value = plain
    } catch (error) {
      console.error('Failed to save history:', error)
      useAppStore().showToast('保存历史记录失败', 'error')
    }
  }

  async function addHistory(word: string, result: QueryResponse, historyLimit: number) {
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      word,
      type: isSentenceResult(result) ? 'sentence' : 'word',
      result: toPlain(result),
      timestamp: Date.now(),
    }
    await saveHistory(insertHistory(history.value, item, historyLimit))
  }

  async function removeHistory(id: string) {
    await saveHistory(history.value.filter(h => h.id !== id))
    useAppStore().showToast('已删除历史记录', 'info')
  }

  async function clearHistory() {
    await saveHistory([])
    useAppStore().showToast('已清空所有历史记录', 'success')
  }

  function exists(word: string) {
    return history.value.some(h => h.word.toLowerCase() === word.toLowerCase())
  }

  function getById(id: string) {
    return history.value.find(h => h.id === id)
  }

  return {
    history,
    isLoading,
    loadHistory,
    saveHistory,
    addHistory,
    removeHistory,
    clearHistory,
    exists,
    getById,
  }
})
