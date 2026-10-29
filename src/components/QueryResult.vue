<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Search, Star, Volume2, X } from '@lucide/vue'
import { RBadge, RButton, REmptyState, RErrorState, RLoadingState } from '@ruinb0w/ui'
import { useAppStore } from '@/stores/appStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useWordsStore } from '@/stores/wordsStore'
import { isSentence } from '@/utils/api'
import { speak } from '@/utils/tauri'
import QueryResultEdit from './QueryResultEdit.vue'
import NoteSection from './NoteSection.vue'
import type {
  QueryResult as QueryResultType,
  SentenceTranslation,
  TranslationMap,
  ExampleSentence,
} from '@/types'

const app = useAppStore()
const favorites = useFavoritesStore()
const words = useWordsStore()

const isEditing = ref(false)

const isSentenceResult = computed(
  () => !!app.queryResult && (isSentence(app.lastQuery) || 'type' in app.queryResult)
)
// 中译英结果不收藏、不显示音标/例句
const isChineseResult = computed(
  () => !!app.queryResult && 'isChinese' in app.queryResult && !!app.queryResult.isChinese
)
const sentenceResult = computed(() =>
  isSentenceResult.value ? (app.queryResult as SentenceTranslation) : null
)
const wordResult = computed(() =>
  isSentenceResult.value ? null : (app.queryResult as QueryResultType | null)
)
const cachedWord = computed(() => {
  const word = wordResult.value?.word
  if (!word) return null
  return words.cachedWords.find(w => w.word.toLowerCase() === word.toLowerCase()) ?? null
})
const favorited = computed(() => !!wordResult.value && favorites.isFavorite(wordResult.value.word))

function toggleFavorite() {
  if (isChineseResult.value || !wordResult.value) return
  favorites.toggleFavorite(wordResult.value.word, wordResult.value)
}

async function handleSaveEdit(
  translation: TranslationMap,
  examples: ExampleSentence[],
  synonyms: string[],
  antonyms: string[],
  baseForm: string
) {
  const word = wordResult.value
  if (cachedWord.value && word) {
    const id = cachedWord.value.id
    await words.updateWordTranslation(id, translation)
    await words.updateWordExamples(id, examples)
    await words.updateWordSynonyms(id, synonyms)
    await words.updateWordAntonyms(id, antonyms)
    if (baseForm) {
      await words.updateWordBaseForm(id, baseForm)
    }
    // 回填当前显示的查询结果
    app.setQueryResult({
      ...word,
      translation,
      example: examples,
      synonyms,
      antonyms,
      baseForm: baseForm || undefined,
    })
  }
  isEditing.value = false
}
</script>

<template>
  <RLoadingState v-if="app.isLoading" message="正在查询..." />

  <RErrorState v-else-if="app.error" :title="app.error" />

  <REmptyState v-else-if="!app.queryResult" title="输入单词或句子开始查询">
    <Search :size="32" :stroke-width="1.5" />
  </REmptyState>

  <div v-else-if="sentenceResult" class="query-result">
    <div class="sentence-result">
      <h3 class="sentence-original">{{ sentenceResult.original || app.lastQuery }}</h3>
      <p class="sentence-translation">{{ sentenceResult.translation }}</p>
    </div>
  </div>

  <div v-else-if="wordResult" class="query-result">
    <div class="word-header">
      <div class="word-title-row">
        <h2 class="word-title">{{ wordResult.word }}</h2>
        <div class="word-actions">
          <RButton circle text size="small" :title="isEditing ? '取消编辑' : '编辑单词'" @click="isEditing = !isEditing">
            <template #icon>
              <X v-if="isEditing" :size="18" :stroke-width="1.5" />
              <Pencil v-else :size="18" :stroke-width="1.5" />
            </template>
          </RButton>
          <RButton
            v-if="!isChineseResult"
            circle
            text
            size="small"
            :active="favorited"
            :title="favorited ? '取消收藏' : '收藏'"
            @click="toggleFavorite"
          >
            <template #icon>
              <Star :size="20" :stroke-width="1.5" :fill="favorited ? 'currentColor' : 'none'" />
            </template>
          </RButton>
        </div>
      </div>

      <div v-if="wordResult.phonetic && !isChineseResult" class="word-phonetic">
        <span>{{ wordResult.phonetic }}</span>
        <RButton circle text size="small" title="播放发音" @click="speak(wordResult.word)">
          <template #icon><Volume2 :size="16" :stroke-width="1.5" /></template>
        </RButton>
      </div>
    </div>

    <QueryResultEdit
      v-if="isEditing"
      :word-result="wordResult"
      @save="handleSaveEdit"
      @cancel="isEditing = false"
    />

    <template v-else>
      <div class="word-translations">
        <div v-for="(translations, pos) in wordResult.translation" :key="pos" class="translation-item">
          <span class="pos-tag">{{ pos }}</span>
          <span class="translation-text">{{ translations.join('；') }}</span>
        </div>
      </div>

      <div
        v-if="wordResult.baseForm && wordResult.baseForm.toLowerCase() !== wordResult.word.toLowerCase() && !isChineseResult"
        class="word-baseform"
      >
        <h4 class="section-title">原型</h4>
        <span class="baseform-text">{{ wordResult.baseForm }}</span>
      </div>

      <div v-if="wordResult.synonyms?.length && !isChineseResult" class="word-synonyms">
        <h4 class="section-title">近义词</h4>
        <div class="word-tags">
          <RBadge v-for="synonym in wordResult.synonyms" :key="synonym" round>{{ synonym }}</RBadge>
        </div>
      </div>

      <div v-if="wordResult.antonyms?.length && !isChineseResult" class="word-antonyms">
        <h4 class="section-title">反义词</h4>
        <div class="word-tags">
          <RBadge v-for="antonym in wordResult.antonyms" :key="antonym" round>{{ antonym }}</RBadge>
        </div>
      </div>

      <div v-if="wordResult.example?.length && !isChineseResult" class="word-examples">
        <h4 class="section-title">例句</h4>
        <div v-for="(example, index) in wordResult.example" :key="index" class="example-item">
          <p class="example-en">{{ example.en }}</p>
          <p class="example-zh">{{ example.zh }}</p>
        </div>
      </div>

      <NoteSection
        v-if="cachedWord && !isChineseResult"
        :word-id="cachedWord.id"
        :note="cachedWord.note"
      />
    </template>
  </div>
</template>
