<script setup lang="ts">
import { ref, watch } from 'vue';
import type { User } from '@/model';
import type { UserRepo } from '@/model/User';

const props = defineProps<{
  user?: User | null;
}>();

const repos = ref<UserRepo[] | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);

function load(): void {
  if (props.user === undefined) {
    loading.value = true;
    return;
  }

  if (props.user === null) {
    loading.value = false;
    repos.value = [];
    error.value = 'Log in to see repositories.';
    return;
  }

  loading.value = true;
  repos.value = props.user.githubRepos;
  error.value = null;
  loading.value = false;
}

watch(() => props.user, load, { immediate: true });
</script>

<template>
  <div>
    <div class="loading" v-if="loading">Loading…</div>
    <div class="error" v-else-if="error">{{ error }}</div>
    <div class="repos" v-else>
      <router-link class="repo"
           v-for="(repo, index) in repos"
           :key="index"
           :to="{name: 'repo', params: {owner: repo.ownerUsername, repoName: repo.name}}">
        {{repo.ownerUsername}}/{{repo.name}}
      </router-link>
    </div>
  </div>
</template>
