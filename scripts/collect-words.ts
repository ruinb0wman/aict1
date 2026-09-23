#!/usr/bin/env bun
/**
 * Word Collection Script
 *
 * Batches common English words to an LLM API, collects dictionary data
 * in the project's QueryResult format, and outputs as a single JSON array.
 *
 * Usage:
 *   bun run scripts/collect-words.ts \
 *     --api-key "sk-..." \
 *     --base-url "https://api.openai.com/v1" \
 *     --model "gpt-3.5-turbo"
 *
 * Optional:
 *   --temperature 0.3        LLM temperature (default: 0.3)
 *   --batch-size 10          Words per batch (default: 10)
 *   --delay 1500             Delay between batches in ms (default: 1500)
 *   --max-retries 3          Max retries per batch (default: 3)
 *   --output scripts/output/words.json  Output file (default: scripts/output/words.json)
 *   --progress scripts/output/progress.json  Progress file (default: scripts/output/progress.json)
 *   --start-from 0           Batch index to start from (default: 0)
 *   --limit 0                Max words to process (0 = all, default: 0)
 */

// ==================== Types ====================

interface TranslationMap {
  [key: string]: string[]
}

interface ExampleSentence {
  en: string
  zh: string
}

interface QueryResult {
  word: string
  phonetic?: string
  translation: TranslationMap
  example: ExampleSentence[]
  synonyms?: string[]
  antonyms?: string[]
  baseForm?: string
  isChinese?: boolean
}

// ==================== CLI Parsing ====================

interface CLIConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  batchSize: number
  delay: number
  maxRetries: number
  outputPath: string
  progressPath: string
  startFrom: number
  limit: number
  wordList: string
}

function parseArgs(): CLIConfig {
  const args = process.argv.slice(2)
  const config: CLIConfig = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    batchSize: 10,
    delay: 1500,
    maxRetries: 3,
    outputPath: 'scripts/output/words.json',
    progressPath: 'scripts/output/progress.json',
    startFrom: 0,
    limit: 0,
    wordList: 'scripts/default-words.json',
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
        config.apiKey = args[++i]
        break
      case '--base-url':
        config.baseUrl = args[++i]
        break
      case '--model':
        config.model = args[++i]
        break
      case '--temperature':
        config.temperature = parseFloat(args[++i])
        break
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10)
        break
      case '--delay':
        config.delay = parseInt(args[++i], 10)
        break
      case '--max-retries':
        config.maxRetries = parseInt(args[++i], 10)
        break
      case '--output':
        config.outputPath = args[++i]
        break
      case '--progress':
        config.progressPath = args[++i]
        break
      case '--start-from':
        config.startFrom = parseInt(args[++i], 10)
        break
      case '--limit':
        config.limit = parseInt(args[++i], 10)
        break
      case '--word-list':
        config.wordList = args[++i]
        break
      case '--help':
      case '-h':
        console.log(`
Usage: bun run scripts/collect-words.ts [options]

Required:
  --api-key <key>           LLM API key

Optional:
  --base-url <url>          API base URL (default: https://api.openai.com/v1)
  --model <model>           Model name (default: gpt-3.5-turbo)
  --temperature <n>         Temperature 0-1 (default: 0.3)
  --batch-size <n>          Words per batch (default: 10)
  --delay <ms>              Delay between batches (default: 1500)
  --max-retries <n>         Max retries per batch (default: 3)
  --output <path>           Output JSON file (default: scripts/output/words.json)
  --progress <path>         Progress file (default: scripts/output/progress.json)
  --start-from <n>          Resume from batch index (default: 0)
  --limit <n>               Max words to process (0 = all, default: 0)
  --word-list <path>        Word list JSON file (default: scripts/default-words.json)
  --help, -h                Show this help
`)
        process.exit(0)
    }
  }

  if (!config.apiKey) {
    console.error('Error: --api-key is required')
    process.exit(1)
  }

  return config
}

// ==================== Word List Loading ====================

async function loadWords(wordList: string, defaultPath: string): Promise<string[]> {
  const path = wordList || defaultPath

  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) {
      console.error(`Error: Word list file not found: ${path}`)
      process.exit(1)
    }

    const raw = await file.json()

    if (!Array.isArray(raw) || raw.length === 0) {
      console.error(`Error: Word list file must be a non-empty JSON array: ${path}`)
      process.exit(1)
    }

    if (!raw.every((w: any) => typeof w === 'string' && w.length > 0)) {
      console.error(`Error: Word list must contain only non-empty strings: ${path}`)
      process.exit(1)
    }

    const unique = [...new Set(raw.map((w: string) => w.toLowerCase()))].sort()
    console.log(`  Loaded ${raw.length} words (${unique.length} unique) from ${path}`)
    return unique
  } catch (error) {
    console.error(`Error reading word list file: ${path}`, error)
    process.exit(1)
  }
}

