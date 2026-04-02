import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Check, X, RotateCcw, BookOpen } from 'lucide-react'
import { useFavoritesStore } from '@/stores/favoritesStore'
import type { FavoriteWord } from '@/types'

// 复习卡片组件
function ReviewCard({
  word,
  isFlipped,
  onFlip
}: {
  word: FavoriteWord
  isFlipped: boolean
  onFlip: () => void
}) {
  return (
    <div
      className="review-card-container"
      onClick={onFlip}
    >
      <div className={`review-card ${isFlipped ? 'flipped' : ''}`}>
        {/* 卡片正面 */}
        <div className="review-card-front">
          <div className="review-card-content">
            <h2 className="review-word">{word.word}</h2>
            {word.phonetic && (
              <span className="review-phonetic">{word.phonetic}</span>
            )}
            <p className="review-hint">点击翻转查看答案</p>
          </div>
          <div className="review-card-badge">
            <BookOpen size={16} strokeWidth={1.5} />
            <span>第 {word.reviewCount + 1} 次复习</span>
          </div>
        </div>

        {/* 卡片背面 */}
        <div className="review-card-back">
          <div className="review-card-content">
            <h3 className="review-word-small">{word.word}</h3>
            <div className="review-translation">
              <span className="review-translation-text">{word.translation}</span>
            </div>

            {/* 例句 */}
            {word.queryData.example && word.queryData.example.length > 0 && (
              <div className="review-examples">
                <h4 className="review-section-title">例句</h4>
                {word.queryData.example.slice(0, 2).map((example, index) => (
                  <div key={index} className="review-example-item">
                    <p className="review-example-en">{example.en}</p>
                    <p className="review-example-zh">{example.zh}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 掌握程度指示器 */}
          <div className="review-mastery">
            <span className="review-mastery-label">掌握程度</span>
            <div className="review-mastery-dots">
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={`review-mastery-dot ${level < word.masteryLevel ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 空状态组件
function EmptyState() {
  return (
    <div className="review-empty">
      <BookOpen size={48} strokeWidth={1.5} className="review-empty-icon" />
      <h3 className="review-empty-title">暂无收藏单词</h3>
      <p className="review-empty-text">先去收藏一些单词，再来复习吧~</p>
    </div>
  )
}

// 完成状态组件
function CompleteState({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="review-complete">
      <div className="review-complete-icon">
        <Check size={48} strokeWidth={1.5} />
      </div>
      <h3 className="review-complete-title">今日复习完成！</h3>
      <p className="review-complete-text">继续保持，你的词汇量会越来越丰富</p>
      <button className="review-restart-btn" onClick={onRestart}>
        <RotateCcw size={16} strokeWidth={1.5} />
        重新开始
      </button>
    </div>
  )
}

// 主复习页面组件
export function Review() {
  const { favorites, getReviewWords, updateReviewStatus } = useFavoritesStore()
  const [reviewWords, setReviewWords] = useState<FavoriteWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // 初始化复习列表
  useEffect(() => {
    const words = getReviewWords()
    // 过滤掉已完全掌握的单词（掌握程度 >= 4）
    const wordsToReview = words.filter(w => w.masteryLevel < 4)
    setReviewWords(wordsToReview)
    setCurrentIndex(0)
    setIsFlipped(false)
    setIsCompleted(wordsToReview.length === 0 && favorites.length > 0)
  }, [favorites, getReviewWords])

  const currentWord = reviewWords[currentIndex]

  // 计算今日复习进度
  const todayReviewedCount = favorites.filter(f => {
    if (!f.lastReviewedAt) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return f.lastReviewedAt >= today.getTime()
  }).length

  // 翻转卡片
  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev)
  }, [])

  // 标记为认识
  const handleKnown = useCallback(async () => {
    if (!currentWord) return
    await updateReviewStatus(currentWord.id, true)

    if (currentIndex < reviewWords.length - 1) {
      setIsFlipped(false)
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150)
    } else {
      setIsCompleted(true)
    }
  }, [currentWord, currentIndex, reviewWords.length, updateReviewStatus])

  // 标记为不认识
  const handleUnknown = useCallback(async () => {
    if (!currentWord) return
    await updateReviewStatus(currentWord.id, false)

    if (currentIndex < reviewWords.length - 1) {
      setIsFlipped(false)
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150)
    } else {
      setIsCompleted(true)
    }
  }, [currentWord, currentIndex, reviewWords.length, updateReviewStatus])

  // 跳过当前单词
  const handleSkip = useCallback(() => {
    if (currentIndex < reviewWords.length - 1) {
      setIsFlipped(false)
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150)
    } else {
      setIsCompleted(true)
    }
  }, [currentIndex, reviewWords.length])

  // 重新开始
  const handleRestart = useCallback(() => {
    const words = getReviewWords()
    const wordsToReview = words.filter(w => w.masteryLevel < 4)
    setReviewWords(wordsToReview)
    setCurrentIndex(0)
    setIsFlipped(false)
    setIsCompleted(false)
  }, [getReviewWords])

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 防止在输入框中触发
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handleFlip()
          break
        case 'ArrowLeft':
          if (isFlipped) {
            handleUnknown()
          }
          break
        case 'ArrowRight':
          if (isFlipped) {
            handleKnown()
          }
          break
        case 'Escape':
          // 让 App.tsx 处理隐藏窗口
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFlip, handleKnown, handleUnknown, isFlipped])

  // 如果没有收藏单词
  if (favorites.length === 0) {
    return <EmptyState />
  }

  // 如果复习完成
  if (isCompleted || reviewWords.length === 0) {
    return <CompleteState onRestart={handleRestart} />
  }

  return (
    <div className="review-page">
      {/* 进度条 */}
      <div className="review-progress-bar">
        <div className="review-progress-info">
          <span className="review-progress-text">
            {currentIndex + 1} / {reviewWords.length}
          </span>
          <span className="review-progress-today">
            今日已复习: {todayReviewedCount}
          </span>
        </div>
        <div className="review-progress-track">
          <div
            className="review-progress-fill"
            style={{ width: `${((currentIndex + 1) / reviewWords.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 复习卡片 */}
      <div className="review-card-wrapper" style={{ marginTop: 10 }}>
        <ReviewCard
          word={currentWord}
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />
      </div>

      {/* 操作按钮 */}
      <div className="review-actions" style={{ marginTop: 10 }}>
        {!isFlipped ? (
          // 未翻转时：显示翻转按钮和跳过按钮
          <>
            <button
              className="review-btn review-btn-skip"
              onClick={handleSkip}
              style={{ height: 30 }}
            >
              <ChevronRight size={18} strokeWidth={1.5} />
              跳过
            </button>
            <button
              className="review-btn review-btn-flip"
              onClick={handleFlip}
              style={{ height: 30 }}
            >
              <RotateCcw size={18} strokeWidth={1.5} />
              翻转卡片
            </button>
          </>
        ) : (
          // 翻转后：显示认识/不认识按钮
          <>
            <button
              className="review-btn review-btn-unknown"
              onClick={handleUnknown}
              style={{ height: 30 }}
            >
              <X size={18} strokeWidth={1.5} />
              不认识
            </button>
            <button
              className="review-btn review-btn-known"
              onClick={handleKnown}
              style={{ height: 30 }}
            >
              <Check size={18} strokeWidth={1.5} />
              认识
            </button>
          </>
        )}
      </div>

      {/* 键盘快捷键提示 */}
      <div className="review-shortcuts" >
        <span className="review-shortcut">
          <kbd>Space</kbd> 翻转
        </span>
        <span className="review-shortcut">
          <kbd>←</kbd> 不认识
        </span>
        <span className="review-shortcut">
          <kbd>→</kbd> 认识
        </span>
      </div>
    </div>
  )
}
