import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types'
import { defaultSettings } from '@/types'
import { store } from '@/utils/store'
import { isTauri } from '@/libs/env'
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
      const saved = await store.getSettings()
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
      await store.saveSettings(merged)
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
      // 浏览器里没有原生文件对话框：直接下载服务端导出的文件
      if (!isTauri()) {
        const raw = await store.exportRaw()
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `aict1-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
        useAppStore().showToast('数据已导出', 'success')
        return
      }

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

  // payload 由 Settings.vue 在网页端读文件后传入；Tauri 里仍走原生对话框
  async function importAllData(payload?: unknown) {
    try {
      let data = payload

      if (data === undefined) {
        if (!isTauri()) return false
        const result = await importData()
        if (result.cancelled) return false
        if (!result.success) {
          useAppStore().showToast(result.error || '导入失败', 'error')
          return false
        }
        data = { settings: result.settings, favorites: result.favorites }
      }

      const { imported, skipped } = await store.importData(data)
      await loadSettings()
      await useFavoritesStore().loadFavorites()
      useAppStore().showToast(
        `成功导入 ${imported} 个收藏${skipped > 0 ? `，跳过 ${skipped} 个重复` : ''}`,
        'success'
      )
      return true
    } catch (error) {
      console.error('Import data failed:', error)
      useAppStore().showToast('导入失败', 'error')
      return false
    }
  }

  // 一次性迁移：旧版数据在客户端 IndexedDB 里，读出来整体 POST 给服务端
  async function importLocalLegacy() {
    try {
      const { indexedDBService } = await import('@/utils/indexedDB')
      const [legacySettings, legacyFavorites, words, history] = await Promise.all([
        indexedDBService.getSettings(),
        indexedDBService.getAllFavorites(),
        indexedDBService.getAllWords(),
        indexedDBService.getAllHistory(),
      ])

      const total = legacyFavorites.length + words.length + history.length
      if (total === 0 && !legacySettings) {
        useAppStore().showToast('本机没有旧版数据', 'info')
        return false
      }

      const { imported, skipped } = await store.importData({
        settings: legacySettings ?? undefined,
        favorites: legacyFavorites,
        words,
        history,
      })
      await loadSettings()
      await useFavoritesStore().loadFavorites()
      useAppStore().showToast(
        `已迁移 ${words.length} 个单词、${imported} 个收藏（跳过 ${skipped} 个重复）、${history.length} 条历史`,
        'success',
        5000
      )
      return true
    } catch (error) {
      console.error('Legacy migration failed:', error)
      useAppStore().showToast('迁移失败', 'error')
      return false
    }
  }

  async function initClipboardMonitor() {
    if (!isTauri()) return
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
    importLocalLegacy,
    initClipboardMonitor,
    updateClipboardMonitorSettings,
    toggleAutoStart,
    toggleSilentStart,
  }
})
