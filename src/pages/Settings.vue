<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Download, Upload } from '@lucide/vue'
import { RButton, RFormRow, RInput, RInputNumber } from '@ruinb0w/ui'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Settings } from '@/types'

const settings = useSettingsStore()

// 手机 WebView 不支持下载，按宽度判断就够
const isMobile = window.innerWidth < 768
const fileInput = ref<HTMLInputElement | null>(null)
const isTesting = ref(false)
const isSaving = ref(false)
const isExporting = ref(false)
const isImporting = ref(false)

const form = reactive<Settings>({
  apiBaseUrl: settings.apiBaseUrl,
  apiKey: settings.apiKey,
  model: settings.model,
  temperature: settings.temperature,
  historyLimit: settings.historyLimit,
})

// 设置从库里回来（或导入后）时把表单拉回一致
watch(
  () => [
    settings.apiBaseUrl,
    settings.apiKey,
    settings.model,
    settings.temperature,
    settings.historyLimit,
  ],
  () => {
    form.apiBaseUrl = settings.apiBaseUrl
    form.apiKey = settings.apiKey
    form.model = settings.model
    form.temperature = settings.temperature
    form.historyLimit = settings.historyLimit
  }
)

onMounted(() => {
  settings.loadSettings()
})

async function save() {
  isSaving.value = true
  await settings.saveSettings({ ...form })
  isSaving.value = false
}

async function testConnection() {
  isTesting.value = true
  await settings.saveSettings({ ...form })
  await settings.testConnection()
  isTesting.value = false
}

async function exportAll() {
  isExporting.value = true
  await settings.exportAllData()
  isExporting.value = false
}

async function importAll() {
  // 导入统一走隐藏的 file input（Android WebView 的文件选择器可用）
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  isImporting.value = true
  try {
    await settings.importAllData(JSON.parse(await file.text()))
  } catch (error) {
    console.error('Import failed:', error)
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <h2 class="page-title">设置</h2>

    <div class="settings-form">
      <RFormRow label="API 地址">
        <RInput v-model="form.apiBaseUrl" placeholder="https://api.openai.com/v1" />
      </RFormRow>

      <RFormRow label="API Key">
        <RInput v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
      </RFormRow>

      <RFormRow label="模型">
        <RInput v-model="form.model" placeholder="gpt-3.5-turbo" />
      </RFormRow>

      <RFormRow label="Temperature">
        <div class="range-row">
          <input
            v-model.number="form.temperature"
            type="range"
            class="range-input"
            min="0"
            max="2"
            step="0.1"
          />
          <span class="range-value">{{ form.temperature }}</span>
        </div>
      </RFormRow>

      <RFormRow label="历史条数">
        <RInputNumber v-model="form.historyLimit" :min="10" :max="1000" :step="10" />
      </RFormRow>

      <div class="form-actions">
        <RButton :loading="isTesting" :disabled="!form.apiKey" @click="testConnection">
          测试连接
        </RButton>
        <RButton type="primary" :loading="isSaving" @click="save">保存设置</RButton>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="section-title">数据管理</h3>

      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFilePicked" />

      <div class="data-management-item">
        <div class="data-management-info">
          <h4>导出/导入数据</h4>
          <p>导出或导入所有数据（包括设置、收藏和历史）</p>
        </div>
        <div class="data-management-actions">
          <RButton v-if="!isMobile" size="small" :loading="isExporting" @click="exportAll">
            <template #icon><Download :size="14" :stroke-width="1.5" /></template>
            导出
          </RButton>
          <RButton size="small" :loading="isImporting" @click="importAll">
            <template #icon><Upload :size="14" :stroke-width="1.5" /></template>
            导入
          </RButton>
        </div>
      </div>
    </div>
  </div>
</template>
