<script setup lang="ts">
import RepoNav from './RepoNav.vue'
import type { User } from '@/model'

defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="repo-nav-container">
    <RepoNav class="repo-nav" :user="user" />
    <div class="content-container">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.repo-nav-container {
  display: flex;
}
.repo-nav {
  max-width: 350px;
}
.content-container {
  flex: 1;
}
</style>
