<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Database, Loader2 } from '@lucide/vue'
import { RInput } from '@ruinb0w/ui'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useWordsStore } from '@/stores/wordsStore'
import { queryLLM, isSentence, isChinese } from '@/utils/api'
import { toQueryResult } from '@/utils/store'

const app = useAppStore()
const settings = useSettingsStore()
const history = useHistoryStore()
const words = useWordsStore()

const input = ref('')
const isFromCache = ref(false)

async function performSearch(queryText: string) {
  if (!queryText || app.isLoading) return
  // 防重复查询
  if (queryText === app.lastQuery) return

  app.setLoading(true)
  app.setError(null)
  isFromCache.value = false

  try {
    // 句子不使用缓存
    const isSentenceQuery = isSentence(queryText)

    if (!isSentenceQuery && !isChinese(queryText)) {
      const cachedWord = await words.getWordFromCache(queryText)
      if (cachedWord) {
        const result = toQueryResult(cachedWord)
        app.setQueryResult(result)
        isFromCache.value = true
        // 命中缓存也算一次查询次数
        await words.saveWordToCache(queryText, result)
        await history.addHistory(queryText, result)
        app.showToast('已从本地缓存加载', 'success', 2000)
        return
      }
    }

    if (!settings.apiKey) {
      app.showToast('请先设置 API Key', 'warning')
      app.setError('请先设置 API Key')
      return
    }

    const result = await queryLLM(queryText)
    app.setQueryResult(result)

    // 中译英结果和句子不缓存
    if (!isSentenceQuery && !isChinese(queryText)) {
      await words.saveWordToCache(queryText, result as never)
    }

    await history.addHistory(queryText, result)
    // 成功后记录 lastQuery，失败时允许重试
    app.setLastQuery(queryText)
    app.showToast('查询成功', 'success', 2000)
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败'
    app.setError(message)
    app.setQueryResult(null)
    app.showToast(message, 'error', 5000)
  } finally {
    app.setLoading(false)
  }
}

async function handleSearch() {
  const trimmed = input.value.trim()
  if (!trimmed) return
  await performSearch(trimmed)
}

onMounted(() => {
  words.init()
})

// 剪切板事件：App 里写 clipboardText，这里消费掉并立即查询
watch(
  () => app.clipboardText,
  (text) => {
    if (!text) return
    input.value = text
    app.setClipboardText('')
    performSearch(text)
  },
  { immediate: true }
)
</script>

<template>
  <form class="search-box" @submit.prevent="handleSearch">
    <RInput
      v-model="input"
      placeholder="输入单词或句子..."
      prefix-icon="Search"
      :disabled="app.isLoading"
      @keydown.enter="handleSearch"
    >
      <template #suffix>
        <Loader2 v-if="app.isLoading" class="search-loading" :size="18" :stroke-width="1.5" />
        <Database
          v-else-if="isFromCache"
          class="search-cache-indicator"
          :size="18"
          :stroke-width="1.5"
        />
      </template>
    </RInput>
  </form>
</template>
