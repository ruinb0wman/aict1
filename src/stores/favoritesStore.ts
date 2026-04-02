import { create } from 'zustand'
import { FavoriteWord, QueryResult } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { useAppStore } from '@/stores/appStore'

interface FavoritesState {
  favorites: FavoriteWord[]
  isLoading: boolean
  searchQuery: string

  // 加载收藏
  loadFavorites: () => Promise<void>
  // 添加收藏
  addFavorite: (word: string, queryData: QueryResult) => Promise<void>
  // 取消收藏
  removeFavorite: (id: string) => Promise<void>
  // 检查是否已收藏
  isFavorite: (word: string) => boolean
  // 获取收藏ID
  getFavoriteId: (word: string) => string | undefined
  // 切换收藏状态
  toggleFavorite: (word: string, queryData: QueryResult) => Promise<void>
  // 设置搜索词
  setSearchQuery: (query: string) => void
  // 获取过滤后的收藏列表
  getFilteredFavorites: () => FavoriteWord[]
  // 复习相关
  // 获取用于复习的单词列表（按掌握程度排序，优先复习掌握程度低的）
  getReviewWords: () => FavoriteWord[]
  // 更新单词复习状态
  updateReviewStatus: (id: string, known: boolean) => Promise<void>
  // 获取今日复习进度
  getTodayReviewProgress: () => { total: number; reviewed: number }
  // 从合并数据中导入收藏
  importFavoritesFromData: (favorites: FavoriteWord[]) => Promise<{ imported: number; skipped: number }>
}

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

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  isLoading: false,
  searchQuery: '',

  // 加载收藏
  loadFavorites: async () => {
    set({ isLoading: true })
    try {
      const data = await indexedDBService.getAllFavorites()
      set({ favorites: data, isLoading: false })
    } catch (error) {
      console.error('Failed to load favorites:', error)
      set({ isLoading: false })
      // 使用 setTimeout 避免 Zustand 的无限循环警告
      setTimeout(() => {
        useAppStore.getState().showToast('加载收藏失败', 'error')
      }, 0)
    }
  },

  // 添加收藏
  addFavorite: async (word, queryData) => {
    const { favorites } = get()

    // 检查是否已存在
    if (favorites.some(f => f.word.toLowerCase() === word.toLowerCase())) {
      return
    }

    const newFavorite: FavoriteWord = {
      id: crypto.randomUUID(),
      word: word.toLowerCase(),
      translation: getPrimaryTranslation(queryData),
      phonetic: queryData.phonetic,
      createdAt: Date.now(),
      queryData,
      reviewCount: 0,
      masteryLevel: 0,
    }

    try {
      await indexedDBService.addFavorite(newFavorite)
      set({ favorites: [newFavorite, ...favorites] })
      setTimeout(() => {
        useAppStore.getState().showToast(`已收藏 "${word}"`, 'success')
      }, 0)
    } catch (error) {
      console.error('Failed to add favorite:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('添加收藏失败', 'error')
      }, 0)
    }
  },

  // 取消收藏
  removeFavorite: async (id) => {
    const { favorites } = get()
    const favorite = favorites.find(f => f.id === id)

    try {
      await indexedDBService.removeFavorite(id)
      set({ favorites: favorites.filter(f => f.id !== id) })
      if (favorite) {
        setTimeout(() => {
          useAppStore.getState().showToast(`已取消收藏 "${favorite.word}"`, 'info')
        }, 0)
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('取消收藏失败', 'error')
      }, 0)
    }
  },

  // 检查是否已收藏
  isFavorite: (word) => {
    const { favorites } = get()
    return favorites.some(f => f.word.toLowerCase() === word.toLowerCase())
  },

  // 获取收藏ID
  getFavoriteId: (word) => {
    const { favorites } = get()
    const favorite = favorites.find(f => f.word.toLowerCase() === word.toLowerCase())
    return favorite?.id
  },

  // 切换收藏状态
  toggleFavorite: async (word, queryData) => {
    const { isFavorite, getFavoriteId, addFavorite, removeFavorite } = get()
    if (isFavorite(word)) {
      const id = getFavoriteId(word)
      if (id) {
        await removeFavorite(id)
      }
    } else {
      await addFavorite(word, queryData)
    }
  },

  // 设置搜索词
  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  // 获取过滤后的收藏列表
  getFilteredFavorites: () => {
    const { favorites, searchQuery } = get()
    if (!searchQuery.trim()) {
      return favorites
    }
    const query = searchQuery.toLowerCase()
    return favorites.filter(f =>
      f.word.toLowerCase().includes(query) ||
      f.translation.toLowerCase().includes(query)
    )
  },

  // 获取用于复习的单词列表（按掌握程度排序）
  getReviewWords: () => {
    const { favorites } = get()
    // 按掌握程度排序，掌握程度低的优先
    return [...favorites].sort((a, b) => a.masteryLevel - b.masteryLevel)
  },

  // 更新单词复习状态
  updateReviewStatus: async (id, known) => {
    const { favorites } = get()
    const favorite = favorites.find(f => f.id === id)
    if (!favorite) return

    const newReviewCount = favorite.reviewCount + 1
    // 更新掌握程度：认识 +1，不认识 -1（最低为0）
    let newMasteryLevel = favorite.masteryLevel + (known ? 1 : -1)
    newMasteryLevel = Math.max(0, Math.min(5, newMasteryLevel))

    const updates = {
      reviewCount: newReviewCount,
      lastReviewedAt: Date.now(),
      masteryLevel: newMasteryLevel,
    }

    try {
      await indexedDBService.updateFavorite(id, updates)
      set({
        favorites: favorites.map(f =>
          f.id === id ? { ...f, ...updates } : f
        )
      })
      setTimeout(() => {
        useAppStore.getState().showToast(known ? '已标记为认识' : '已标记为不认识', 'success', 1500)
      }, 0)
    } catch (error) {
      console.error('Failed to update review status:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('更新复习状态失败', 'error')
      }, 0)
    }
  },

  // 获取今日复习进度
  getTodayReviewProgress: () => {
    const { favorites } = get()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    const reviewed = favorites.filter(f =>
      f.lastReviewedAt && f.lastReviewedAt >= todayTimestamp
    ).length

    return {
      total: favorites.length,
      reviewed,
    }
  },

  // 从合并数据中导入收藏
  importFavoritesFromData: async (favoritesToImport) => {
    if (!favoritesToImport || favoritesToImport.length === 0) {
      return { imported: 0, skipped: 0 }
    }

    const { favorites: currentFavorites } = get()
    const existingWords = new Set(currentFavorites.map(f => f.word.toLowerCase()))

    let imported = 0
    let skipped = 0

    for (const favorite of favoritesToImport) {
      // 检查是否已存在
      if (existingWords.has(favorite.word.toLowerCase())) {
        skipped++
        continue
      }

      try {
        // 添加新收藏，重新生成 ID 避免冲突
        const newFavorite: FavoriteWord = {
          ...favorite,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        await indexedDBService.addFavorite(newFavorite)
        imported++
      } catch (error) {
        console.error(`Failed to import favorite "${favorite.word}":`, error)
        skipped++
      }
    }

    // 重新加载收藏列表
    await get().loadFavorites()

    setTimeout(() => {
      if (imported > 0) {
        useAppStore.getState().showToast(`成功导入 ${imported} 个收藏${skipped > 0 ? `，跳过 ${skipped} 个重复` : ''}`, 'success')
      } else if (skipped > 0) {
        useAppStore.getState().showToast(`没有新收藏可导入（${skipped} 个重复）`, 'warning')
      }
    }, 0)

    return { imported, skipped }
  },
}))
