// LLM 调用已搬到服务端（server/llm.ts）：prompt、API Key、上游请求都不在客户端。
import type { Settings, QueryResponse, GrammarCheckResult } from '@/types'
import { store } from '@/utils/store'

// 输入分类仍在前端用（决定要不要读写缓存）；测试也从这里导入，所以重新导出
export { isSentence, isChinese } from '@/libs/text'

export function queryLLM(input: string): Promise<QueryResponse> {
  return store.query(input)
}

export function testAPIConnection(settings: Settings): Promise<{ success: boolean; message: string }> {
  return store.testConnection(settings)
}

export function checkGrammar(text: string): Promise<GrammarCheckResult> {
  return store.grammar(text)
}