// ==================== Prompt Building ====================

function buildPrompt(words: string[]): string {
  return `You are a professional English-Chinese dictionary generating machine-readable JSON. This is an API call — your output will be parsed by JSON.parse(). Any deviation will break the system.

Words to process: ${words.join(', ')}

For EACH word, generate one JSON object with these fields:
1. "word": the word itself (lowercase)
2. "phonetic": American English IPA between slashes (e.g., "/ˈeksəmpəl/")
3. "translation": object keyed by part-of-speech abbreviations ("n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.") with arrays of Chinese translations
4. "example": array of 2-3 objects, each with "en" (English sentence) and "zh" (Chinese translation)
5. "synonyms": array of English synonyms (can be empty array)
6. "antonyms": array of English antonyms (can be empty array)
7. "baseForm": set to the word itself for regular words; for inflected forms (e.g., "went" -> "go") set to the root word

CRITICAL RULES:
- [BEGIN_JSON] and [END_JSON] markers must surround your JSON output. Nothing outside these markers.
- The entire JSON must be VALID — all string values must have properly escaped quotes, no unescaped backticks, no unescaped newlines inside strings.
- No markdown, no code fences, no \`\`\` anywhere.
- Include ALL ${words.length} words in the array — no more, no fewer.
- Empty arrays ([]) are preferred over null or omitted fields.

[BEGIN_JSON]
[
  {
    "word": "example",
    "phonetic": "/ɪɡˈzæmpəl/",
    "translation": {
      "n.": ["例子", "榜样"],
      "v.": ["举例说明"]
    },
    "example": [
      {"en": "This is a good example.", "zh": "这是一个很好的例子。"},
      {"en": "She set an example for others.", "zh": "她为其他人树立了榜样。"}
    ],
    "synonyms": ["instance", "illustration", "sample"],
    "antonyms": [],
    "baseForm": "example"
  }
]
[END_JSON]`
}

// ==================== API Call ====================

interface APIConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

async function callLLM(prompt: string, config: APIConfig, retries: number): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: 16384,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 2000
          console.log(`  ⚠ API error: ${errMsg}. Retrying in ${delay}ms... (${attempt + 1}/${retries})`)
          await sleep(delay)
          continue
        }
        throw new Error(errMsg)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        if (attempt < retries) {
          console.log(`  ⚠ Empty response. Retrying... (${attempt + 1}/${retries})`)
          await sleep(2000)
          continue
        }
        throw new Error('Empty response from API')
      }

      return content
    } catch (error) {
      clearTimeout((error as any)?.timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`  ⚠ Request timeout. Retrying... (${attempt + 1}/${retries})`)
          await sleep(2000)
          continue
        }
        throw new Error('Request timed out after all retries')
      }
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 2000
        console.log(`  ⚠ Error: ${error}. Retrying in ${delay}ms... (${attempt + 1}/${retries})`)
        await sleep(delay)
        continue
      }
      throw error
    }
  }

  throw new Error('Failed after all retries')
}

// ==================== JSON Parsing & Validation ====================

function extractJSON(text: string): string {
  const trimmed = text.trim()

  // Strategy 1: Extract from boundary markers [BEGIN_JSON] ... [END_JSON]
  const beginMatch = trimmed.match(/\[BEGIN_JSON\]\s*([\s\S]*?)\s*\[END_JSON\]/)
  if (beginMatch) {
    return beginMatch[1].trim()
  }

  // Strategy 2: Bracket-counting — find first '[' and its matching ']'
  // This correctly handles nested brackets and ignores trailing text
  const firstBracket = trimmed.indexOf('[')
  if (firstBracket >= 0) {
    let depth = 0
    let inString = false
    let escape = false
    for (let i = firstBracket; i < trimmed.length; i++) {
      const ch = trimmed[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\' && inString) {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (!inString) {
        if (ch === '[') depth++
        else if (ch === ']') {
          depth--
          if (depth === 0) {
            const candidate = trimmed.slice(firstBracket, i + 1)
            // Verify it parses
            try {
              JSON.parse(candidate)
              return candidate
            } catch {
              // Bracket match but not valid JSON — continue past this bracket
            }
          }
        }
      }
    }
  }

  // Strategy 3: Code fence extraction
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }

  // Strategy 4: Greedy regex as last resort
  const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\]/)
  if (arrayMatch) {
    try {
      JSON.parse(arrayMatch[0])
      return arrayMatch[0]
    } catch {
      // Malformed, fall through
    }
  }

  // Strategy 5: Return everything and let the caller fail with a clear error
  return trimmed
}

