<script setup lang="ts">
import { watch } from 'vue'
import { AlertCircle, CheckCircle, Info, X, XCircle } from '@lucide/vue'
import { useAppStore } from '@/stores/appStore'

const app = useAppStore()

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => app.toast,
  (toast) => {
    clearTimeout(timer)
    if (!toast) return
    timer = setTimeout(app.hideToast, toast.duration || 3000)
  }
)
</script>

<template>
  <div v-if="app.toast" class="toast-container" :class="{ visible: app.toast.visible }">
    <div class="toast" :class="`toast-${app.toast.type}`">
      <component :is="iconMap[app.toast.type]" :size="18" :stroke-width="1.5" />
      <span class="toast-message">{{ app.toast.message }}</span>
      <button class="toast-close" @click="app.hideToast">
        <X :size="14" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
