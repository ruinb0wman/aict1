// 输入分类：单词 / 句子、中 / 英。前后端共用（server 选 prompt，client 决定要不要缓存）。
export function isSentence(input: string): boolean {
  return input.trim().includes(' ')
}

export function isChinese(input: string): boolean {
  return /[\u4e00-\u9fa5]/.test(input)
}
