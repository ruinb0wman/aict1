import { create } from 'zustand'
import { Settings, defaultSettings } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { indexedDBService } from '@/utils/indexedDB'
import { exportData, importData } from '@/utils/tauri'
import { useFavoritesStore } from './favoritesStore'

interface SettingsState extends Settings {
  isLoading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
  testConnection: () => Promise<{ success: boolean; message: string }>
  exportAllData: () => Promise<void>
  importAllData: () => Promise<boolean>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 默认值
  ...defaultSettings,
  isLoading: false,

  // 加载设置
  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const savedSettings = await indexedDBService.getSettings()
      if (savedSettings) {
        set({
          apiBaseUrl: savedSettings.apiBaseUrl || defaultSettings.apiBaseUrl,
          apiKey: savedSettings.apiKey || defaultSettings.apiKey,
          model: savedSettings.model || defaultSettings.model,
          temperature: savedSettings.temperature ?? defaultSettings.temperature,
          historyLimit: savedSettings.historyLimit || defaultSettings.historyLimit,
          isLoading: false,
        })
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ isLoading: false })
      setTimeout(() => {
        useAppStore.getState().showToast('加载设置失败', 'error')
      }, 0)
    }
  },

  // 保存设置
  saveSettings: async (newSettings) => {
    set({ isLoading: true })
    try {
      const current = get()
      const merged: Settings = {
        apiBaseUrl: newSettings.apiBaseUrl ?? current.apiBaseUrl,
        apiKey: newSettings.apiKey ?? current.apiKey,
        model: newSettings.model ?? current.model,
        temperature: newSettings.temperature ?? current.temperature,
        historyLimit: newSettings.historyLimit ?? current.historyLimit,
      }
      await indexedDBService.saveSettings(merged)
      set({ ...merged, isLoading: false })
      setTimeout(() => {
        useAppStore.getState().showToast('设置已保存', 'success')
      }, 0)
    } catch (error) {
      console.error('Failed to save settings:', error)
      set({ isLoading: false })
      setTimeout(() => {
        useAppStore.getState().showToast('保存设置失败', 'error')
      }, 0)
    }
  },

  // 测试 API 连接
  testConnection: async () => {
    const { apiBaseUrl, apiKey, model } = get()

    if (!apiKey) {
      return { success: false, message: '请先输入 API Key' }
    }

    try {
      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }),
      })

      if (response.ok) {
        setTimeout(() => {
          useAppStore.getState().showToast('API 连接测试成功', 'success')
        }, 0)
        return { success: true, message: '连接成功！' }
      } else {
        const errorData = await response.json().catch(() => ({}))
        const message = errorData.error?.message || response.statusText
        setTimeout(() => {
          useAppStore.getState().showToast(`连接失败: ${message}`, 'error', 5000)
        }, 0)
        return {
          success: false,
          message: `连接失败: ${message}`
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      setTimeout(() => {
        useAppStore.getState().showToast(`网络错误: ${message}`, 'error', 5000)
      }, 0)
      return {
        success: false,
        message: `网络错误: ${message}`
      }
    }
  },

  // 导出所有数据（设置 + 收藏）
  exportAllData: async () => {
    try {
      const current = get()
      const settings = {
        apiBaseUrl: current.apiBaseUrl,
        apiKey: current.apiKey,
        model: current.model,
        temperature: current.temperature,
        historyLimit: current.historyLimit,
      }

      // 获取收藏数据
      const favorites = useFavoritesStore.getState().favorites

      const result = await exportData(settings, favorites)

      if (result.cancelled) {
        return
      }

      if (result.success && result.filePath) {
        setTimeout(() => {
          useAppStore.getState().showToast(`数据已导出`, 'success')
        }, 0)
      } else {
        setTimeout(() => {
          useAppStore.getState().showToast(result.error || '导出失败', 'error')
        }, 0)
      }
    } catch (error) {
      console.error('Export data failed:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('导出失败', 'error')
      }, 0)
    }
  },

  // 导入所有数据（设置 + 收藏）
  importAllData: async () => {
    try {
      const result = await importData()

      if (result.cancelled) {
        return false
      }

      if (!result.success) {
        setTimeout(() => {
          useAppStore.getState().showToast(result.error || '导入失败', 'error')
        }, 0)
        return false
      }

      // 导入设置
      if (result.settings) {
        const importedSettings = result.settings
        const newSettings = {
          apiBaseUrl: String(importedSettings.apiBaseUrl || ''),
          apiKey: String(importedSettings.apiKey || ''),
          model: String(importedSettings.model || ''),
          temperature: Number(importedSettings.temperature) || 0.7,
          historyLimit: Number(importedSettings.historyLimit) || 100,
        }
        await get().saveSettings(newSettings)
      }

      // 导入收藏
      if (result.favorites && result.favorites.length > 0) {
        await useFavoritesStore.getState().importFavoritesFromData(result.favorites)
      }

      setTimeout(() => {
        useAppStore.getState().showToast('数据已导入', 'success')
      }, 0)

      return true
    } catch (error) {
      console.error('Import data failed:', error)
      setTimeout(() => {
        useAppStore.getState().showToast('导入失败', 'error')
      }, 0)
      return false
    }
  },
}))
