import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types'
import { defaultSettings } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { testAPIConnection } from '@/utils/api'
import { exportData, importData, updateClipboardMonitor, setAutoStart, setSilentStart } from '@/utils/tauri'
import { useAppStore } from '@/stores/appStore'
import { useFavoritesStore } from '@/stores/favoritesStore'

export const useSettingsStore = defineStore('settings', () => {
  const apiBaseUrl = ref(defaultSettings.apiBaseUrl)
  const apiKey = ref(defaultSettings.apiKey)
  const model = ref(defaultSettings.model)
  const temperature = ref(defaultSettings.temperature)
  const historyLimit = ref(defaultSettings.historyLimit)
  const clipboardTranslationEnabled = ref(defaultSettings.clipboardTranslationEnabled)
  const clipboardTranslationInterval = ref(defaultSettings.clipboardTranslationInterval)
  const autoStart = ref(defaultSettings.autoStart)
  const silentStart = ref(defaultSettings.silentStart)
  const isLoading = ref(false)

  function snapshot(): Settings {
    return {
      apiBaseUrl: apiBaseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
      temperature: temperature.value,
      historyLimit: historyLimit.value,
      clipboardTranslationEnabled: clipboardTranslationEnabled.value,
      clipboardTranslationInterval: clipboardTranslationInterval.value,
      autoStart: autoStart.value,
      silentStart: silentStart.value,
    }
  }

  async function loadSettings() {
    isLoading.value = true
    try {
      const saved = await indexedDBService.getSettings()
      if (saved) {
        // 逐项回退到默认值：库里可能缺字段（旧版本导出）
        apiBaseUrl.value = saved.apiBaseUrl || defaultSettings.apiBaseUrl
        apiKey.value = saved.apiKey || defaultSettings.apiKey
        model.value = saved.model || defaultSettings.model
        temperature.value = saved.temperature ?? defaultSettings.temperature
        historyLimit.value = saved.historyLimit || defaultSettings.historyLimit
        clipboardTranslationEnabled.value = saved.clipboardTranslationEnabled ?? defaultSettings.clipboardTranslationEnabled
        clipboardTranslationInterval.value = saved.clipboardTranslationInterval ?? defaultSettings.clipboardTranslationInterval
        autoStart.value = saved.autoStart ?? defaultSettings.autoStart
        silentStart.value = saved.silentStart ?? defaultSettings.silentStart
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      useAppStore().showToast('加载设置失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  async function saveSettings(newSettings: Partial<Settings>) {
    isLoading.value = true
    try {
      const merged: Settings = { ...snapshot(), ...newSettings }
      await indexedDBService.saveSettings(merged)
      apiBaseUrl.value = merged.apiBaseUrl
      apiKey.value = merged.apiKey
      model.value = merged.model
      temperature.value = merged.temperature
      historyLimit.value = merged.historyLimit
      clipboardTranslationEnabled.value = merged.clipboardTranslationEnabled
      clipboardTranslationInterval.value = merged.clipboardTranslationInterval
      autoStart.value = merged.autoStart
      silentStart.value = merged.silentStart
      useAppStore().showToast('设置已保存', 'success')
    } catch (error) {
      console.error('Failed to save settings:', error)
      useAppStore().showToast('保存设置失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  async function testConnection() {
    const result = await testAPIConnection(snapshot())
    useAppStore().showToast(
      result.success ? 'API 连接测试成功' : `连接失败: ${result.message}`,
      result.success ? 'success' : 'error',
      result.success ? undefined : 5000
    )
    return result
  }

  async function exportAllData() {
    try {
      const result = await exportData(snapshot(), useFavoritesStore().favorites)
      if (result.cancelled) return

      if (result.success) {
        useAppStore().showToast('数据已导出', 'success')
      } else {
        useAppStore().showToast(result.error || '导出失败', 'error')
      }
    } catch (error) {
      console.error('Export data failed:', error)
      useAppStore().showToast('导出失败', 'error')
    }
  }

  async function importAllData() {
    try {
      const result = await importData()
      if (result.cancelled) return false

      if (!result.success) {
        useAppStore().showToast(result.error || '导入失败', 'error')
        return false
      }

      if (result.settings) {
        const imported = result.settings
        await saveSettings({
          apiBaseUrl: String(imported.apiBaseUrl || ''),
          apiKey: String(imported.apiKey || ''),
          model: String(imported.model || ''),
          temperature: Number(imported.temperature) || 0.7,
          historyLimit: Number(imported.historyLimit) || 100,
        })
      }

      if (result.favorites && result.favorites.length > 0) {
        await useFavoritesStore().importFavoritesFromData(result.favorites)
      }

      useAppStore().showToast('数据已导入', 'success')
      return true
    } catch (error) {
      console.error('Import data failed:', error)
      useAppStore().showToast('导入失败', 'error')
      return false
    }
  }

  async function initClipboardMonitor() {
    try {
      await updateClipboardMonitor(clipboardTranslationEnabled.value, clipboardTranslationInterval.value)
    } catch (error) {
      console.error('Failed to init clipboard monitor:', error)
    }
  }

  async function updateClipboardMonitorSettings(enabled: boolean, interval: number) {
    try {
      await updateClipboardMonitor(enabled, interval)
      await saveSettings({
        clipboardTranslationEnabled: enabled,
        clipboardTranslationInterval: interval,
      })
    } catch (error) {
      console.error('Failed to update clipboard monitor:', error)
      useAppStore().showToast('剪切板监听设置失败', 'error')
    }
  }

  async function toggleAutoStart(enabled: boolean) {
    try {
      await setAutoStart(enabled)
      autoStart.value = enabled
      await saveSettings({ autoStart: enabled })
      useAppStore().showToast(enabled ? '已开启开机自启' : '已关闭开机自启', 'success')
    } catch (error) {
      console.error('Failed to set autostart:', error)
      useAppStore().showToast('自启设置失败', 'error')
    }
  }

  async function toggleSilentStart(enabled: boolean) {
    try {
      await setSilentStart(enabled)
      silentStart.value = enabled
      await saveSettings({ silentStart: enabled })
      useAppStore().showToast(enabled ? '已开启静默启动' : '已关闭静默启动', 'success')
    } catch (error) {
      console.error('Failed to set silent start:', error)
      useAppStore().showToast('静默启动设置失败', 'error')
    }
  }

  return {
    apiBaseUrl,
    apiKey,
    model,
    temperature,
    historyLimit,
    clipboardTranslationEnabled,
    clipboardTranslationInterval,
    autoStart,
    silentStart,
    isLoading,
    loadSettings,
    saveSettings,
    testConnection,
    exportAllData,
    importAllData,
    initClipboardMonitor,
    updateClipboardMonitorSettings,
    toggleAutoStart,
    toggleSilentStart,
  }
})
