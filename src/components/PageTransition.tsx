import { ReactNode } from 'react'
import { usePageTransition } from '@/hooks/usePageTransition'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const { animationClass } = usePageTransition()

  return (
    <div className={`page-transition-wrapper ${animationClass}`}>
      {children}
    </div>
  )
}