function validateQueryResult(obj: any): obj is QueryResult {
  if (!obj || typeof obj !== 'object') return false
  if (typeof obj.word !== 'string' || obj.word.length === 0) return false

  if (obj.phonetic !== undefined && typeof obj.phonetic !== 'string') return false

  if (!obj.translation || typeof obj.translation !== 'object' || Array.isArray(obj.translation)) return false
  if (Object.keys(obj.translation).length === 0) return false
  for (const [pos, trans] of Object.entries(obj.translation)) {
    if (!Array.isArray(trans) || trans.length === 0) return false
    if (!trans.every((t: any) => typeof t === 'string')) return false
  }

  if (!Array.isArray(obj.example)) return false
  for (const ex of obj.example) {
    if (typeof ex.en !== 'string' || typeof ex.zh !== 'string') return false
  }

  if (obj.synonyms !== undefined && (!Array.isArray(obj.synonyms) || !obj.synonyms.every((s: any) => typeof s === 'string'))) return false
  if (obj.antonyms !== undefined && (!Array.isArray(obj.antonyms) || !obj.antonyms.every((a: any) => typeof a === 'string'))) return false
  if (obj.baseForm !== undefined && typeof obj.baseForm !== 'string') return false

  return true
}

function parseAndValidateResponse(content: string, expectedWords: string[]): QueryResult[] {
  const jsonStr = extractJSON(content)

  // Try parsing the extracted JSON; if it fails, try extracting from code fences
  let parsed: any[]
  let parseAttempted = false

  const tryParse = (s: string): any[] | null => {
    try {
      const result = JSON.parse(s)
      if (Array.isArray(result)) return result
      return null
    } catch {
      return null
    }
  }

  parsed = tryParse(jsonStr)

  // Recovery 1: Try the raw content without boundary markers
  if (!parsed) {
    const alt = extractJSON(content.replace(/\[BEGIN_JSON\]/, '').replace(/\[END_JSON\]/, ''))
    if (alt !== jsonStr) parsed = tryParse(alt)
  }

  // Recovery 2: Truncated JSON — find last complete object and close the array
  if (!parsed) {
    // Find the last complete object — track brace depth, remember the last time depth hit 0
    let braceDepth = 0
    let lastCompleteBrace = -1
    for (let i = 0; i < jsonStr.length; i++) {
      const ch = jsonStr[i]
      if (ch === '{') braceDepth++
      else if (ch === '}') {
        braceDepth--
        if (braceDepth === 0) lastCompleteBrace = i
      }
    }
    // If we found at least one complete object, try closing the array
    if (lastCompleteBrace > 0) {
      const repaired = jsonStr.slice(0, lastCompleteBrace + 1) + ']'
      parsed = tryParse(repaired)
      if (parsed) {
        console.warn(`  ⚠ Truncated response recovered: got ${parsed.length} of ${expectedWords.length} words`)
      }
    }
  }

  if (!parsed) {
    const preview = jsonStr.length > 300
      ? jsonStr.slice(0, 200) + '\n...\n' + jsonStr.slice(-200)
      : jsonStr
    throw new Error(`Invalid JSON response:\n${preview}`)
  }

  if (parsed.length !== expectedWords.length) {
    console.warn(`  ⚠ Expected ${expectedWords.length} results, got ${parsed.length}.`)
  }

  const valid: QueryResult[] = []
  const errors: string[] = []

  for (let i = 0; i < parsed.length; i++) {
    if (validateQueryResult(parsed[i])) {
      valid.push({
        word: parsed[i].word.toLowerCase(),
        phonetic: parsed[i].phonetic,
        translation: parsed[i].translation,
        example: parsed[i].example,
        synonyms: parsed[i].synonyms,
        antonyms: parsed[i].antonyms,
        baseForm: parsed[i].baseForm,
      })
    } else {
      const word = typeof parsed[i]?.word === 'string' ? parsed[i].word : 'unknown'
      errors.push(`  Item ${i}: invalid structure for "${word}"`)
    }
  }

  if (errors.length > 0) {
    for (const err of errors.slice(0, 3)) {
      console.warn(err)
    }
    if (errors.length > 3) {
      console.warn(`  ... and ${errors.length - 3} more errors`)
    }
  }

  if (valid.length === 0) {
    throw new Error('No valid results in response')
  }

  return valid
}

