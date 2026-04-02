// Tauri API 封装工具

import { invoke } from '@tauri-apps/api/core'
import type { Settings, FavoriteWord } from '@/types'
import type { FileOperationResult, ImportFavoritesResult, ImportSettingsResult } from '@/types/tauri'

// 设置导入导出
export async function exportSettings(settings: Settings): Promise<FileOperationResult> {
  try {
    const result = await invoke<FileOperationResult>('export_settings', { settings })
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    }
  }
}

export async function importSettings(): Promise<ImportSettingsResult> {
  try {
    const result = await invoke<ImportSettingsResult>('import_settings')
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导入失败'
    }
  }
}

// 收藏导入导出
export async function exportFavorites(favorites: FavoriteWord[]): Promise<FileOperationResult> {
  try {
    const result = await invoke<FileOperationResult>('export_favorites', { favorites })
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    }
  }
}

export async function importFavorites(): Promise<ImportFavoritesResult> {
  try {
    const result = await invoke<ImportFavoritesResult>('import_favorites')
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导入失败'
    }
  }
}

// 语音播放（使用 Web Speech API）
export async function speak(text: string): Promise<boolean> {
  if (!('speechSynthesis' in window)) {
    console.error('浏览器不支持 Web Speech API')
    return false
  }

  const synth = window.speechSynthesis
  
  // 获取语音列表
  let voices = synth.getVoices()
  
  // 如果语音列表为空，等待加载
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      const handleVoicesChanged = () => {
        voices = synth.getVoices()
        synth.onvoiceschanged = null
        resolve()
      }
      synth.onvoiceschanged = handleVoicesChanged
      
      // 超时处理
      setTimeout(() => {
        synth.onvoiceschanged = null
        resolve()
      }, 1000)
    })
  }

  // 选择英语语音
  let selectedVoice = voices.find(v => 
    v.name.includes('Google US English') || 
    v.name.includes('Microsoft David') ||
    v.name.includes('Samantha')
  ) || voices.find(v => v.lang.startsWith('en'))

  if (!selectedVoice && voices.length > 0) {
    selectedVoice = voices[0]
  }

  // 取消之前的播放
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  
  if (selectedVoice) {
    utterance.voice = selectedVoice
  }
  
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1

  synth.speak(utterance)
  return true
}

// 窗口控制（仅桌面端）
export async function hideWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().hide()
  } catch {
    // 移动端可能不支持，忽略错误
    console.log('hideWindow not supported on this platform')
  }
}

export async function minimizeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  } catch {
    console.log('minimizeWindow not supported on this platform')
  }
}

export async function closeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  } catch {
    console.log('closeWindow not supported on this platform')
  }
}

// 平台检测
export async function getPlatform(): Promise<'desktop' | 'mobile'> {
  try {
    return await invoke<'desktop' | 'mobile'>('get_platform')
  } catch {
    // 如果命令不存在，默认检测
    return window.innerWidth < 768 ? 'mobile' : 'desktop'
  }
}

// 打开开发者工具
export async function openDevTools(): Promise<void> {
  try {
    await invoke('open_devtools')
  } catch {
    console.log('openDevTools not supported on this platform')
  }
}
