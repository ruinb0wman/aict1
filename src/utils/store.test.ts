import { describe, expect, it } from 'vitest'
import { normalizeBase } from './store'

describe('normalizeBase', () => {
  it('没有 scheme 就补 http://', () => {
    expect(normalizeBase('192.168.1.2:8471')).toBe('http://192.168.1.2:8471')
    expect(normalizeBase('localhost:8471')).toBe('http://localhost:8471')
  })

  it('保留已有的 http/https', () => {
    expect(normalizeBase('https://albedo.tail36b860.ts.net:8471')).toBe('https://albedo.tail36b860.ts.net:8471')
    expect(normalizeBase('http://127.0.0.1:8471')).toBe('http://127.0.0.1:8471')
  })

  it('去掉尾斜杠和首尾空格', () => {
    expect(normalizeBase('  http://127.0.0.1:8471///  ')).toBe('http://127.0.0.1:8471')
  })

  it('空串表示同源（浏览器端）', () => {
    expect(normalizeBase('')).toBe('')
    expect(normalizeBase('   ')).toBe('')
  })
})
