import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerIcons } from '@ruinb0w/ui'
import { CheckCircle, Database, History, Loader2, Search, Settings, Star } from '@lucide/vue'
import '@ruinb0w/ui/style.css'
import './index.css'
import App from './App.vue'
import { router } from './router'
import { getPlatform } from './utils/tauri'

// 库里的 RLucideIcon 按名字取图标；只登记本项目用到的，不要整包引入
registerIcons({ Search, CheckCircle, Star, History, Settings, Database, Loader2 })

// 深色单主题：主题名与密度是库的 token 入口
document.documentElement.dataset.theme = 'exp1-dark'
getPlatform()
  .then((platform) => {
    document.documentElement.dataset.density = platform === 'mobile' ? 'touch' : 'default'
  })
  .catch(() => {
    document.documentElement.dataset.density = 'default'
  })

createApp(App).use(createPinia()).use(router).mount('#root')
