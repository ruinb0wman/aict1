import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryItem, QueryResponse } from '@/types'
import { store } from '@/utils/store'
import { isSentenceResult } from '@/libs/history'
import { toPlain } from '@/libs/plain'
import { useAppStore } from '@/stores/appStore'

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryItem[]>([])
  const isLoading = ref(false)

  async function loadHistory() {
    isLoading.value = true
    try {
      history.value = await store.getAllHistory()
    } catch (error) {
      console.error('Failed to load history:', error)
      useAppStore().showToast('加载历史记录失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  // 去重 + 按 historyLimit 截断在服务端做，返回的就是截断后的完整列表
  async function addHistory(word: string, result: QueryResponse) {
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      word,
      type: isSentenceResult(result) ? 'sentence' : 'word',
      result: toPlain(result),
      timestamp: Date.now(),
    }

    try {
      history.value = await store.appendHistory(item)
    } catch (error) {
      console.error('Failed to add history:', error)
      useAppStore().showToast('保存历史记录失败', 'error')
    }
  }

  async function removeHistory(id: string) {
    try {
      history.value = await store.removeHistory(id)
      useAppStore().showToast('已删除历史记录', 'info')
    } catch (error) {
      console.error('Failed to remove history:', error)
      useAppStore().showToast('删除历史记录失败', 'error')
    }
  }

  async function clearHistory() {
    try {
      await store.clearHistory()
      history.value = []
      useAppStore().showToast('已清空所有历史记录', 'success')
    } catch (error) {
      console.error('Failed to clear history:', error)
      useAppStore().showToast('清空历史记录失败', 'error')
    }
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
    addHistory,
    removeHistory,
    clearHistory,
    exists,
    getById,
  }
})
