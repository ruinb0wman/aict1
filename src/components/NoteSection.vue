<script setup lang="ts">
import { ref } from 'vue'
import { FileText, MessageSquare, Save, SquarePen, Trash2, X } from '@lucide/vue'
import { RButton } from '@ruinb0w/ui'
import { useWordsStore } from '@/stores/wordsStore'

const props = defineProps<{ wordId: string; note?: string }>()

const words = useWordsStore()
const isEditing = ref(false)
const noteText = ref(props.note || '')

async function save() {
  await words.addNote(props.wordId, noteText.value)
  isEditing.value = false
}

async function remove() {
  await words.removeNote(props.wordId)
  noteText.value = ''
}
</script>

<template>
  <div class="note-section" :class="{ editing: isEditing }">
    <template v-if="isEditing">
      <textarea v-model="noteText" class="note-textarea" placeholder="添加批注..." rows="3" />
      <div class="note-actions">
        <RButton size="small" @click="save">
          <template #icon><Save :size="14" :stroke-width="1.5" /></template>
          保存
        </RButton>
        <RButton size="small" @click="isEditing = false">
          <template #icon><X :size="14" :stroke-width="1.5" /></template>
          取消
        </RButton>
      </div>
    </template>

    <div v-else-if="note" class="note-content">
      <div class="note-header">
        <MessageSquare :size="14" :stroke-width="1.5" />
        <span>批注</span>
      </div>
      <p class="note-text">{{ note }}</p>
      <div class="note-actions">
        <RButton size="small" text @click="isEditing = true">
          <template #icon><SquarePen :size="14" :stroke-width="1.5" /></template>
          编辑
        </RButton>
        <RButton size="small" text type="danger" @click="remove">
          <template #icon><Trash2 :size="14" :stroke-width="1.5" /></template>
          删除
        </RButton>
      </div>
    </div>

    <RButton v-else size="small" text @click="isEditing = true">
      <template #icon><FileText :size="14" :stroke-width="1.5" /></template>
      添加批注
    </RButton>
  </div>
</template>
