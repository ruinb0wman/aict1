import type { HistoryItem, QueryResponse } from '@/types'

// 判断查询结果类型（句子翻译 vs 单词查询）
export function isSentenceResult(result: QueryResponse): boolean {
  return typeof result === 'object' && 'type' in result && result.type === 'sentence'
}

/**
 * 插入一条历史记录：同词（不区分大小写）的旧记录被顶掉，新记录在最前，超出上限截断。
 * 纯函数，迁移到 Vue 时行为必须一字不变。
 */
export function insertHistory(
  history: HistoryItem[],
  item: HistoryItem,
  limit: number
): HistoryItem[] {
  const rest = history.filter(h => h.word.toLowerCase() !== item.word.toLowerCase())
  return [item, ...rest].slice(0, limit)
}
