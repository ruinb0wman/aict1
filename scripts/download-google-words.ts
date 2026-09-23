#!/usr/bin/env bun

/**
 * Google 10K Word List Downloader
 *
 * Downloads the top 10,000 English words by frequency from
 * first20hours/google-10000-english (Google Trillion Word Corpus).
 *
 * Usage:
 *   bun run scripts/download-google-words.ts
 *   bun run scripts/download-google-words.ts --limit 5000
 *   bun run scripts/download-google-words.ts --output scripts/my-words.json
 */

const URL = 'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt'
const DEFAULT_OUTPUT = 'scripts/google-10000.json'

interface Config {
  limit: number
  output: string
}

function parseArgs(): Config {
  const args = process.argv.slice(2)
  const config: Config = { limit: 0, output: DEFAULT_OUTPUT }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        config.limit = parseInt(args[++i], 10)
        break
      case '--output':
        config.output = args[++i]
        break
      case '--help':
      case '-h':
        console.log(`Usage: bun run scripts/download-google-words.ts [options]

Options:
  --limit <n>       Only keep top N words (0 = all, default: 0)
  --output <path>   Output JSON file (default: ${DEFAULT_OUTPUT})
  --help, -h        Show this help
`)
        process.exit(0)
    }
  }
  if (isNaN(config.limit) || config.limit < 0) config.limit = 0
  return config
}

async function main() {
  const config = parseArgs()

  console.log(`  Downloading from:\n    ${URL}`)

  const res = await fetch(URL)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const text = await res.text()
  const words = text
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0 && /^[a-z]+(-[a-z]+)*$/.test(w))

  const unique = [...new Set(words)]
  const final = config.limit > 0 ? unique.slice(0, config.limit) : unique

  await Bun.write(config.output, JSON.stringify(final, null, 2))

  console.log()
  console.log(`  Total lines:        ${text.split('\n').length}`)
  console.log(`  After clean/unique: ${unique.length}`)
  console.log(`  Output:             ${config.output}`)
  console.log(`  Saved:              ${final.length} words`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
