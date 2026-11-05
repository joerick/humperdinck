<script setup lang="ts">
import type { User } from '@/model';

defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="about">
    <h1>About Humperdinck</h1>
    <p>Branch-aware release preparation for GitHub repositories.</p>
  </div>
</template>

<style scoped>
.about { position: relative; max-width: 650px; margin: 80px auto; padding: 0 24px; }
.about p { color: #657081; }
</style>
