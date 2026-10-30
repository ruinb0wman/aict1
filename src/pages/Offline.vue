<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleAlert } from '@lucide/vue'
import { RButton, RInput } from '@ruinb0w/ui'
import { getBase, normalizeBase, probeServer, setBase } from '@/utils/store'
import { markOnline, serverReason } from '@/libs/serverState'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/settingsStore'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const settings = useSettingsStore()

const current = ref(getBase())
const input = ref(getBase())
const checking = ref(false)
const backTo = typeof route.query.from === 'string' ? route.query.from : '/'

async function tryBase(candidate: string, save: boolean): Promise<boolean> {
  checking.value = true
  try {
    if (!(await probeServer(candidate))) return false

    if (save) {
      setBase(candidate)
      current.value = normalizeBase(candidate)
    }
    markOnline()
    await settings.serverChanged()
    router.replace(backTo)
    return true
  } finally {
    checking.value = false
  }
}

async function retry() {
  if (await tryBase(input.value, true)) return
  app.showToast('还是连不上，检查地址或 tailscale 状态', 'error', 4000)
}

// 自动重试：地址没被改动时才自动探活，避免和用户输入打架
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => {
    if (checking.value || input.value.trim() !== current.value) return
    void tryBase(current.value, false)
  }, 5000)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="offline-page">
    <CircleAlert class="offline-icon" :size="40" :stroke-width="1.2" />
    <h2 class="offline-title">连不上服务器</h2>

    <div class="offline-detail">
      <code class="offline-base">{{ current || '同源（相对路径）' }}</code>
      <p class="offline-reason">{{ serverReason || '连接被拒绝或超时' }}</p>
    </div>

    <div class="offline-form">
      <label class="offline-label">服务器地址</label>
      <RInput v-model="input" placeholder="http://192.168.1.2:8471" />
      <p class="offline-hint">不用写 http://，会自动补上；换网络或 tailscale 地址变了都在这里改</p>
      <RButton type="primary" block :loading="checking" @click="retry">重试</RButton>
    </div>

    <p class="offline-hint">每 5 秒自动重试，通了会自动回到原页面</p>
  </div>
</template>
