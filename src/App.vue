<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { RConfirmHost, RErrorBoundary } from '@ruinb0w/ui'
import TitleBar from '@/components/TitleBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import Toast from '@/components/Toast.vue'
import { useNetworkToast } from '@/composables/useNetworkToast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'
import { probeServer } from '@/utils/store'
import { markUnreachable } from '@/libs/serverState'

const settings = useSettingsStore()
const favorites = useFavoritesStore()
const history = useHistoryStore()
const router = useRouter()

useNetworkToast()

onMounted(async () => {
  // 先确认服务器在，连不上就直接交给错误页，不要连发三次「加载失败」
  if (!(await probeServer())) {
    markUnreachable('启动探活失败：连接被拒绝或超时')
    router.replace({ name: 'offline', query: { from: '/' } })
    return
  }

  settings.loadSettings()
  favorites.loadFavorites()
  history.loadHistory()
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
