import { useEffect, Suspense, lazy } from 'react'
import { TitleBar } from '@/components/TitleBar'
import { SearchBox } from '@/components/SearchBox'
import { QueryResultView } from '@/components/QueryResult'
import { BottomNav } from '@/components/BottomNav'
import { Toast } from '@/components/Toast'
import { NetworkStatus } from '@/components/NetworkStatus'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'
import { usePageTransition } from '@/hooks/usePageTransition'
import { hideWindow } from '@/utils/tauri'
import './index.css'

// 懒加载页面组件
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Favorites = lazy(() => import('@/pages/Favorites').then(m => ({ default: m.Favorites })))
const History = lazy(() => import('@/pages/History').then(m => ({ default: m.History })))
const Review = lazy(() => import('@/pages/Review').then(m => ({ default: m.Review })))
const GrammarCheck = lazy(() => import('@/pages/GrammarCheck').then(m => ({ default: m.GrammarCheck })))

// 页面加载占位符
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="loading-spinner" />
      <p className="loading-text">加载中...</p>
    </div>
  )
}

function SearchPage() {
  return (
    <div className="search-page">
      <SearchBox />
      <div className="result-container">
        <QueryResultView />
      </div>
    </div>
  )
}

function AppContent() {
  const { displayPage, animationClass } = usePageTransition()
  const { loadSettings } = useSettingsStore()
  const { loadFavorites } = useFavoritesStore()
  const { loadHistory } = useHistoryStore()

  // 应用启动时加载设置、收藏和历史
  useEffect(() => {
    loadSettings()
    loadFavorites()
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc 键隐藏窗口
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideWindow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 根据当前页面渲染不同内容
  const renderPage = () => {
    switch (displayPage) {
      case 'search':
        return <SearchPage />
      case 'grammar':
        return (
          <Suspense fallback={<PageLoader />}>
            <GrammarCheck />
          </Suspense>
        )
      case 'favorites':
        return (
          <Suspense fallback={<PageLoader />}>
            <Favorites />
          </Suspense>
        )
      case 'review':
        return (
          <Suspense fallback={<PageLoader />}>
            <Review />
          </Suspense>
        )
      case 'history':
        return (
          <Suspense fallback={<PageLoader />}>
            <History />
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <Settings />
          </Suspense>
        )
      default:
        return <SearchPage />
    }
  }

  return (
    <div className="app">
      <TitleBar />
      <main className={`main-content ${animationClass}`}>
        {renderPage()}
      </main>
      <BottomNav />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <Toast />
      <NetworkStatus />
    </ErrorBoundary>
  )
}

export default App