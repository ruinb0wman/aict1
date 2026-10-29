<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Star, Trash2 } from '@lucide/vue'
import { RButton, REmptyState, RInput, RLoadingState } from '@ruinb0w/ui'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useAppStore } from '@/stores/appStore'
import type { FavoriteWord } from '@/types'

const router = useRouter()
const favorites = useFavoritesStore()
const app = useAppStore()

const removingId = ref<string | null>(null)

const filtered = computed(() => favorites.getFilteredFavorites())

onMounted(() => favorites.loadFavorites())

async function remove(id: string) {
  removingId.value = id
  await favorites.removeFavorite(id)
  removingId.value = null
}

function open(favorite: FavoriteWord) {
  app.setQueryResult(favorite.queryData)
  app.setLastQuery(favorite.word)
  router.push('/')
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="favorites-page">
    <div class="favorites-header">
      <h2 class="page-title">收藏</h2>
      <RButton circle text size="small" title="复习" @click="router.push('/review')">
        <template #icon><BookOpen :size="18" :stroke-width="1.5" /></template>
      </RButton>
    </div>

    <RInput
      :model-value="favorites.searchQuery"
      placeholder="搜索收藏的单词..."
      prefix-icon="Search"
      clearable
      @update:model-value="favorites.setSearchQuery(String($event))"
    />

    <div class="favorites-list">
      <RLoadingState v-if="favorites.isLoading" size="small" message="加载中..." />

      <REmptyState
        v-else-if="filtered.length === 0"
        :title="favorites.searchQuery ? '未找到匹配的单词' : '暂无收藏'"
        :description="favorites.searchQuery ? '尝试其他关键词' : '查询单词后点击星形图标收藏'"
      >
        <Star v-if="!favorites.searchQuery" :size="32" :stroke-width="1.5" />
      </REmptyState>

      <template v-else>
        <div v-for="favorite in filtered" :key="favorite.id" class="favorite-item">
          <div class="favorite-content" @click="open(favorite)">
            <div class="favorite-word">
              <h3>{{ favorite.word }}</h3>
              <span v-if="favorite.phonetic" class="favorite-phonetic">{{ favorite.phonetic }}</span>
            </div>
            <p class="favorite-translation">{{ favorite.translation }}</p>
            <span class="favorite-date">{{ formatDate(favorite.createdAt) }}</span>
          </div>
          <RButton
            circle
            text
            size="small"
            type="danger"
            title="取消收藏"
            :loading="removingId === favorite.id"
            @click="remove(favorite.id)"
          >
            <template #icon><Trash2 :size="16" :stroke-width="1.5" /></template>
          </RButton>
        </div>
      </template>
    </div>

    <div v-if="!favorites.isLoading && filtered.length > 0" class="favorites-count">
      共 {{ filtered.length }} 个收藏
    </div>
  </div>
</template>
