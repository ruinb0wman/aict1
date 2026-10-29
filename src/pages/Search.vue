<script setup lang="ts">
import SearchBox from '@/components/SearchBox.vue'
import QueryResult from '@/components/QueryResult.vue'
</script>

<template>
  <div class="search-page">
    <SearchBox />
    <div class="result-container">
      <QueryResult />
    </div>
  </div>
</template>
