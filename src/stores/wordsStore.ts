import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WordEntry, QueryResult, TranslationMap, ExampleSentence } from '@/types'
import { indexedDBService } from '@/utils/indexedDB'
import { toPlain } from '@/libs/plain'
import { useAppStore } from '@/stores/appStore'

export const useWordsStore = defineStore('words', () => {
  const cachedWords = ref<WordEntry[]>([])
  const editingWord = ref<WordEntry | null>(null)
  const isLoading = ref(false)

  async function init() {
    isLoading.value = true
    try {
      cachedWords.value = await indexedDBService.getAllWords()
    } catch (error) {
      console.error('Failed to load cached words:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function getWordFromCache(word: string) {
    try {
      return await indexedDBService.getWord(word)
    } catch (error) {
      console.error('Failed to get word from cache:', error)
      return null
    }
  }

  async function saveWordToCache(word: string, queryResult: QueryResult) {
    const wordEntry = await indexedDBService.saveWord(word, toPlain(queryResult))
    const index = cachedWords.value.findIndex(w => w.id === wordEntry.id)
    if (index >= 0) {
      cachedWords.value[index] = wordEntry
    } else {
      cachedWords.value = [wordEntry, ...cachedWords.value]
    }
    return wordEntry
  }

  // 所有 updateXxx 都是同一个动作：写库（过 toPlain）→ 替换本地缓存 → 提示
  async function updateWord(
    wordId: string,
    updates: Partial<WordEntry>,
    message: string,
    failure: string
  ) {
    try {
      const updated = await indexedDBService.updateWord(wordId, toPlain(updates))
      cachedWords.value = cachedWords.value.map(w => (w.id === wordId ? updated : w))
      useAppStore().showToast(message, 'success', 2000)
      return updated
    } catch (error) {
      console.error(failure, error)
      useAppStore().showToast(failure, 'error')
    }
  }

  const updateWordTranslation = (wordId: string, translation: TranslationMap) =>
    updateWord(wordId, { translation }, '翻译已更新', '更新翻译失败')

  const updateWordExamples = (wordId: string, example: ExampleSentence[]) =>
    updateWord(wordId, { example }, '例句已更新', '更新例句失败')

  const updateWordSynonyms = (wordId: string, synonyms: string[]) =>
    updateWord(wordId, { synonyms }, '近义词已更新', '更新近义词失败')

  const updateWordAntonyms = (wordId: string, antonyms: string[]) =>
    updateWord(wordId, { antonyms }, '反义词已更新', '更新反义词失败')

  const updateWordBaseForm = (wordId: string, baseForm: string) =>
    updateWord(wordId, { baseForm }, '原型已更新', '更新原型失败')

  const addNote = (wordId: string, note: string) =>
    updateWord(wordId, { note }, '批注已保存', '保存批注失败')

  const removeNote = (wordId: string) =>
    updateWord(wordId, { note: undefined }, '批注已删除', '删除批注失败')

  function startEditing(wordEntry: WordEntry) {
    editingWord.value = wordEntry
  }

  function cancelEditing() {
    editingWord.value = null
  }

  async function saveEditing(updates: Partial<WordEntry>) {
    if (!editingWord.value) return
    const updated = await updateWord(editingWord.value.id, updates, '单词已更新', '保存失败')
    if (updated) editingWord.value = null
  }

  async function deleteWord(wordId: string) {
    try {
      await indexedDBService.deleteWord(wordId)
      cachedWords.value = cachedWords.value.filter(w => w.id !== wordId)
      useAppStore().showToast('单词已删除', 'info', 2000)
    } catch (error) {
      console.error('Failed to delete word:', error)
      useAppStore().showToast('删除失败', 'error')
    }
  }

  function isWordCached(word: string) {
    return cachedWords.value.some(w => w.word.toLowerCase() === word.toLowerCase())
  }

  return {
    cachedWords,
    editingWord,
    isLoading,
    init,
    getWordFromCache,
    saveWordToCache,
    updateWordTranslation,
    updateWordExamples,
    updateWordSynonyms,
    updateWordAntonyms,
    updateWordBaseForm,
    addNote,
    removeNote,
    startEditing,
    cancelEditing,
    saveEditing,
    deleteWord,
    isWordCached,
  }
})
