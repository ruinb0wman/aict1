import { useState, useCallback } from 'react'
import { CheckCircle, Loader2, AlertCircle, Type, Copy, Check } from 'lucide-react'
import { checkGrammar } from '@/utils/api'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAppStore } from '@/stores/appStore'
import type { GrammarCheckResult, GrammarCorrectionType } from '@/types'

const MAX_CHARS = 500

const typeLabels: Record<GrammarCorrectionType, string> = {
  grammar: '语法错误',
  style: '表达优化',
  'word-choice': '用词选择',
  spelling: '拼写错误',
}

const typeColors: Record<GrammarCorrectionType, string> = {
  grammar: '#f56565',
  style: '#48bb78',
  'word-choice': '#4299e1',
  spelling: '#ed8936',
}

export function GrammarCheck() {
  const [text, setText] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<GrammarCheckResult | null>(null)
  const [copied, setCopied] = useState(false)
  
  const settings = useSettingsStore()
  const { showToast } = useAppStore()

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    if (newText.length <= MAX_CHARS) {
      setText(newText)
    }
  }

  const handleCheck = useCallback(async () => {
    if (!text.trim()) {
      showToast('请输入要检查的英文', 'warning')
      return
    }

    if (!settings.apiKey) {
      showToast('请先设置 API Key', 'error')
      return
    }

    setIsChecking(true)
    try {
      const grammarResult = await checkGrammar(text.trim(), settings)
      setResult(grammarResult)
      showToast('语法检查完成', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检查失败', 'error')
    } finally {
      setIsChecking(false)
    }
  }, [text, settings, showToast])

  const handleClear = () => {
    setText('')
    setResult(null)
    setCopied(false)
  }

  const handleCopy = async () => {
    if (result?.correctedText) {
      try {
        await navigator.clipboard.writeText(result.correctedText)
        setCopied(true)
        showToast('已复制到剪贴板', 'success')
        setTimeout(() => setCopied(false), 2000)
      } catch {
        showToast('复制失败', 'error')
      }
    }
  }

  return (
    <div className="grammar-check-page">
      <h2 className="page-title">语法检查</h2>
      
      <div className="grammar-input-section">
        <div className="grammar-textarea-wrapper">
          <textarea
            className="grammar-textarea"
            value={text}
            onChange={handleTextChange}
            placeholder="请输入要检查的英文文本（最多500字符）..."
            disabled={isChecking}
          />
          <div className="grammar-char-count">
            <Type size={14} strokeWidth={1.5} />
            <span className={text.length >= MAX_CHARS ? 'limit-reached' : ''}>
              {text.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        <div className="grammar-actions">
          <button
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={isChecking || (!text && !result)}
          >
            清空
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCheck}
            disabled={isChecking || !text.trim()}
          >
            {isChecking ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} className="spin" />
                检查中...
              </>
            ) : (
              <>
                <CheckCircle size={16} strokeWidth={1.5} />
                检查语法
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="grammar-result-section">
          <div className="grammar-corrected-box">
            <div className="grammar-corrected-header">
              <h3>修正后</h3>
              <button
                className="grammar-copy-btn"
                onClick={handleCopy}
                title="复制修正后的文本"
              >
                {copied ? (
                  <Check size={16} strokeWidth={1.5} />
                ) : (
                  <Copy size={16} strokeWidth={1.5} />
                )}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="grammar-corrected-text">{result.correctedText}</p>
          </div>

          {result.corrections.length > 0 && (
            <div className="grammar-corrections">
              <h3>修改详情</h3>
              <div className="corrections-list">
                {result.corrections.map((correction, index) => (
                  <div key={index} className="correction-item">
                    <div className="correction-header">
                      <span
                        className="correction-type"
                        style={{ backgroundColor: typeColors[correction.type] }}
                      >
                        {typeLabels[correction.type]}
                      </span>
                    </div>
                    <div className="correction-content">
                      <div className="correction-compare">
                        <div className="correction-original">
                          <AlertCircle size={14} strokeWidth={1.5} />
                          <span>{correction.original}</span>
                        </div>
                        <div className="correction-arrow">→</div>
                        <div className="correction-fixed">
                          <CheckCircle size={14} strokeWidth={1.5} />
                          <span>{correction.corrected}</span>
                        </div>
                      </div>
                      <p className="correction-explanation">
                        {correction.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.overallFeedback && (
            <div className="grammar-feedback">
              <h3>整体评价</h3>
              <p>{result.overallFeedback}</p>
            </div>
          )}

          {result.corrections.length === 0 && (
            <div className="grammar-perfect">
              <CheckCircle size={48} strokeWidth={1.5} />
              <p>没有发现语法错误，表达很完美！</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GrammarCheck