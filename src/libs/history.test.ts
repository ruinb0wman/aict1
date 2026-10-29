import { describe, it, expect } from 'vitest'
import { insertHistory, isSentenceResult } from './history'
import type { HistoryItem, QueryResponse } from '@/types'

const item = (word: string, timestamp = 0): HistoryItem => ({
  id: `id-${word}`,
  word,
  type: 'word',
  result: { word, translation: {}, example: [] } as QueryResponse,
  timestamp,
})

describe('insertHistory', () => {
  it('新记录排在最前', () => {
    const result = insertHistory([item('a', 1)], item('b', 2), 10)
    expect(result.map(h => h.word)).toEqual(['b', 'a'])
  })

  it('同词不分大小写顶掉旧记录', () => {
    const result = insertHistory([item('Run', 1), item('go', 2)], item('run', 3), 10)
    expect(result.map(h => h.word)).toEqual(['run', 'go'])
  })

  it('超出上限时截断尾部', () => {
    const result = insertHistory([item('a'), item('b'), item('c')], item('d'), 2)
    expect(result.map(h => h.word)).toEqual(['d', 'a'])
  })

  it('不改动入参数组', () => {
    const history = [item('a')]
    insertHistory(history, item('b'), 10)
    expect(history).toHaveLength(1)
  })
})

describe('isSentenceResult', () => {
  it('识别句子结果', () => {
    expect(isSentenceResult({ type: 'sentence', original: 'hi', translation: '你好' })).toBe(true)
  })

  it('单词结果不是句子', () => {
    expect(isSentenceResult({ word: 'hi', translation: {}, example: [] })).toBe(false)
  })
})
