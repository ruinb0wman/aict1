import { watch } from 'vue'
import { useOnlineStatus } from '@ruinb0w/ui'
import { useAppStore } from '@/stores/appStore'

/** 断网/恢复用 toast 提示（不渲染任何东西） */
export function useNetworkToast() {
  const { isOnline } = useOnlineStatus()
  const app = useAppStore()

  watch(isOnline, (online, wasOnline) => {
    if (!online) {
      app.showToast('网络已断开，请检查网络连接', 'warning', 5000)
    } else if (wasOnline === false) {
      app.showToast('网络已恢复', 'success', 3000)
    }
  })
}
