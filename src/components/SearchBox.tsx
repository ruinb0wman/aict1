import { useState, useEffect, useCallback, KeyboardEvent, FormEvent } from 'react'
import { Search, Loader2, Database } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useWordsStore } from '@/stores/wordsStore'
import { queryLLM, isSentence, isChinese } from '@/utils/api'
import { IndexedDBService } from '@/utils/indexedDB'

export function SearchBox() {
  const [input, setInput] = useState('')
  const [isFromCache, setIsFromCache] = useState(false)
  const { isLoading, setLoading, setQueryResult, setError, setLastQuery, lastQuery, showToast, clipboardText, setClipboardText } = useAppStore()
  const settings = useSettingsStore()
  const { addHistory } = useHistoryStore()
  const { saveWordToCache, getWordFromCache } = useWordsStore()

  // 执行查询的通用函数
  const performSearch = useCallback(async (queryText: string) => {
    if (!queryText || isLoading) return

    // 防重复查询
    if (queryText === lastQuery) return

    setLoading(true)
    setError(null)
    setIsFromCache(false)

    try {
      // 首先检查是否是句子（句子不使用缓存）
      const isSentenceQuery = isSentence(queryText)
      
      if (!isSentenceQuery && !isChinese(queryText)) {
        // 尝试从本地缓存获取（仅英文单词）
        const cachedWord = await getWordFromCache(queryText)
        if (cachedWord) {
          // 使用缓存数据
          const result = IndexedDBService.toQueryResult(cachedWord)
          setQueryResult(result)
          setIsFromCache(true)
          // 更新查询次数
          await saveWordToCache(queryText, result)
          // 保存到历史记录
          await addHistory(queryText, result, settings.historyLimit)
          showToast('已从本地缓存加载', 'success', 2000)
          setLoading(false)
          return
        }
      }

      // 检查是否已配置 API Key
      if (!settings.apiKey) {
        showToast('请先设置 API Key', 'warning')
        setError('请先设置 API Key')
        setLoading(false)
        return
      }

      // 从 API 查询
      const result = await queryLLM(queryText, settings)
      setQueryResult(result)
      
      // 如果是单词，保存到本地缓存（中译英结果不缓存）
      if (!isSentenceQuery && !isChinese(queryText)) {
        await saveWordToCache(queryText, result as { word: string; phonetic?: string; translation: Record<string, string[]>; example: { en: string; zh: string }[] })
      }
      
      // 保存到历史记录
      await addHistory(queryText, result, settings.historyLimit)
      // 查询成功后才记录 lastQuery，失败时可以重试
      setLastQuery(queryText)
      showToast('查询成功', 'success', 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查询失败'
      setError(errorMessage)
      setQueryResult(null)
      showToast(errorMessage, 'error', 5000)
    } finally {
      setLoading(false)
    }
  }, [isLoading, lastQuery, settings, setLoading, setError, setLastQuery, setQueryResult, addHistory, showToast, saveWordToCache, getWordFromCache])

  const handleSearch = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput) return
    await performSearch(trimmedInput)
  }

  // 初始化 wordsStore
  useEffect(() => {
    useWordsStore.getState().init()
  }, [])

  // 监听剪切板翻译事件
  useEffect(() => {
    if (clipboardText) {
      setInput(clipboardText)
      setClipboardText('')
      performSearch(clipboardText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboardText])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSearch()
  }

  return (
    <form onSubmit={handleSubmit} className="search-box">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} strokeWidth={1.5} />
        <input
          type="text"
          className="search-input"
          placeholder="输入单词或句子..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        {isLoading ? (
          <Loader2 className="search-loading" size={18} strokeWidth={1.5} />
        ) : isFromCache ? (
          <span title="来自本地缓存"><Database className="search-cache-indicator" size={18} strokeWidth={1.5} /></span>
        ) : null}
      </div>
    </form>
  )
}
