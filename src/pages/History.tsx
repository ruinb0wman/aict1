import { useEffect, useState } from 'react'
import { Trash2, Loader2, Clock, X } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { useAppStore } from '@/stores/appStore'
import type { HistoryItem } from '@/types'

export function History() {
  const { 
    history, 
    isLoading, 
    loadHistory, 
    removeHistory, 
    clearHistory 
  } = useHistoryStore()
  const { setQueryResult, setCurrentPage, setLastQuery } = useAppStore()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  // 加载历史数据
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 处理删除单条历史
  const handleRemove = async (id: string) => {
    setRemovingId(id)
    await removeHistory(id)
    setRemovingId(null)
  }

  // 处理清空历史
  const handleClear = async () => {
    if (!confirm('确定要清空所有历史记录吗？')) {
      return
    }
    setIsClearing(true)
    await clearHistory()
    setIsClearing(false)
  }

  // 处理点击历史记录
  const handleItemClick = (item: HistoryItem) => {
    setQueryResult(item.result)
    setLastQuery(item.word)
    setCurrentPage('search')
  }

  // 格式化时间
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  }

  // 获取主要翻译（用于列表展示）
  const getPrimaryTranslation = (item: HistoryItem): string => {
    if (item.type === 'sentence') {
      return item.result && 'translation' in item.result 
        ? (item.result.translation as string).slice(0, 50) + '...'
        : ''
    }
    // 单词类型
    const result = item.result
    if ('translation' in result && result.translation) {
      const translations = Object.values(result.translation)
      if (translations.length > 0 && translations[0].length > 0) {
        return translations[0][0]
      }
    }
    return ''
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h2 className="page-title">历史</h2>
        {history.length > 0 && (
          <button
            className="clear-all-btn"
            onClick={handleClear}
            disabled={isClearing}
          >
            {isClearing ? (
              <Loader2 size={14} strokeWidth={1.5} className="spin" />
            ) : (
              <Trash2 size={14} strokeWidth={1.5} />
            )}
            清空
          </button>
        )}
      </div>

      {/* 历史列表 */}
      <div className="history-list">
        {isLoading ? (
          <div className="history-empty">
            <Loader2 size={24} strokeWidth={1.5} className="spin" />
            <p>加载中...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <Clock size={48} strokeWidth={1.5} className="empty-icon" />
            <p className="empty-title">暂无历史记录</p>
            <p className="empty-desc">查询的单词和句子会显示在这里</p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="history-item">
              <div 
                className="history-content"
                onClick={() => handleItemClick(item)}
              >
                <div className="history-word">
                  <h3>{item.word}</h3>
                  <span className={`history-type ${item.type}`}>
                    {item.type === 'word' ? '单词' : '句子'}
                  </span>
                </div>
                <p className="history-translation">{getPrimaryTranslation(item)}</p>
                <span className="history-date">{formatDate(item.timestamp)}</span>
              </div>
              <button
                className="history-remove-btn"
                onClick={() => handleRemove(item.id)}
                disabled={removingId === item.id}
                title="删除"
              >
                {removingId === item.id ? (
                  <Loader2 size={16} strokeWidth={1.5} className="spin" />
                ) : (
                  <X size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {/* 历史数量 */}
      {!isLoading && history.length > 0 && (
        <div className="history-count">
          共 {history.length} 条记录
        </div>
      )}
    </div>
  )
}
