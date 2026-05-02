import { create } from 'zustand'
import { PageType, QueryResponse, AppState, ToastState } from '@/types'

interface AppStore extends AppState {
  // 页面切换
  setCurrentPage: (page: PageType) => void
  
  // 查询状态
  setQueryResult: (result: QueryResponse | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setLastQuery: (query: string) => void
  
  // 剪切板文本
  setClipboardText: (text: string) => void
  
  // Toast 提示
  showToast: (message: string, type: ToastState['type'], duration?: number) => void
  hideToast: () => void
  
  // 重置状态
  resetQueryState: () => void
}

const initialState: AppState = {
  currentPage: 'search',
  queryResult: null,
  isLoading: false,
  error: null,
  lastQuery: '',
  toast: null,
  clipboardText: '',
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setCurrentPage: (page) => set({ currentPage: page }),
  
  setQueryResult: (result) => set({ queryResult: result, error: null }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  setLastQuery: (query) => set({ lastQuery: query }),
  
  setClipboardText: (text) => set({ clipboardText: text }),
  
  showToast: (message, type, duration = 3000) => set({
    toast: { message, type, duration, visible: true }
  }),
  
  hideToast: () => set((state) => ({
    toast: state.toast ? { ...state.toast, visible: false } : null
  })),
  
  resetQueryState: () => set({ 
    queryResult: null, 
    isLoading: false, 
    error: null,
    lastQuery: '',
  }),
}))
