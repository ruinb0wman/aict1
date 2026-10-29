<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Download, Upload } from '@lucide/vue'
import { RButton, RFormRow, RInput, RInputNumber, RSwitch } from '@ruinb0w/ui'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPlatform } from '@/utils/tauri'
import type { Settings } from '@/types'

const settings = useSettingsStore()

const platform = ref<'desktop' | 'mobile'>('desktop')
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
  clipboardTranslationEnabled: settings.clipboardTranslationEnabled,
  clipboardTranslationInterval: settings.clipboardTranslationInterval,
  autoStart: settings.autoStart,
  silentStart: settings.silentStart,
})

// 设置从库里回来（或导入后）时把表单拉回一致
watch(
  () => [
    settings.apiBaseUrl,
    settings.apiKey,
    settings.model,
    settings.temperature,
    settings.historyLimit,
    settings.clipboardTranslationEnabled,
    settings.clipboardTranslationInterval,
    settings.autoStart,
    settings.silentStart,
  ],
  () => {
    form.apiBaseUrl = settings.apiBaseUrl
    form.apiKey = settings.apiKey
    form.model = settings.model
    form.temperature = settings.temperature
    form.historyLimit = settings.historyLimit
    form.clipboardTranslationEnabled = settings.clipboardTranslationEnabled
    form.clipboardTranslationInterval = settings.clipboardTranslationInterval
    form.autoStart = settings.autoStart
    form.silentStart = settings.silentStart
  }
)

onMounted(() => {
  settings.loadSettings()
  getPlatform().then(value => (platform.value = value))
})

async function toggleClipboard(enabled: boolean) {
  form.clipboardTranslationEnabled = enabled
  await settings.updateClipboardMonitorSettings(enabled, form.clipboardTranslationInterval)
}

async function changeClipboardInterval(interval: number) {
  form.clipboardTranslationInterval = interval
  if (form.clipboardTranslationEnabled) {
    await settings.updateClipboardMonitorSettings(true, interval)
  }
}

async function toggleAutoStart(enabled: boolean) {
  form.autoStart = enabled
  await settings.toggleAutoStart(enabled)
}

async function toggleSilentStart(enabled: boolean) {
  form.silentStart = enabled
  await settings.toggleSilentStart(enabled)
}

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
  isImporting.value = true
  if (await settings.importAllData()) {
    await settings.loadSettings()
  }
  isImporting.value = false
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
      <h3 class="section-title">剪切板翻译</h3>
      <p class="section-desc">在任意应用中双击 Ctrl+C 触发翻译</p>

      <RFormRow label="启用">
        <RSwitch :model-value="form.clipboardTranslationEnabled" @update:model-value="toggleClipboard" />
      </RFormRow>

      <RFormRow
        label="触发间隔"
        :class="{ disabled: !form.clipboardTranslationEnabled }"
      >
        <div class="range-row">
          <input
            type="range"
            class="range-input"
            min="200"
            max="3000"
            step="100"
            :value="form.clipboardTranslationInterval"
            :disabled="!form.clipboardTranslationEnabled"
            @input="changeClipboardInterval(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="range-value">{{ (form.clipboardTranslationInterval / 1000).toFixed(1) }}s</span>
        </div>
      </RFormRow>
    </div>

    <div v-if="platform === 'desktop'" class="settings-section">
      <h3 class="section-title">系统设置</h3>

      <RFormRow label="开机自启" hint="系统启动时自动运行应用">
        <RSwitch :model-value="form.autoStart" @update:model-value="toggleAutoStart" />
      </RFormRow>

      <RFormRow
        label="静默启动"
        hint="开机启动时不显示主窗口，仅在托盘运行"
        :class="{ disabled: !form.autoStart }"
      >
        <RSwitch
          :model-value="form.silentStart"
          :disabled="!form.autoStart"
          @update:model-value="toggleSilentStart"
        />
      </RFormRow>
    </div>

    <div class="settings-section">
      <h3 class="section-title">数据管理</h3>

      <div class="data-management-item">
        <div class="data-management-info">
          <h4>导出/导入数据</h4>
          <p>导出或导入所有数据（包括设置和收藏的单词）</p>
        </div>
        <div class="data-management-actions">
          <RButton size="small" :loading="isExporting" @click="exportAll">
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
