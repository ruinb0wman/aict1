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
import { useAppStore } from '@/stores/appStore'
import { usePageTransition } from '@/hooks/usePageTransition'
import { openDevTools } from '@/utils/tauri'
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
  const { loadSettings, initClipboardMonitor } = useSettingsStore()
  const { loadFavorites } = useFavoritesStore()
  const { loadHistory } = useHistoryStore()
  const { setCurrentPage, setClipboardText } = useAppStore()

  // 应用启动时加载设置、收藏和历史
  useEffect(() => {
    loadSettings().then(() => {
      initClipboardMonitor()
    })
    loadFavorites()
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听剪切板翻译事件
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        unlisten = await listen('clipboard-translate', (event) => {
          const payload = event.payload as { text?: string }
          if (payload.text) {
            setCurrentPage('search')
            setClipboardText(payload.text)
          }
        })
      } catch (error) {
        console.error('Failed to setup clipboard listener:', error)
      }
    }

    setupListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [setCurrentPage, setClipboardText])

  // Ctrl+Shift+I 打开 DevTools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+I 打开开发者工具
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        openDevTools()
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