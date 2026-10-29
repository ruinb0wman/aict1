import { describe, it, expect } from 'vitest'
import { nextMasteryLevel, pickReviewWords, MASTERY_MAX } from './review'

describe('nextMasteryLevel', () => {
  it('认识 +1，不认识 -1', () => {
    expect(nextMasteryLevel(2, true)).toBe(3)
    expect(nextMasteryLevel(2, false)).toBe(1)
  })

  it('下界钳在 0', () => {
    expect(nextMasteryLevel(0, false)).toBe(0)
  })

  it('上界钳在 5', () => {
    expect(nextMasteryLevel(MASTERY_MAX, true)).toBe(MASTERY_MAX)
  })
})

describe('pickReviewWords', () => {
  it('掌握程度低的排在前面', () => {
    const words = [{ masteryLevel: 3 }, { masteryLevel: 0 }, { masteryLevel: 1 }]
    expect(pickReviewWords(words).map(w => w.masteryLevel)).toEqual([0, 1, 3])
  })

  it('已毕业（>= 4）的不进队列', () => {
    const words = [{ masteryLevel: 4 }, { masteryLevel: 5 }, { masteryLevel: 2 }]
    expect(pickReviewWords(words)).toEqual([{ masteryLevel: 2 }])
  })

  it('不改动入参数组', () => {
    const words = [{ masteryLevel: 2 }, { masteryLevel: 0 }]
    pickReviewWords(words)
    expect(words.map(w => w.masteryLevel)).toEqual([2, 0])
  })
})
