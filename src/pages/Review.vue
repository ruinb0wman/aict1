<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { BookOpen, Check, ChevronRight, RotateCcw, X } from '@lucide/vue'
import { RButton, REmptyState, RProgress } from '@ruinb0w/ui'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { pickReviewWords } from '@/libs/review'
import type { FavoriteWord } from '@/types'

const favorites = useFavoritesStore()

const reviewWords = ref<FavoriteWord[]>([])
const currentIndex = ref(0)
const isFlipped = ref(false)
const isCompleted = ref(false)

const currentWord = computed(() => reviewWords.value[currentIndex.value])

const todayReviewedCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return favorites.favorites.filter(f => f.lastReviewedAt && f.lastReviewedAt >= today.getTime()).length
})

function reset() {
  reviewWords.value = pickReviewWords(favorites.favorites)
  currentIndex.value = 0
  isFlipped.value = false
  isCompleted.value = favorites.favorites.length > 0 && reviewWords.value.length === 0
}

// 收藏由 App 异步加载：队列还是空的时候就跟着重建；一旦开始复习就固定这一轮
watch(
  () => favorites.favorites,
  () => {
    if (reviewWords.value.length === 0) reset()
  },
  { immediate: true }
)

function next() {
  if (currentIndex.value < reviewWords.value.length - 1) {
    isFlipped.value = false
    setTimeout(() => currentIndex.value++, 150)
  } else {
    isCompleted.value = true
  }
}

async function mark(known: boolean) {
  if (!currentWord.value) return
  await favorites.updateReviewStatus(currentWord.value.id, known)
  next()
}

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

  if (event.key === ' ') {
    event.preventDefault()
    isFlipped.value = !isFlipped.value
  } else if (event.key === 'ArrowLeft' && isFlipped.value) {
    mark(false)
  } else if (event.key === 'ArrowRight' && isFlipped.value) {
    mark(true)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <REmptyState
    v-if="favorites.favorites.length === 0"
    title="暂无收藏单词"
    description="先去收藏一些单词，再来复习吧~"
  >
    <BookOpen :size="32" :stroke-width="1.5" />
  </REmptyState>

  <div v-else-if="isCompleted || reviewWords.length === 0" class="review-complete">
    <div class="review-complete-icon">
      <Check :size="48" :stroke-width="1.5" />
    </div>
    <h3 class="review-complete-title">今日复习完成！</h3>
    <p class="review-complete-text">继续保持，你的词汇量会越来越丰富</p>
    <RButton type="primary" @click="reset">
      <template #icon><RotateCcw :size="16" :stroke-width="1.5" /></template>
      重新开始
    </RButton>
  </div>

  <div v-else-if="currentWord" class="review-page">
    <div class="review-progress-bar">
      <div class="review-progress-info">
        <span class="review-progress-text">{{ currentIndex + 1 }} / {{ reviewWords.length }}</span>
        <span class="review-progress-today">今日已复习: {{ todayReviewedCount }}</span>
      </div>
      <RProgress :value="currentIndex + 1" :max="reviewWords.length" size="small" />
    </div>

    <div class="review-card-wrapper" @click="isFlipped = !isFlipped">
      <div class="review-card" :class="{ flipped: isFlipped }">
        <div class="review-card-front">
          <div class="review-card-content">
            <h2 class="review-word">{{ currentWord.word }}</h2>
            <span v-if="currentWord.phonetic" class="review-phonetic">{{ currentWord.phonetic }}</span>
            <p class="review-hint">点击翻转查看答案</p>
          </div>
          <div class="review-card-badge">
            <BookOpen :size="16" :stroke-width="1.5" />
            <span>第 {{ currentWord.reviewCount + 1 }} 次复习</span>
          </div>
        </div>

        <div class="review-card-back">
          <div class="review-card-content">
            <h3 class="review-word-small">{{ currentWord.word }}</h3>
            <div class="review-translation">
              <span class="review-translation-text">{{ currentWord.translation }}</span>
            </div>
            <div v-if="currentWord.queryData.example?.length" class="review-examples">
              <h4 class="review-section-title">例句</h4>
              <div
                v-for="(example, index) in currentWord.queryData.example.slice(0, 2)"
                :key="index"
                class="review-example-item"
              >
                <p class="review-example-en">{{ example.en }}</p>
                <p class="review-example-zh">{{ example.zh }}</p>
              </div>
            </div>
          </div>

          <div class="review-mastery">
            <span class="review-mastery-label">掌握程度</span>
            <div class="review-mastery-dots">
              <span
                v-for="level in [0, 1, 2, 3, 4]"
                :key="level"
                class="review-mastery-dot"
                :class="{ active: level < currentWord.masteryLevel }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="review-actions">
      <template v-if="!isFlipped">
        <RButton size="small" @click="next">
          <template #icon><ChevronRight :size="18" :stroke-width="1.5" /></template>
          跳过
        </RButton>
        <RButton size="small" @click="isFlipped = true">
          <template #icon><RotateCcw :size="18" :stroke-width="1.5" /></template>
          翻转卡片
        </RButton>
      </template>
      <template v-else>
        <RButton size="small" type="danger" @click="mark(false)">
          <template #icon><X :size="18" :stroke-width="1.5" /></template>
          不认识
        </RButton>
        <RButton size="small" type="success" @click="mark(true)">
          <template #icon><Check :size="18" :stroke-width="1.5" /></template>
          认识
        </RButton>
      </template>
    </div>

    <div class="review-shortcuts">
      <span class="review-shortcut"><kbd>Space</kbd> 翻转</span>
      <span class="review-shortcut"><kbd>←</kbd> 不认识</span>
      <span class="review-shortcut"><kbd>→</kbd> 认识</span>
    </div>
  </div>
</template>
