<script setup lang="ts">
import type { User } from '@/model';
import AccountMenu from '@/components/AccountMenu.vue';

defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="about">
    <AccountMenu :user="user" />
    <h1>About Humperdinck</h1>
    <p>Branch-aware release preparation for GitHub repositories.</p>
  </div>
</template>

<style scoped>
.about { position: relative; max-width: 650px; margin: 80px auto; padding: 0 24px; }
.about :deep(.account-menu) { position: absolute; top: 0; right: 24px; }
.about p { color: #657081; }
</style>