// ==================== Progress Management ====================

interface Progress {
  wordListPath: string
  completedBatches: number[]
  totalWords: number
}

async function loadProgress(path: string): Promise<Progress | null> {
  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) return null
    const text = await file.text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function saveProgress(path: string, progress: Progress): Promise<void> {
  await Bun.write(path, JSON.stringify(progress, null, 2))
}

async function loadExistingOutput(path: string): Promise<QueryResult[]> {
  try {
    const file = Bun.file(path)
    const exists = await file.exists()
    if (!exists) return []
    const text = await file.text()
    return JSON.parse(text)
  } catch {
    return []
  }
}

// ==================== Utility ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== Main ====================

async function main() {
  const config = parseArgs()

  console.log('╔══════════════════════════════════════════╗')
  console.log('║   Word Collection Script                 ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log(`  Model:       ${config.model}`)
  console.log(`  Base URL:    ${config.baseUrl}`)

  // Load word list
  const uniqueWords = await loadWords(config.wordList, 'scripts/default-words.json')

  console.log(`  Total words: ${uniqueWords.length}`)
  console.log(`  Batch size:  ${config.batchSize}`)
  console.log(`  Batches:     ${Math.ceil(uniqueWords.length / config.batchSize)}`)
  console.log(`  Output:      ${config.outputPath}`)
  console.log()

  // Load existing progress and output
  const progress = await loadProgress(config.progressPath)

  // Check word list mismatch — reset progress if using a different word list
  const completedBatches: number[] = []
  if (progress && progress.wordListPath && progress.wordListPath !== config.wordList) {
    console.warn(`  ⚠ Word list changed (${progress.wordListPath} → ${config.wordList}), progress reset`)
    // Keep existing output but reset batch progress
  } else if (progress) {
    completedBatches.push(...(progress.completedBatches || []))
  }

  let allResults: QueryResult[] = []
  const seenWords = new Set<string>()
  if (completedBatches.length > 0) {
    allResults = await loadExistingOutput(config.outputPath)
    allResults.forEach(r => seenWords.add(r.word))
    console.log(`  Resuming from batch #${Math.max(...completedBatches) + 1}`)
    console.log(`  Already completed: ${completedBatches.length} batches (${allResults.length} words)`)
    console.log()
  }

  // Process words in batches
  const limit = config.limit > 0 ? Math.min(config.limit, uniqueWords.length) : uniqueWords.length
  const wordsToProcess = uniqueWords.slice(0, limit)
  const totalBatches = Math.ceil(wordsToProcess.length / config.batchSize)
  const apiConfig: APIConfig = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
  }

  let batchIndex = 0
  for (let i = 0; i < wordsToProcess.length; i += config.batchSize) {
    if (completedBatches.includes(batchIndex)) {
      batchIndex++
      continue
    }

    const batchWords = wordsToProcess.slice(i, i + config.batchSize)
    const batchNum = batchIndex + 1
    const percent = ((batchNum / totalBatches) * 100).toFixed(1)

    console.log(`  [${batchNum}/${totalBatches}] (${percent}%) Processing: ${batchWords.join(', ')}`)

    try {
      const prompt = buildPrompt(batchWords)
      const response = await callLLM(prompt, apiConfig, config.maxRetries)
      const validated = parseAndValidateResponse(response, batchWords)

      // Dedup: skip words already in output (e.g. from partial runs with different word lists)
      const newValid = validated.filter(r => !seenWords.has(r.word))
      newValid.forEach(r => seenWords.add(r.word))
      allResults.push(...newValid)

      console.log(`    ✓ ${newValid.length}/${batchWords.length} words validated. Total: ${allResults.length}`)

      // Write output to disk (save output FIRST, then progress — to avoid inconsistency on crash)
      await Bun.write(config.outputPath, JSON.stringify(allResults, null, 2))
      completedBatches.push(batchIndex)
      await saveProgress(config.progressPath, {
        wordListPath: config.wordList,
        completedBatches,
        totalWords: allResults.length,
      })

      // Delay between batches (skip delay after last batch)
      if (i + config.batchSize < wordsToProcess.length) {
        await sleep(config.delay)
      }
    } catch (error) {
      console.error(`    ✗ Batch failed: ${error}`)
      console.log('  Progress saved. Run again to retry failed batch.')
      process.exit(1)
    }

    batchIndex++
  }

  console.log()
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   Complete!                              ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log(`  Total words collected: ${allResults.length}`)
  console.log(`  Output: ${config.outputPath}`)
  console.log()
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
