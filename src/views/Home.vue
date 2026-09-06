<script setup lang="ts">
import RepoNavContainer from '@/components/RepoNavContainer.vue'
import type { User } from '@/model';

defineProps<{
  user?: User | null;
}>();
</script>

<template>
  <div class="home">
    <RepoNavContainer :user="user" />
  </div>
</template>
