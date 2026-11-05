<script setup lang="ts">
import type { User } from '@/model';
defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="home">
    <p class="eyebrow">Humperdinck</p>
    <h1>Release workflow tool</h1>
    <p>
      Inspect changes, write release notes, run release workflows and publish.
    </p>
    <p>
      Choose a repository to inspect a branch or configure its release workflow.
    </p>
  </div>
</template>

<style scoped>
.home { position: relative; max-width: 650px; margin: 90px auto; padding: 0 24px; }
.home h1 { margin: 8px 0 12px; font-size: 2.2rem; }
.home > p:not(.eyebrow) { color: #657081; font-size: 1.08rem; line-height: 1.55; }
.eyebrow { margin: 0; color: #55728c; font-size: .75rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
</style>
