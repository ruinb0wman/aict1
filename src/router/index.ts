import { createRouter, createWebHashHistory } from 'vue-router'
import type { PageType } from '@/types'
import { serverStatus } from '@/libs/serverState'

const routes: { path: string; name: PageType; component: () => Promise<unknown> }[] = [
  { path: '/', name: 'search', component: () => import('@/pages/Search.vue') },
  // 连不上服务器时的接管页：换地址/自动重试都在这一页
  { path: '/offline', name: 'offline', component: () => import('@/pages/Offline.vue') },
  { path: '/grammar', name: 'grammar', component: () => import('@/pages/GrammarCheck.vue') },
  { path: '/favorites', name: 'favorites', component: () => import('@/pages/Favorites.vue') },
  { path: '/review', name: 'review', component: () => import('@/pages/Review.vue') },
  { path: '/history', name: 'history', component: () => import('@/pages/History.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/pages/Settings.vue') },
]

// hash 模式：Tauri WebView 里没有服务端路由，hash 免去刷新 404
export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes as never,
})

// 服务器不可达时，所有页面都被错误页接管（offline 自身除外）
router.beforeEach((to) => {
  if (to.name === 'offline' || serverStatus.value !== 'unreachable') return true
  return { name: 'offline', query: { from: to.fullPath } }
})
