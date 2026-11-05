<script setup lang="ts">
defineProps<{ name: 'repo' | 'branch' | 'search' | 'check' }>();
</script>
<template>
  <svg viewBox="0 0 20 20" aria-hidden="true" class="header-icon">
    <path v-if="name === 'repo'" d="M5 3h11v14H5a2 2 0 0 1 0-4h11M5 3a2 2 0 0 0-2 2v10M6 6h6" />
    <template v-else-if="name === 'branch'"><circle cx="5" cy="4" r="2"/><circle cx="5" cy="16" r="2"/><circle cx="15" cy="5" r="2"/><path d="M5 6v8m10-7c0 5-10 2-10 7"/></template>
    <template v-else-if="name === 'search'"><circle cx="8.5" cy="8.5" r="5"/><path d="m12.5 12.5 4 4"/></template>
    <path v-else d="m4 10 4 4 8-8" />
  </svg>
</template>
<style scoped>
.header-icon { width:18px; height:18px; flex:0 0 18px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
</style>
