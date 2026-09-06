<script setup lang="ts">
import type { User } from '@/model';
import RepoNav from '@/components/RepoNav.vue';

defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="home">
    <p class="eyebrow">Humperdinck</p>
    <h1>Prepare confident releases</h1>
    <p>Choose a repository to inspect a branch or configure its release workflow.</p>
    <RepoNav :user="user" />
  </div>
</template>

<style scoped>
.home { max-width: 650px; margin: 90px auto; padding: 0 24px; }
.home h1 { margin: 8px 0 12px; font-size: 2.2rem; }
.home > p:not(.eyebrow) { color: #657081; font-size: 1.08rem; line-height: 1.55; }
.home :deep(.repo-picker) { margin: 28px auto 0; text-align: left; }
.eyebrow { margin: 0; color: #55728c; font-size: .75rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
</style>
