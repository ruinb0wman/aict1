import { useState, useCallback } from 'react'
import { Star, Edit2, Save, X, FileText, Trash2, MessageSquare, Volume2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useWordsStore } from '@/stores/wordsStore'
import { isSentence } from '@/utils/api'
import { speak } from '@/utils/tauri'

import type { QueryResult as QueryResultType, SentenceTranslation, TranslationMap, ExampleSentence } from '@/types'

// 单词结果编辑组件
function WordResultEdit({ 
  wordResult, 
  onSave, 
  onCancel 
}: { 
  wordResult: QueryResultType
  onSave: (translation: TranslationMap, examples: ExampleSentence[]) => void
  onCancel: () => void 
}) {
  const [translation, setTranslation] = useState<TranslationMap>(wordResult.translation)
  const [examples, setExamples] = useState<ExampleSentence[]>(wordResult.example || [])
  const [newPos, setNewPos] = useState('')
  const [newTranslation, setNewTranslation] = useState('')
  const [newEn, setNewEn] = useState('')
  const [newZh, setNewZh] = useState('')

  const handleAddTranslation = () => {
    if (newPos && newTranslation) {
      setTranslation(prev => ({
        ...prev,
        [newPos]: newTranslation.split(/[,，;；]/).map(s => s.trim()).filter(Boolean)
      }))
      setNewPos('')
      setNewTranslation('')
    }
  }

  const handleRemoveTranslation = (pos: string) => {
    setTranslation(prev => {
      const newTranslation = { ...prev }
      delete newTranslation[pos]
      return newTranslation
    })
  }

  const handleAddExample = () => {
    if (newEn && newZh) {
      setExamples(prev => [...prev, { en: newEn, zh: newZh }])
      setNewEn('')
      setNewZh('')
    }
  }

  const handleRemoveExample = (index: number) => {
    setExamples(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="word-result-edit">
      <div className="edit-section">
        <h4 className="edit-section-title">翻译</h4>
        {Object.entries(translation).map(([pos, translations]) => (
          <div key={pos} className="edit-translation-item">
            <span className="pos-tag">{pos}</span>
            <span className="translation-text">{translations.join('；')}</span>
            <button className="edit-remove-btn" onClick={() => handleRemoveTranslation(pos)}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <div className="edit-add-row">
          <input
            type="text"
            placeholder="词性 (如: n.)"
            value={newPos}
            onChange={(e) => setNewPos(e.target.value)}
            className="edit-input-small"
          />
          <input
            type="text"
            placeholder="翻译 (用逗号分隔)"
            value={newTranslation}
            onChange={(e) => setNewTranslation(e.target.value)}
            className="edit-input"
          />
          <button className="edit-add-btn" onClick={handleAddTranslation}>添加</button>
        </div>
      </div>

      <div className="edit-section">
        <h4 className="edit-section-title">例句</h4>
        {examples.map((example, index) => (
          <div key={index} className="edit-example-item">
            <p className="example-en">{example.en}</p>
            <p className="example-zh">{example.zh}</p>
            <button className="edit-remove-btn" onClick={() => handleRemoveExample(index)}>
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <div className="edit-add-row vertical">
          <input
            type="text"
            placeholder="英文例句"
            value={newEn}
            onChange={(e) => setNewEn(e.target.value)}
            className="edit-input"
          />
          <input
            type="text"
            placeholder="中文翻译"
            value={newZh}
            onChange={(e) => setNewZh(e.target.value)}
            className="edit-input"
          />
          <button className="edit-add-btn" onClick={handleAddExample}>添加例句</button>
        </div>
      </div>

      <div className="edit-actions">
        <button className="edit-save-btn" onClick={() => onSave(translation, examples)}>
          <Save size={16} strokeWidth={1.5} />
          保存
        </button>
        <button className="edit-cancel-btn" onClick={onCancel}>
          <X size={16} strokeWidth={1.5} />
          取消
        </button>
      </div>
    </div>
  )
}

// 批注组件
function NoteSection({ 
  wordId, 
  note, 
  onSave 
}: { 
  wordId: string
  note?: string
  onSave: (note: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [noteText, setNoteText] = useState(note || '')
  const { removeNote } = useWordsStore()

  const handleSave = () => {
    onSave(noteText)
    setIsEditing(false)
  }

  const handleRemove = () => {
    removeNote(wordId)
    setNoteText('')
  }

  if (isEditing) {
    return (
      <div className="note-section editing">
        <textarea
          className="note-textarea"
          placeholder="添加批注..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
        />
        <div className="note-actions">
          <button className="note-save-btn" onClick={handleSave}>
            <Save size={14} strokeWidth={1.5} />
            保存
          </button>
          <button className="note-cancel-btn" onClick={() => setIsEditing(false)}>
            <X size={14} strokeWidth={1.5} />
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="note-section">
      {note ? (
        <div className="note-content">
          <div className="note-header">
            <MessageSquare size={14} strokeWidth={1.5} />
            <span>批注</span>
          </div>
          <p className="note-text">{note}</p>
          <div className="note-actions">
            <button className="note-edit-btn" onClick={() => setIsEditing(true)}>
              <Edit2 size={14} strokeWidth={1.5} />
              编辑
            </button>
            <button className="note-delete-btn" onClick={handleRemove}>
              <Trash2 size={14} strokeWidth={1.5} />
              删除
            </button>
          </div>
        </div>
      ) : (
        <button className="note-add-btn" onClick={() => setIsEditing(true)}>
          <FileText size={14} strokeWidth={1.5} />
          添加批注
        </button>
      )}
    </div>
  )
}

export function QueryResultView() {
  const { queryResult, isLoading, error, lastQuery } = useAppStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { cachedWords, updateWordTranslation, updateWordExamples, addNote } = useWordsStore()
  const [isEditing, setIsEditing] = useState(false)

  // 使用 Web Speech API 播放单词发音
  const speakWord = useCallback((word: string) => {
    speak(word)
  }, [])

  // 从缓存获取当前单词的完整数据（包含批注）
  const getCachedWordData = (word: string) => {
    return cachedWords.find(w => w.word.toLowerCase() === word.toLowerCase())
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="query-result loading">
        <div className="loading-spinner"></div>
        <p className="loading-text">正在查询...</p>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="query-result error">
        <p className="error-message">{error}</p>
      </div>
    )
  }

  // 空状态
  if (!queryResult) {
    return (
      <div className="query-result empty">
        <p className="empty-text">输入单词或句子开始查询</p>
      </div>
    )
  }

  // 判断是句子翻译还是单词查询
  const isSentenceResult = isSentence(lastQuery) || 'type' in queryResult
  
  // 判断是否为中译英结果
  const isChineseResult = 'isChinese' in queryResult && queryResult.isChinese

  if (isSentenceResult) {
    // 句子翻译结果
    const sentenceResult = queryResult as SentenceTranslation
    return (
      <div className="query-result">
        <div className="sentence-result">
          <h3 className="sentence-original">{sentenceResult.original || lastQuery}</h3>
          <p className="sentence-translation">{sentenceResult.translation}</p>
        </div>
      </div>
    )
  }

  // 单词查询结果
  const wordResult = queryResult as QueryResultType
  const favorited = isFavorite(wordResult.word)
  const cachedWord = getCachedWordData(wordResult.word)

  const handleToggleFavorite = () => {
    // 中译英结果不支持收藏
    if (isChineseResult) return
    toggleFavorite(wordResult.word, wordResult)
  }

  const handleSaveEdit = async (translation: TranslationMap, examples: ExampleSentence[]) => {
    if (cachedWord) {
      await updateWordTranslation(cachedWord.id, translation)
      await updateWordExamples(cachedWord.id, examples)
      // 更新当前显示的查询结果
      useAppStore.getState().setQueryResult({
        ...wordResult,
        translation,
        example: examples,
      })
    }
    setIsEditing(false)
  }

  const handleSaveNote = async (note: string) => {
    if (cachedWord) {
      await addNote(cachedWord.id, note)
    }
  }

  return (
    <div className="query-result">
      {/* 单词标题和音标 */}
      <div className="word-header">
        <div className="word-title-row">
          <h2 className="word-title">{wordResult.word}</h2>
          <div className="word-actions">
            <button 
              className="edit-toggle-btn" 
              title={isEditing ? '取消编辑' : '编辑单词'}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <X size={18} strokeWidth={1.5} /> : <Edit2 size={18} strokeWidth={1.5} />}
            </button>
            {!isChineseResult && (
              <button
                className={`favorite-btn ${favorited ? 'active' : ''}`}
                title={favorited ? '取消收藏' : '收藏'}
                onClick={handleToggleFavorite}
              >
                <Star
                  size={20}
                  strokeWidth={1.5}
                  fill={favorited ? 'currentColor' : 'none'}
                />
              </button>
            )}
          </div>
        </div>
        {/* 中译英结果不显示音标和发音按钮 */}
        {wordResult.phonetic && !isChineseResult && (
          <div className="word-phonetic">
            <span>{wordResult.phonetic}</span>
            <button 
              className="speak-btn"
              title="播放发音"
              onClick={() => speakWord(wordResult.word)}
            >
              <Volume2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <WordResultEdit 
          wordResult={wordResult} 
          onSave={handleSaveEdit} 
          onCancel={() => setIsEditing(false)} 
        />
      ) : (
        <>
          {/* 词性和翻译 */}
          <div className="word-translations">
            {Object.entries(wordResult.translation).map(([pos, translations]) => (
              <div key={pos} className="translation-item">
                <span className="pos-tag">{pos}</span>
                <span className="translation-text">
                  {translations.join('；')}
                </span>
              </div>
            ))}
          </div>

          {/* 中译英结果不显示例句 */}
          {wordResult.example && wordResult.example.length > 0 && !isChineseResult && (
            <div className="word-examples">
              <h4 className="section-title">例句</h4>
              {wordResult.example.map((example, index) => (
                <div key={index} className="example-item">
                  <p className="example-en">{example.en}</p>
                  <p className="example-zh">{example.zh}</p>
                </div>
              ))}
            </div>
          )}

          {/* 批注 - 中译英结果不显示 */}
          {cachedWord && !isChineseResult && (
            <NoteSection 
              wordId={cachedWord.id} 
              note={cachedWord.note} 
              onSave={handleSaveNote} 
            />
          )}
        </>
      )}
    </div>
  )
}