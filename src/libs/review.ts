/** 掌握程度：0（未复习）～ 5（已掌握） */
export const MASTERY_MAX = 5
/** 达到该等级就不再进入复习队列 */
export const MASTERY_GRADUATED = 4

/** 认识 +1、不认识 -1，钳制在 0～5 */
export function nextMasteryLevel(current: number, known: boolean): number {
  const next = current + (known ? 1 : -1)
  return Math.max(0, Math.min(MASTERY_MAX, next))
}

/** 复习队列：掌握程度低的优先，已毕业（>= 4）的不排 */
export function pickReviewWords<T extends { masteryLevel: number }>(words: T[]): T[] {
  return [...words]
    .filter(w => w.masteryLevel < MASTERY_GRADUATED)
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
}
