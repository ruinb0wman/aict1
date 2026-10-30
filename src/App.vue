<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { RConfirmHost, RErrorBoundary } from '@ruinb0w/ui'
import TitleBar from '@/components/TitleBar.vue'
import BottomNav from '@/components/BottomNav.vue'
import Toast from '@/components/Toast.vue'
import { useNetworkToast } from '@/composables/useNetworkToast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'

const settings = useSettingsStore()
const favorites = useFavoritesStore()
const history = useHistoryStore()

useNetworkToast()

onMounted(async () => {
  // 第一条真实请求就是探活：服务没起时只弹一次错，不连发三条「加载失败」
  if (!(await settings.loadSettings())) return
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
