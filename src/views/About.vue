<template>
  <div class="about">
    <h1>This is an about page</h1>
    <RepoList :user="user" />
  </div>
</template>
<script setup lang="ts">
import RepoList from '../components/RepoList.vue';
import type { User } from '@/model';

defineProps<{
  user?: User | null;
}>();
</script>
