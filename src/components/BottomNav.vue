<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RTabBar } from '@ruinb0w/ui'
import type { TabBarItem } from '@ruinb0w/ui'

const items: TabBarItem[] = [
  { key: 'search', label: '查询', icon: 'Search' },
  { key: 'grammar', label: '语法', icon: 'CheckCircle' },
  { key: 'favorites', label: '收藏', icon: 'Star' },
  { key: 'history', label: '历史', icon: 'History' },
  { key: 'settings', label: '设置', icon: 'Settings' },
]

const route = useRoute()
const router = useRouter()

const activeKey = computed(() => String(route.name ?? 'search'))
</script>

<template>
  <RTabBar
    :items="items"
    :active-key="activeKey"
    @select="router.push({ name: $event })"
  />
</template>
