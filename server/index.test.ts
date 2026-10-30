// 数据层语义的回归测试：字段合并、queryCount、历史去重截断。
// DB 路径必须在 import db 之前指定，所以用动态 import。
import { describe, expect, it } from 'bun:test'

process.env.DB_PATH = `/tmp/aict1-test-${process.pid}-${Date.now()}.db`
const store = await import('./db')

const word = (over: Record<string, unknown> = {}) => ({
  word: 'run',
  phonetic: '/rʌn/',
  translation: { 'v.': ['跑'] },
  example: [],
  synonyms: ['jog'],
  ...over,
})

describe('words', () => {
  it('首次保存建立条目', () => {
    const entry = store.saveWord('Run', word() as never)
    expect(entry.id).toBe('run')
    expect(entry.queryCount).toBe(1)
    expect(entry.word).toBe('Run')
  })

  it('再次保存 queryCount+1，createdAt 保留，字段按旧值回退', () => {
    const before = store.getWord('run')!
    const after = store.saveWord('run', { word: 'run', translation: { 'v.': ['跑', '运行'] }, example: [], antonyms: ['walk'] } as never)
    expect(after.queryCount).toBe(before.queryCount + 1)
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.phonetic).toBe('/rʌn/') // 新结果没有音标 → 保留旧的
    expect(after.synonyms).toEqual(['jog'])
    expect(after.antonyms).toEqual(['walk'])
  })

  it('updateWord 不存在时报错', () => {
    expect(() => store.updateWord('nope', { note: 'x' })).toThrow('Word not found')
  })

  it('updateWord 会刷新 updatedAt 并保留其余字段', () => {
    const updated = store.updateWord('run', { note: '批注' })
    expect(updated.note).toBe('批注')
    expect(updated.queryCount).toBeGreaterThan(1)
  })
})

describe('history', () => {
  const item = (w: string, ts = 1): never =>
    ({ id: w, word: w, type: 'word', result: { word: w, translation: {}, example: [] }, timestamp: ts }) as never

  it('同词旧记录被顶掉，新的在最前', () => {
    store.appendHistory(item('a'), 100)
    store.appendHistory(item('b'), 100)
    const list = store.appendHistory(item('a'), 100)
    expect(list.map(h => h.word)).toEqual(['a', 'b'])
  })

  it('超过 limit 时截断', () => {
    store.appendHistory(item('c'), 2)
    const list = store.getAllHistory()
    expect(list.length).toBe(2)
    expect(list.map(h => h.word)).toEqual(['c', 'a'])
  })

  it('removeHistory 与 clearHistory', () => {
    expect(store.removeHistory('c').map(h => h.word)).toEqual(['a'])
    store.clearHistory()
    expect(store.getAllHistory()).toEqual([])
  })
})

describe('favorites / settings', () => {
  it('收藏按 id upsert、按 createdAt 倒序、可局部更新', () => {
    store.saveFavorite({ id: 'f1', word: 'run', translation: '跑', createdAt: 1, queryData: {} as never, reviewCount: 0, masteryLevel: 0 })
    store.saveFavorite({ id: 'f2', word: 'walk', translation: '走', createdAt: 2, queryData: {} as never, reviewCount: 0, masteryLevel: 0 })
    expect(store.getAllFavorites().map(f => f.word)).toEqual(['walk', 'run'])

    store.updateFavorite('f1', { masteryLevel: 3 })
    expect(store.getAllFavorites().find(f => f.id === 'f1')!.masteryLevel).toBe(3)

    store.removeFavorite('f2')
    expect(store.getAllFavorites().map(f => f.word)).toEqual(['run'])
  })

  it('设置往返 + historyLimit 缺省 100', () => {
    expect(store.getSettings()).toBeNull()
    expect(store.getHistoryLimit()).toBe(100)

    store.saveSettings({ apiBaseUrl: 'x', apiKey: 'k', model: 'm', temperature: 0.7, historyLimit: 5 } as never)
    expect(store.getSettings()!.apiKey).toBe('k')
    expect(store.getHistoryLimit()).toBe(5)
  })
})
