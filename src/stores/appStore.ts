import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PageType, QueryResponse, ToastState } from '@/types'

export const useAppStore = defineStore('app', () => {
  const currentPage = ref<PageType>('search')
  const queryResult = ref<QueryResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastQuery = ref('')
  const toast = ref<ToastState | null>(null)
  const clipboardText = ref('')

  function setCurrentPage(page: PageType) {
    currentPage.value = page
  }

  function setQueryResult(result: QueryResponse | null) {
    queryResult.value = result
    error.value = null
  }

  function setLoading(value: boolean) {
    isLoading.value = value
  }

  function setError(message: string | null) {
    error.value = message
  }

  function setLastQuery(query: string) {
    lastQuery.value = query
  }

  function setClipboardText(text: string) {
    clipboardText.value = text
  }

  function showToast(message: string, type: ToastState['type'], duration = 3000) {
    toast.value = { message, type, duration, visible: true }
  }

  function hideToast() {
    if (toast.value) toast.value.visible = false
  }

  function resetQueryState() {
    queryResult.value = null
    isLoading.value = false
    error.value = null
    lastQuery.value = ''
  }

  return {
    currentPage,
    queryResult,
    isLoading,
    error,
    lastQuery,
    toast,
    clipboardText,
    setCurrentPage,
    setQueryResult,
    setLoading,
    setError,
    setLastQuery,
    setClipboardText,
    showToast,
    hideToast,
    resetQueryState,
  }
})
