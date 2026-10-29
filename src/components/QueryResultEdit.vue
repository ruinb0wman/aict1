<script setup lang="ts">
import { ref } from 'vue'
import { Save, Trash2, X } from '@lucide/vue'
import { RButton } from '@ruinb0w/ui'
import type { QueryResult, TranslationMap, ExampleSentence } from '@/types'

const props = defineProps<{ wordResult: QueryResult }>()
const emit = defineEmits<{
  save: [
    translation: TranslationMap,
    examples: ExampleSentence[],
    synonyms: string[],
    antonyms: string[],
    baseForm: string,
  ]
  cancel: []
}>()

const translation = ref<TranslationMap>({ ...props.wordResult.translation })
const examples = ref<ExampleSentence[]>([...(props.wordResult.example || [])])
const synonyms = ref((props.wordResult.synonyms || []).join(', '))
const antonyms = ref((props.wordResult.antonyms || []).join(', '))
const baseForm = ref(props.wordResult.baseForm || '')

const newPos = ref('')
const newTranslation = ref('')
const newEn = ref('')
const newZh = ref('')

function addTranslation() {
  if (!newPos.value || !newTranslation.value) return
  translation.value[newPos.value] = newTranslation.value
    .split(/[,，;；]/)
    .map(s => s.trim())
    .filter(Boolean)
  newPos.value = ''
  newTranslation.value = ''
}

function removeTranslation(pos: string) {
  delete translation.value[pos]
}

function addExample() {
  if (!newEn.value || !newZh.value) return
  examples.value.push({ en: newEn.value, zh: newZh.value })
  newEn.value = ''
  newZh.value = ''
}

function removeExample(index: number) {
  examples.value.splice(index, 1)
}

const parseCommaSeparated = (value: string) =>
  value.split(/[,，;；]/).map(s => s.trim()).filter(Boolean)

function save() {
  emit(
    'save',
    translation.value,
    examples.value,
    parseCommaSeparated(synonyms.value),
    parseCommaSeparated(antonyms.value),
    baseForm.value
  )
}
</script>

<template>
  <div class="word-result-edit">
    <div class="edit-section">
      <h4 class="edit-section-title">翻译</h4>
      <div v-for="(translations, pos) in translation" :key="pos" class="edit-translation-item">
        <span class="pos-tag">{{ pos }}</span>
        <span class="translation-text">{{ translations.join('；') }}</span>
        <button class="edit-remove-btn" @click="removeTranslation(pos)">
          <X :size="14" :stroke-width="1.5" />
        </button>
      </div>
      <div class="edit-add-row">
        <input v-model="newPos" type="text" class="edit-input-small" placeholder="词性 (如: n.)" />
        <input v-model="newTranslation" type="text" class="edit-input" placeholder="翻译 (用逗号分隔)" />
        <RButton size="small" icon="Plus" @click="addTranslation">添加</RButton>
      </div>
    </div>

    <div class="edit-section">
      <h4 class="edit-section-title">例句</h4>
      <div v-for="(example, index) in examples" :key="index" class="edit-example-item">
        <p class="example-en">{{ example.en }}</p>
        <p class="example-zh">{{ example.zh }}</p>
        <button class="edit-remove-btn" @click="removeExample(index)">
          <Trash2 :size="14" :stroke-width="1.5" />
        </button>
      </div>
      <div class="edit-add-row vertical">
        <input v-model="newEn" type="text" class="edit-input" placeholder="英文例句" />
        <input v-model="newZh" type="text" class="edit-input" placeholder="中文翻译" />
        <RButton size="small" @click="addExample">添加例句</RButton>
      </div>
    </div>

    <div class="edit-section">
      <h4 class="edit-section-title">原型</h4>
      <input v-model="baseForm" type="text" class="edit-input" placeholder="单词原型（如: go）" />
    </div>

    <div class="edit-section">
      <h4 class="edit-section-title">近义词</h4>
      <input v-model="synonyms" type="text" class="edit-input" placeholder="用逗号分隔多个近义词" />
    </div>

    <div class="edit-section">
      <h4 class="edit-section-title">反义词</h4>
      <input v-model="antonyms" type="text" class="edit-input" placeholder="用逗号分隔多个反义词" />
    </div>

    <div class="edit-actions">
      <RButton type="primary" @click="save">
        <template #icon><Save :size="16" :stroke-width="1.5" /></template>
        保存
      </RButton>
      <RButton @click="emit('cancel')">
        <template #icon><X :size="16" :stroke-width="1.5" /></template>
        取消
      </RButton>
    </div>
  </div>
</template>
