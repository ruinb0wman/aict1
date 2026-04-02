import { useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAppStore } from '@/stores/appStore'

export function NetworkStatus() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const { showToast } = useAppStore()

  useEffect(() => {
    if (!isOnline) {
      showToast('网络已断开，请检查网络连接', 'warning', 5000)
    } else if (wasOffline) {
      showToast('网络已恢复', 'success', 3000)
    }
  }, [isOnline, wasOffline, showToast])

  // 这是一个不可见的组件，只在状态变化时显示提示
  return null
}

// 网络状态指示器组件（可选，用于在 UI 中显示当前网络状态）
export function NetworkIndicator() {
  const { isOnline } = useNetworkStatus()

  return (
    <div className={`network-indicator ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span>{isOnline ? '已连接' : '离线'}</span>
    </div>
  )
}
