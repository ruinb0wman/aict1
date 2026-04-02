import { useEffect, useState } from 'react'
import { Search, Star, Trash2, Loader2, Download, Upload } from 'lucide-react'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useAppStore } from '@/stores/appStore'
import type { FavoriteWord } from '@/types'

export function Favorites() {
  const {
    isLoading,
    searchQuery,
    loadFavorites,
    removeFavorite,
    setSearchQuery,
    getFilteredFavorites,
    exportFavorites,
    importFavorites,
    favorites
  } = useFavoritesStore()
  const { setQueryResult, setCurrentPage, setLastQuery } = useAppStore()
  const [removingId, setRemovingId] = useState<string | null>(null)

  // 加载收藏数据
  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // 处理取消收藏
  const handleRemove = async (id: string) => {
    setRemovingId(id)
    await removeFavorite(id)
    setRemovingId(null)
  }

  // 处理点击单词查看详情
  const handleWordClick = (favorite: FavoriteWord) => {
    setQueryResult(favorite.queryData)
    setLastQuery(favorite.word)
    setCurrentPage('search')
  }

  // 过滤后的收藏列表
  const filteredFavorites = getFilteredFavorites()

  // 处理导入
  const handleImport = async () => {
    await importFavorites()
  }

  // 处理导出
  const handleExport = async () => {
    await exportFavorites()
  }

  // 格式化时间
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="favorites-page">
      <div className="favorites-header">
        <h2 className="page-title">收藏</h2>
        <div className="favorites-actions">
          <button
            className="favorites-action-btn"
            onClick={handleImport}
            title="导入收藏"
            disabled={isLoading}
          >
            <Download size={18} strokeWidth={1.5} />
          </button>
          <button
            className="favorites-action-btn"
            onClick={handleExport}
            title="导出收藏"
            disabled={isLoading || favorites.length === 0}
          >
            <Upload size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="search-box">
        <div className="search-input-wrapper">
          <Search size={20} strokeWidth={1.5} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="搜索收藏的单词..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* 收藏列表 */}
      <div className="favorites-list">
        {isLoading ? (
          <div className="favorites-empty">
            <Loader2 size={24} strokeWidth={1.5} className="spin" />
            <p>加载中...</p>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="favorites-empty">
            {searchQuery ? (
              <>
                <p className="empty-title">未找到匹配的单词</p>
                <p className="empty-desc">尝试其他关键词</p>
              </>
            ) : (
              <>
                <Star size={48} strokeWidth={1.5} className="empty-icon" />
                <p className="empty-title">暂无收藏</p>
                <p className="empty-desc">查询单词后点击星形图标收藏</p>
              </>
            )}
          </div>
        ) : (
          filteredFavorites.map((favorite) => (
            <div key={favorite.id} className="favorite-item">
              <div
                className="favorite-content"
                onClick={() => handleWordClick(favorite)}
              >
                <div className="favorite-word">
                  <h3>{favorite.word}</h3>
                  {favorite.phonetic && (
                    <span className="favorite-phonetic">{favorite.phonetic}</span>
                  )}
                </div>
                <p className="favorite-translation">{favorite.translation}</p>
                <span className="favorite-date">{formatDate(favorite.createdAt)}</span>
              </div>
              <button
                className="favorite-remove-btn"
                onClick={() => handleRemove(favorite.id)}
                disabled={removingId === favorite.id}
                title="取消收藏"
              >
                {removingId === favorite.id ? (
                  <Loader2 size={16} strokeWidth={1.5} className="spin" />
                ) : (
                  <Trash2 size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {/* 收藏数量 */}
      {!isLoading && filteredFavorites.length > 0 && (
        <div className="favorites-count">
          共 {filteredFavorites.length} 个收藏
        </div>
      )}
    </div>
  )
}
