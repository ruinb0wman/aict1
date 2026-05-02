// Tauri API 封装工具

import { invoke } from '@tauri-apps/api/core'
import type { Settings, FavoriteWord } from '@/types'
import type { FileOperationResult, ImportDataResult } from '@/types/tauri'

// 生成 yyyy-MM-dd_hh-mm-ss 格式的文件名
function generateFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`
}

// 导出合并数据（设置 + 收藏）
export async function exportData(
  settings: Settings,
  favorites: FavoriteWord[]
): Promise<FileOperationResult> {
  try {
    console.log('[Export] Starting data export...')
    const defaultFileName = generateFileName()
    const exportData = {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      settings,
      favorites,
    }
    const result = await invoke<FileOperationResult>('export_data', {
      data: exportData,
      defaultFileName,
    })
    console.log('[Export] Data export result:', result)
    return result
  } catch (error) {
    console.error('[Export] Data export error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
    }
  }
}

// 导入合并数据（设置 + 收藏）
export async function importData(): Promise<ImportDataResult> {
  try {
    const result = await invoke<ImportDataResult>('import_data')
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导入失败',
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
  let selectedVoice =
    voices.find(
      (v) =>
        v.name.includes('Google US English') ||
        v.name.includes('Microsoft David') ||
        v.name.includes('Samantha')
    ) || voices.find((v) => v.lang.startsWith('en'))

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

// 剪切板监听翻译设置
export async function updateClipboardMonitor(
  enabled: boolean,
  intervalMs: number
): Promise<void> {
  try {
    await invoke('update_clipboard_monitor', { enabled, intervalMs })
  } catch (error) {
    console.error('Failed to update clipboard monitor:', error)
    throw error
  }
}

export async function getClipboardMonitorState(): Promise<{ enabled: boolean; intervalMs: number }> {
  try {
    return await invoke('get_clipboard_monitor_state')
  } catch (error) {
    console.error('Failed to get clipboard monitor state:', error)
    return { enabled: false, intervalMs: 1000 }
  }
}

// 开机自启设置
export async function getAutoStart(): Promise<boolean> {
  try {
    return await invoke<boolean>('get_autostart')
  } catch (error) {
    console.error('Failed to get autostart state:', error)
    return false
  }
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  try {
    await invoke('set_autostart', { enabled })
  } catch (error) {
    console.error('Failed to set autostart:', error)
    throw error
  }
}

// 静默启动设置
export async function setSilentStart(enabled: boolean): Promise<void> {
  try {
    await invoke('set_silent_start', { enabled })
  } catch (error) {
    console.error('Failed to set silent start:', error)
    throw error
  }
}
