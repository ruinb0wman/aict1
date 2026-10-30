import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FavoriteWord, QueryResult } from '@/types'
import { store } from '@/utils/store'
import { nextMasteryLevel } from '@/libs/review'
import { toPlain } from '@/libs/plain'
import { useAppStore } from '@/stores/appStore'

// 获取主要翻译（用于列表展示）
function getPrimaryTranslation(queryData: QueryResult): string {
  const { translation } = queryData
  // 优先获取名词、动词、形容词的翻译
  const priorityKeys = ['n.', 'v.', 'adj.', 'adv.']
  for (const key of priorityKeys) {
    if (translation[key] && translation[key].length > 0) {
      return translation[key][0]
    }
  }
  // 如果没有优先词性，取第一个
  const firstKey = Object.keys(translation)[0]
  if (firstKey && translation[firstKey].length > 0) {
    return translation[firstKey][0]
  }
  return ''
}

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<FavoriteWord[]>([])
  const isLoading = ref(false)
  const searchQuery = ref('')

  async function loadFavorites() {
    isLoading.value = true
    try {
      favorites.value = await store.getAllFavorites()
    } catch (error) {
      console.error('Failed to load favorites:', error)
      useAppStore().showToast('加载收藏失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  async function addFavorite(word: string, queryData: QueryResult) {
    // 检查是否已存在
    if (favorites.value.some(f => f.word.toLowerCase() === word.toLowerCase())) {
      return
    }

    const newFavorite: FavoriteWord = {
      id: crypto.randomUUID(),
      word: word.toLowerCase(),
      translation: getPrimaryTranslation(queryData),
      phonetic: queryData.phonetic,
      createdAt: Date.now(),
      queryData, // 写库前过 toPlain：queryData 是响应式 Proxy
      reviewCount: 0,
      masteryLevel: 0,
    }

    try {
      await store.addFavorite(toPlain(newFavorite))
      favorites.value = [newFavorite, ...favorites.value]
      useAppStore().showToast(`已收藏 "${word}"`, 'success')
    } catch (error) {
      console.error('Failed to add favorite:', error)
      useAppStore().showToast('添加收藏失败', 'error')
    }
  }

  async function removeFavorite(id: string) {
    const favorite = favorites.value.find(f => f.id === id)

    try {
      await store.removeFavorite(id)
      favorites.value = favorites.value.filter(f => f.id !== id)
      if (favorite) {
        useAppStore().showToast(`已取消收藏 "${favorite.word}"`, 'info')
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error)
      useAppStore().showToast('取消收藏失败', 'error')
    }
  }

  function isFavorite(word: string) {
    return favorites.value.some(f => f.word.toLowerCase() === word.toLowerCase())
  }

  function getFavoriteId(word: string) {
    return favorites.value.find(f => f.word.toLowerCase() === word.toLowerCase())?.id
  }

  async function toggleFavorite(word: string, queryData: QueryResult) {
    if (isFavorite(word)) {
      const id = getFavoriteId(word)
      if (id) {
        await removeFavorite(id)
      }
    } else {
      await addFavorite(word, queryData)
    }
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function getFilteredFavorites() {
    if (!searchQuery.value.trim()) {
      return favorites.value
    }
    const query = searchQuery.value.toLowerCase()
    return favorites.value.filter(f =>
      f.word.toLowerCase().includes(query) ||
      f.translation.toLowerCase().includes(query)
    )
  }

  // 复习队列：掌握程度低的优先
  function getReviewWords() {
    return [...favorites.value].sort((a, b) => a.masteryLevel - b.masteryLevel)
  }

  async function updateReviewStatus(id: string, known: boolean) {
    const favorite = favorites.value.find(f => f.id === id)
    if (!favorite) return

    const updates = {
      reviewCount: favorite.reviewCount + 1,
      lastReviewedAt: Date.now(),
      masteryLevel: nextMasteryLevel(favorite.masteryLevel, known),
    }

    try {
      await store.updateFavorite(id, updates)
      favorites.value = favorites.value.map(f =>
        f.id === id ? { ...f, ...updates } : f
      )
      useAppStore().showToast(known ? '已标记为认识' : '已标记为不认识', 'success', 1500)
    } catch (error) {
      console.error('Failed to update review status:', error)
      useAppStore().showToast('更新复习状态失败', 'error')
    }
  }

  function getTodayReviewProgress() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    return {
      total: favorites.value.length,
      reviewed: favorites.value.filter(f => f.lastReviewedAt && f.lastReviewedAt >= todayTimestamp).length,
    }
  }

  return {
    favorites,
    isLoading,
    searchQuery,
    loadFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoriteId,
    toggleFavorite,
    setSearchQuery,
    getFilteredFavorites,
    getReviewWords,
    updateReviewStatus,
    getTodayReviewProgress,
  }
})
