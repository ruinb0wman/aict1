<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { RConfirmHost, RErrorBoundary } from '@ruinb0w/ui'
import TitleBar from '@/components/TitleBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import Toast from '@/components/Toast.vue'
import { useNetworkToast } from '@/composables/useNetworkToast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useAppStore } from '@/stores/appStore'
import { isTauri } from '@/libs/env'
import { openDevTools } from '@/utils/tauri'

const router = useRouter()
const settings = useSettingsStore()
const favorites = useFavoritesStore()
const history = useHistoryStore()
const app = useAppStore()

useNetworkToast()

let unlisten: (() => void) | undefined

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.shiftKey && event.key === 'I') {
    event.preventDefault()
    openDevTools()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  settings.loadSettings().then(() => settings.initClipboardMonitor())
  favorites.loadFavorites()
  history.loadHistory()

  // 剪切板翻译事件：跳到查询页，由 SearchBox 消费 clipboardText（只有 Tauri 客户端才有这个事件）
  if (!isTauri()) return

  try {
    const { listen } = await import('@tauri-apps/api/event')
    unlisten = await listen('clipboard-translate', (event) => {
      const payload = event.payload as { text?: string }
      if (payload.text) {
        router.push('/')
        app.setClipboardText(payload.text)
      }
    })
  } catch (error) {
    console.error('Failed to setup clipboard listener:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  unlisten?.()
})
</script>

<template>
  <RErrorBoundary>
    <div class="app">
      <TitleBar />
      <main class="main-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
      <BottomNav />
    </div>
    <Toast />
    <RConfirmHost />
  </RErrorBoundary>
</template>
