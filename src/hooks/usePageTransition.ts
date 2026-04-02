import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { PageType } from '@/types'

export function usePageTransition() {
  const { currentPage } = useAppStore()
  const [displayPage, setDisplayPage] = useState<PageType>(currentPage)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (currentPage !== displayPage) {
      // 开始过渡动画
      setIsTransitioning(true)
      setTransitionDirection('out')

      // 等待退出动画完成
      const timeout = setTimeout(() => {
        setDisplayPage(currentPage)
        setTransitionDirection('in')

        // 等待进入动画完成
        const enterTimeout = setTimeout(() => {
          setIsTransitioning(false)
        }, 200)

        return () => clearTimeout(enterTimeout)
      }, 200)

      return () => clearTimeout(timeout)
    }
  }, [currentPage, displayPage])

  return {
    displayPage,
    isTransitioning,
    transitionDirection,
    animationClass: isTransitioning
      ? transitionDirection === 'out'
        ? 'page-exit'
        : 'page-enter'
      : 'page-active',
  }
}
