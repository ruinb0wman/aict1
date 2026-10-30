import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { HistoryItem, Settings, FavoriteWord, WordEntry, QueryResult } from '../src/types'
import { queryLLM, checkGrammar, testConnection } from './llm'
import * as store from './db'

const DIST = join(import.meta.dir, '..', 'dist')

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const port = Number(arg('port', process.env.PORT ?? '8471'))
const hostname = arg('bind', '127.0.0.1')

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

const text = (message: string, status: number) => json({ error: message }, status)

async function body<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

// ==================== API ====================

async function handleApi(req: Request, pathname: string): Promise<Response> {
  const [, , resource, rawId] = pathname.split('/') // /api/<resource>/<id>
  const id = rawId ? decodeURIComponent(rawId) : undefined
  const method = req.method

  switch (resource) {
    case 'health':
      return json({ ok: true })

    case 'words': {
      if (!id) {
        if (method === 'GET') return json(store.getAllWords())
        if (method === 'POST') {
          const { word, queryResult } = await body<{ word: string; queryResult: QueryResult }>(req)
          return json(store.saveWord(word, queryResult))
        }
        return text('Method Not Allowed', 405)
      }
      if (method === 'GET') {
        const entry = store.getWord(id)
        return entry ? json(entry) : text('Not Found', 404)
      }
      if (method === 'PATCH') return json(store.updateWord(id, await body<Partial<WordEntry>>(req)))
      if (method === 'DELETE') {
        store.deleteWord(id)
        return json({ ok: true })
      }
      return text('Method Not Allowed', 405)
    }

    case 'favorites': {
      if (!id) {
        if (method === 'GET') return json(store.getAllFavorites())
        if (method === 'POST') {
          store.saveFavorite(await body<FavoriteWord>(req))
          return json({ ok: true })
        }
        return text('Method Not Allowed', 405)
      }
      if (method === 'PATCH') {
        store.updateFavorite(id, await body<Partial<FavoriteWord>>(req))
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        store.removeFavorite(id)
        return json({ ok: true })
      }
      return text('Method Not Allowed', 405)
    }

    case 'history': {
      if (!id) {
        if (method === 'GET') return json(store.getAllHistory())
        if (method === 'POST') {
          const { item } = await body<{ item: HistoryItem }>(req)
          return json(store.appendHistory(item, store.getHistoryLimit()))
        }
        if (method === 'DELETE') {
          store.clearHistory()
          return json([])
        }
        return text('Method Not Allowed', 405)
      }
      if (method === 'DELETE') return json(store.removeHistory(id))
      return text('Method Not Allowed', 405)
    }

    case 'settings': {
      if (method === 'GET') return json(store.getSettings())
      if (method === 'PUT') {
        store.saveSettings(await body<Settings>(req))
        return json({ ok: true })
      }
      return text('Method Not Allowed', 405)
    }

    case 'query': {
      if (method !== 'POST') return text('Method Not Allowed', 405)
      const { input } = await body<{ input: string }>(req)
      const settings = store.getSettings()
      if (!settings) return text('请先设置 API Key', 400)
      return json(await queryLLM(input, settings))
    }

    case 'grammar': {
      if (method !== 'POST') return text('Method Not Allowed', 405)
      const { text: input } = await body<{ text: string }>(req)
      const settings = store.getSettings()
      if (!settings) return text('请先设置 API Key', 400)
      return json(await checkGrammar(input, settings))
    }

    case 'test-connection': {
      if (method !== 'POST') return text('Method Not Allowed', 405)
      const override = (await body<{ settings?: Settings }>(req).catch(() => ({} as { settings?: Settings }))).settings
      const settings = override ?? store.getSettings()
      if (!settings) return json({ success: false, message: '请先输入 API Key' })
      return json(await testConnection(settings))
    }

    case 'export': {
      if (method !== 'GET') return text('Method Not Allowed', 405)
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
      const payload = {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: store.getSettings(),
        favorites: store.getAllFavorites(),
        words: store.getAllWords(),
        history: store.getAllHistory(),
      }
      return new Response(JSON.stringify(payload, null, 2), {
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="aict1-${stamp}.json"`,
        },
      })
    }

    case 'import': {
      if (method !== 'POST') return text('Method Not Allowed', 405)
      const data = await body<{
        settings?: Settings
        favorites?: FavoriteWord[]
        words?: WordEntry[]
        history?: HistoryItem[]
      }>(req)

      if (data.settings) store.saveSettings(data.settings)
      for (const word of data.words ?? []) store.saveWord(word.word, word)
      if (data.history) store.clearHistory()
      for (const item of data.history ?? []) store.appendHistory(item, 10000)

      // 收藏按单词去重（与旧客户端行为一致：重复的跳过，不覆盖）
      const existing = new Set(store.getAllFavorites().map(f => f.word.toLowerCase()))
      let imported = 0
      let skipped = 0
      for (const favorite of data.favorites ?? []) {
        if (existing.has(favorite.word.toLowerCase())) {
          skipped++
          continue
        }
        store.saveFavorite({ ...favorite, id: crypto.randomUUID() })
        existing.add(favorite.word.toLowerCase())
        imported++
      }

      return json({ imported, skipped })
    }
  }

  return text('Not Found', 404)
}

// ==================== 静态资源 ====================

async function handleStatic(pathname: string): Promise<Response> {
  if (!existsSync(DIST)) return new Response('dist/ 不存在，先跑 bun run build', { status: 503 })
  const clean = pathname.replace(/\.\./g, '')
  const file = Bun.file(join(DIST, clean === '/' ? 'index.html' : clean))
  if (await file.exists()) return new Response(file)
  return new Response(Bun.file(join(DIST, 'index.html'))) // hash 路由，任何路径都回首页
}

// ==================== 入口 ====================

const server = Bun.serve({
  port,
  hostname,
  async fetch(req) {
    const { pathname } = new URL(req.url)
    try {
      if (pathname.startsWith('/api/')) return await handleApi(req, pathname)
      return await handleStatic(pathname)
    } catch (error) {
      return text(error instanceof Error ? error.message : '服务器内部错误', 500)
    }
  },
})

console.log(`[aict1] http://${hostname}:${server.port}  (db: ${process.env.DB_PATH ?? 'data/dict.db'})`)
