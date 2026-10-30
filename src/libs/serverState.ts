import { ref } from 'vue'

/** 服务器可达性：由 store 层（每次请求）与启动探活共同维护 */
export type ServerStatus = 'unknown' | 'online' | 'unreachable'

export const serverStatus = ref<ServerStatus>('unknown')
export const serverReason = ref('')

export function markOnline(): void {
  serverStatus.value = 'online'
  serverReason.value = ''
}

export function markUnreachable(reason: string): void {
  serverStatus.value = 'unreachable'
  serverReason.value = reason
}
