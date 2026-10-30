import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types'
import { defaultSettings } from '@/types'
import { store } from '@/utils/store'
import { isTauri } from '@/libs/env'
import { testAPIConnection } from '@/utils/api'
import { useAppStore } from '@/stores/appStore'
import { useFavoritesStore } from '@/stores/favoritesStore'

export const useSettingsStore = defineStore('settings', () => {
  const apiBaseUrl = ref(defaultSettings.apiBaseUrl)
  const apiKey = ref(defaultSettings.apiKey)
  const model = ref(defaultSettings.model)
  const temperature = ref(defaultSettings.temperature)
  const historyLimit = ref(defaultSettings.historyLimit)
  const isLoading = ref(false)

  function snapshot(): Settings {
    return {
      apiBaseUrl: apiBaseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
      temperature: temperature.value,
      historyLimit: historyLimit.value,
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

  /** 服务器地址变了：把依赖服务端的数据全部重拉 */
  async function serverChanged() {
    const { useHistoryStore } = await import('@/stores/historyStore')
    const { useWordsStore } = await import('@/stores/wordsStore')
    await Promise.all([
      loadSettings(),
      useFavoritesStore().loadFavorites(),
      useHistoryStore().loadHistory(),
      useWordsStore().init(),
    ])
    useAppStore().showToast('已切换到新服务器', 'success')
  }

  /** 服务端导出整份数据，前端触发下载。移动端 WebView 不支持下载，所以按钮在那里隐藏。 */
  async function exportAllData() {
    try {
      const raw = await store.exportRaw()
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `aict1-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      useAppStore().showToast('数据已导出', 'success')
    } catch (error) {
      console.error('Export data failed:', error)
      useAppStore().showToast('导出失败', 'error')
    }
  }

  /** payload 由 Settings.vue 读文件后传入 */
  async function importAllData(payload: unknown) {
    try {
      const { imported, skipped } = await store.importData(payload)
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

  /** 一次性迁移：旧版数据在客户端 IndexedDB 里，读出来整体 POST 给服务端 */
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

  return {
    apiBaseUrl,
    apiKey,
    model,
    temperature,
    historyLimit,
    isLoading,
    loadSettings,
    saveSettings,
    testConnection,
    exportAllData,
    importAllData,
    importLocalLegacy,
    serverChanged,
    isTauri,
  }
})
