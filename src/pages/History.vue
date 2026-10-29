<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Clock, Trash2, X } from '@lucide/vue'
import { RButton, REmptyState, RLoadingState, useConfirm } from '@ruinb0w/ui'
import { useHistoryStore } from '@/stores/historyStore'
import { useAppStore } from '@/stores/appStore'
import type { HistoryItem } from '@/types'

const router = useRouter()
const history = useHistoryStore()
const app = useAppStore()
const confirm = useConfirm()

const removingId = ref<string | null>(null)
const isClearing = ref(false)

onMounted(() => history.loadHistory())

async function remove(id: string) {
  removingId.value = id
  await history.removeHistory(id)
  removingId.value = null
}

// 不用 window.confirm：Android WebView 没实现 onJsConfirm，真机上按钮会是死的
async function clear() {
  const ok = await confirm({
    title: '清空历史',
    message: '确定要清空所有历史记录吗？',
    confirmLabel: '清空',
    cancelLabel: '取消',
    variant: 'danger',
  })
  if (!ok) return
  isClearing.value = true
  await history.clearHistory()
  isClearing.value = false
}

function open(item: HistoryItem) {
  app.setQueryResult(item.result)
  app.setLastQuery(item.word)
  router.push('/')
}

function formatDate(timestamp: number) {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function primaryTranslation(item: HistoryItem) {
  const result = item.result
  if (!('translation' in result) || !result.translation) return ''
  if (item.type === 'sentence') return `${String(result.translation).slice(0, 50)}...`

  const translations = Object.values(result.translation)
  return translations.length > 0 && translations[0].length > 0 ? translations[0][0] : ''
}
</script>

<template>
  <div class="history-page">
    <div class="history-header">
      <h2 class="page-title">历史</h2>
      <RButton
        v-if="history.history.length > 0"
        size="small"
        type="danger"
        :loading="isClearing"
        @click="clear"
      >
        <template #icon><Trash2 :size="14" :stroke-width="1.5" /></template>
        清空
      </RButton>
    </div>

    <div class="history-list">
      <RLoadingState v-if="history.isLoading" size="small" message="加载中..." />

      <REmptyState
        v-else-if="history.history.length === 0"
        title="暂无历史记录"
        description="查询的单词和句子会显示在这里"
      >
        <Clock :size="32" :stroke-width="1.5" />
      </REmptyState>

      <template v-else>
        <div v-for="item in history.history" :key="item.id" class="history-item">
          <div class="history-content" @click="open(item)">
            <div class="history-word">
              <h3>{{ item.word }}</h3>
              <span class="history-type" :class="item.type">
                {{ item.type === 'word' ? '单词' : '句子' }}
              </span>
            </div>
            <p class="history-translation">{{ primaryTranslation(item) }}</p>
            <span class="history-date">{{ formatDate(item.timestamp) }}</span>
          </div>
          <RButton
            circle
            text
            size="small"
            title="删除"
            :loading="removingId === item.id"
            @click="remove(item.id)"
          >
            <template #icon><X :size="16" :stroke-width="1.5" /></template>
          </RButton>
        </div>
      </template>
    </div>

    <div v-if="!history.isLoading && history.history.length > 0" class="history-count">
      共 {{ history.history.length }} 条记录
    </div>
  </div>
</template>
