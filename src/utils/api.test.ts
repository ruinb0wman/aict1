import { describe, it, expect } from 'vitest'
import { isSentence, isChinese } from './api'

describe('isSentence', () => {
  it('含空格视为句子', () => {
    expect(isSentence('how are you')).toBe(true)
  })

  it('单词不是句子', () => {
    expect(isSentence('run')).toBe(false)
  })

  it('首尾空格不算句子', () => {
    expect(isSentence('  run  ')).toBe(false)
  })
})

describe('isChinese', () => {
  it('含汉字判为中文', () => {
    expect(isChinese('你好')).toBe(true)
    expect(isChinese('hello 世界')).toBe(true)
  })

  it('纯英文/符号不是中文', () => {
    expect(isChinese('hello')).toBe(false)
    expect(isChinese('a-b_c')).toBe(false)
  })
})
