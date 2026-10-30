<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleAlert, CircleCheck, Copy } from '@lucide/vue'
import { RBadge, RButton, RCard, REmptyState, RInput } from '@ruinb0w/ui'
import { checkGrammar } from '@/utils/api'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAppStore } from '@/stores/appStore'
import type { GrammarCheckResult, GrammarCorrectionType } from '@/types'

const MAX_CHARS = 500

const typeLabels: Record<GrammarCorrectionType, string> = {
  grammar: '语法错误',
  style: '表达优化',
  'word-choice': '用词选择',
  spelling: '拼写错误',
}

const typeTones: Record<GrammarCorrectionType, 'danger' | 'success' | 'info' | 'warning'> = {
  grammar: 'danger',
  style: 'success',
  'word-choice': 'info',
  spelling: 'warning',
}

const settings = useSettingsStore()
const app = useAppStore()

const text = ref('')
const isChecking = ref(false)
const result = ref<GrammarCheckResult | null>(null)
const copied = ref(false)

const canCheck = computed(() => !!text.value.trim() && !isChecking.value)

async function check() {
  if (!text.value.trim()) {
    app.showToast('请输入要检查的英文', 'warning')
    return
  }
  if (!settings.apiKey) {
    app.showToast('请先设置 API Key', 'error')
    return
  }

  isChecking.value = true
  try {
    result.value = await checkGrammar(text.value.trim())
    app.showToast('语法检查完成', 'success')
  } catch (error) {
    app.showToast(error instanceof Error ? error.message : '检查失败', 'error')
  } finally {
    isChecking.value = false
  }
}

function clear() {
  text.value = ''
  result.value = null
  copied.value = false
}

async function copy() {
  if (!result.value?.correctedText) return
  try {
    await navigator.clipboard.writeText(result.value.correctedText)
    copied.value = true
    app.showToast('已复制到剪贴板', 'success')
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    app.showToast('复制失败', 'error')
  }
}
</script>

<template>
  <div class="grammar-check-page">
    <h2 class="page-title">语法检查</h2>

    <div class="grammar-input-section">
      <RInput
        v-model="text"
        type="textarea"
        :rows="6"
        :maxlength="MAX_CHARS"
        show-word-limit
        placeholder="请输入要检查的英文文本（最多500字符）..."
        :disabled="isChecking"
      />

      <div class="grammar-actions">
        <RButton :disabled="isChecking || (!text && !result)" @click="clear">清空</RButton>
        <RButton type="primary" :loading="isChecking" :disabled="!canCheck" @click="check">
          检查语法
        </RButton>
      </div>
    </div>

    <div v-if="result" class="grammar-result-section">
      <RCard>
        <div class="grammar-corrected-header">
          <h3>修正后</h3>
          <RButton size="small" @click="copy">
            <template #icon>
              <CircleCheck v-if="copied" :size="16" :stroke-width="1.5" />
              <Copy v-else :size="16" :stroke-width="1.5" />
            </template>
            {{ copied ? '已复制' : '复制' }}
          </RButton>
        </div>
        <p class="grammar-corrected-text">{{ result.correctedText }}</p>
      </RCard>

      <div v-if="result.corrections.length > 0" class="grammar-corrections">
        <h3>修改详情</h3>
        <div class="corrections-list">
          <div v-for="(correction, index) in result.corrections" :key="index" class="correction-item">
            <div class="correction-header">
              <RBadge :type="typeTones[correction.type]" round>{{ typeLabels[correction.type] }}</RBadge>
            </div>
            <div class="correction-content">
              <div class="correction-compare">
                <div class="correction-original">
                  <CircleAlert :size="14" :stroke-width="1.5" />
                  <span>{{ correction.original }}</span>
                </div>
                <div class="correction-arrow">→</div>
                <div class="correction-fixed">
                  <CircleCheck :size="14" :stroke-width="1.5" />
                  <span>{{ correction.corrected }}</span>
                </div>
              </div>
              <p class="correction-explanation">{{ correction.explanation }}</p>
            </div>
          </div>
        </div>
      </div>

      <RCard v-if="result.overallFeedback">
        <h3>整体评价</h3>
        <p>{{ result.overallFeedback }}</p>
      </RCard>

      <REmptyState v-if="result.corrections.length === 0" title="没有发现语法错误，表达很完美！">
        <CircleCheck :size="32" :stroke-width="1.5" />
      </REmptyState>
    </div>
  </div>
</template>
