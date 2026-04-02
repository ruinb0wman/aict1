// Tauri API 类型声明

import type { HistoryItem, FavoriteWord, Settings } from './index';

declare global {
  interface Window {
    __TAURI__: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

// Tauri Command 参数类型
export interface InvokeArgs {
  [key: string]: unknown;
}

// Tauri Command 返回类型
export interface InvokeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 文件操作结果
export interface FileOperationResult {
  success: boolean;
  cancelled?: boolean;
  filePath?: string;
  error?: string;
}

// 导入收藏结果
export interface ImportFavoritesResult {
  success: boolean;
  cancelled?: boolean;
  favorites?: FavoriteWord[];
  totalCount?: number;
  validCount?: number;
  error?: string;
}

// 设置导入结果
export interface ImportSettingsResult {
  success: boolean;
  cancelled?: boolean;
  settings?: Partial<Settings>;
  error?: string;
}

export {};
