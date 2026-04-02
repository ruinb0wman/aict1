import { Search, Star, History, BookOpen, Settings, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import type { PageType } from '@/types'

const navItems: { id: PageType; icon: typeof Search; label: string }[] = [
  { id: 'search', icon: Search, label: '查询' },
  { id: 'grammar', icon: CheckCircle, label: '语法' },
  { id: 'favorites', icon: Star, label: '收藏' },
  { id: 'review', icon: BookOpen, label: '复习' },
  { id: 'history', icon: History, label: '历史' },
  { id: 'settings', icon: Settings, label: '设置' },
]

export function BottomNav() {
  const { currentPage, setCurrentPage } = useAppStore()

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = currentPage === item.id

        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
