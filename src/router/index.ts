import { createRouter, createWebHashHistory } from 'vue-router'
import type { PageType } from '@/types'

const routes: { path: string; name: PageType; component: () => Promise<unknown> }[] = [
  { path: '/', name: 'search', component: () => import('@/pages/Search.vue') },
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
