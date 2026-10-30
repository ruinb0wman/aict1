// LLM 调用已从客户端搬到服务端：API Key 只存在于 data/dict.db 的 settings 里。
import { v4 as uuidv4 } from 'uuid'
import type { Settings, QueryResponse, QueryResult, SentenceTranslation, GrammarCheckResult } from '../src/types'
import { isChinese, isSentence } from '../src/libs/text'

const API_TIMEOUT = 30000

// OpenCode Go 自 2026-09-05 起要求按会话带稳定 session id，否则 400 MissingSessionID
const SESSION_ID = `ses_${uuidv4()}`

function llmHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-opencode-session': SESSION_ID,
    'User-Agent': 'aict1/0.1 (server)',
  }
}

function buildChineseWordPrompt(word: string): string {
  return `你是一个专业的中英词典。请将以下中文词语翻译成英文，并按 JSON 格式返回：

中文词语：${word}

要求：
1. 列出所有常见词性及对应的英文翻译
2. 不需要音标
3. 不需要例句
4. 只返回 JSON 数据，不要其他解释

返回格式：
{
  "word": "${word}",
  "isChinese": true,
  "translation": {
    "n.": ["英文名词翻译"],
    "v.": ["英文动词翻译"]
  },
  "example": []
}`
}

function buildChineseSentencePrompt(sentence: string): string {
  return `请将以下中文句子翻译成英文：

句子：${sentence}

要求：
1. 提供准确、通顺的英文翻译
2. 只返回 JSON 格式的结果，不要其他解释

返回格式：
{
  "type": "sentence",
  "original": "${sentence}",
  "translation": "英文翻译",
  "isChinese": true
}`
}

function buildWordPrompt(word: string): string {
  return `你是一个专业的英语词典。请解释以下单词，并按 JSON 格式返回：

单词：${word}

要求：
1. 提供该单词的音标（美式）
2. 列出所有常见词性及对应的中文翻译
3. 提供 3 个实用的英文例句，每个例句附带中文翻译
4. 如果该单词有变形（如过去式、过去分词等），提供单词的原型（baseForm）
5. 列出该单词的近义词（synonyms），用英文表示
6. 列出该单词的反义词（antonyms），用英文表示
7. 只返回 JSON 数据，不要其他解释

返回格式：
{
  "word": "单词",
  "phonetic": "/音标/",
  "translation": {
    "n.": ["名词翻译"],
    "v.": ["动词翻译"]
  },
  "example": [
    {"en": "英文例句", "zh": "中文翻译"}
  ],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "baseForm": "单词原型"
}`
}

function buildSentencePrompt(sentence: string): string {
  return `请将以下英文句子翻译成中文：

句子：${sentence}

要求：
1. 提供准确、通顺的中文翻译
2. 只返回 JSON 格式的结果，不要其他解释

返回格式：
{
  "type": "sentence",
  "original": "${sentence}",
  "translation": "中文翻译"
}`
}

function buildGrammarCheckPrompt(text: string): string {
  return `请检查以下英文的语法和表达，并返回 JSON 格式：

原文：${text}

要求：
1. 提供修正后的完整英文文本
2. 列出所有修正点，包括：
   - 原文片段（original）
   - 修正后的片段（corrected）
   - 修改原因（explanation，用中文解释）
   - 修改类型（type）：grammar（语法错误）、style（表达优化）、word-choice（用词选择）、spelling（拼写错误）
3. 提供整体评价（overallFeedback，用中文）
4. 只返回 JSON 数据，不要其他解释

返回格式：
{
  "originalText": "原文",
  "correctedText": "修正后的完整文本",
  "corrections": [
    {
      "original": "原文片段",
      "corrected": "修正后的片段",
      "explanation": "修改原因（中文）",
      "type": "grammar"
    }
  ],
  "overallFeedback": "整体评价（中文）"
}`
}

/** 从可能带前后缀的文本里抠出 JSON */
function parseJson<T>(content: string, failure: string): T {
  try {
    return JSON.parse(content) as T
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(failure)
    return JSON.parse(match[0]) as T
  }
}

async function callChat(settings: Settings, prompt: string, maxTokens: number): Promise<string> {
  const { apiBaseUrl, apiKey, model, temperature } = settings
  if (!apiKey) throw new Error('请先设置 API Key')

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: llmHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT),
  }).catch((error: Error) => {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接')
    }
    throw error
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(errorData.error?.message || `请求失败: ${response.statusText}`)
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回数据格式错误')
  return content
}

export async function queryLLM(input: string, settings: Settings): Promise<QueryResponse> {
  const isChineseInput = isChinese(input)
  const isSentenceInput = isSentence(input)

  let prompt: string
  if (isChineseInput) {
    prompt = isSentenceInput ? buildChineseSentencePrompt(input) : buildChineseWordPrompt(input)
  } else {
    prompt = isSentenceInput ? buildSentencePrompt(input) : buildWordPrompt(input)
  }

  const result = parseJson<QueryResponse>(await callChat(settings, prompt, 2000), '无法解析 API 返回的数据')

  if (isSentenceInput) {
    const sentenceResult = result as SentenceTranslation
    if (sentenceResult.type !== 'sentence' || !sentenceResult.translation) {
      throw new Error('API 返回的数据格式不正确')
    }
  } else {
    const wordResult = result as QueryResult
    if (!wordResult.word || !wordResult.translation) {
      throw new Error('API 返回的数据格式不正确')
    }
    if (!wordResult.example) wordResult.example = []
  }

  return result
}

export async function checkGrammar(text: string, settings: Settings): Promise<GrammarCheckResult> {
  const result = parseJson<GrammarCheckResult>(
    await callChat(settings, buildGrammarCheckPrompt(text), 2000),
    '无法解析 API 返回的数据'
  )
  if (!result.correctedText || !result.corrections) {
    throw new Error('API 返回的数据格式不正确')
  }
  return result
}

export async function testConnection(settings: Settings): Promise<{ success: boolean; message: string }> {
  if (!settings.apiKey) return { success: false, message: '请先输入 API Key' }

  try {
    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: llmHeaders(settings.apiKey),
      body: JSON.stringify({ model: settings.model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 }),
    })
    if (response.ok) return { success: true, message: '连接成功！' }
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    return { success: false, message: `连接失败: ${errorData.error?.message || response.statusText}` }
  } catch (error) {
    return { success: false, message: `网络错误: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}
