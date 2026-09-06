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

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { User } from '@/model';
import type { UserRepo } from '@/model/User';

export default defineComponent({
  name: 'RepoList',
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    },
  },
  data() {
    return {
      repos: null as UserRepo[]|null,
      error: null as null|string,
      loading: false,
    }
  },
  methods: {
    async load() {
      if (this.user === undefined) {
        this.loading = true
        return
      }

      if (this.user === null) {
        this.loading = false
        this.repos = []
        this.error = 'Log in to see repositories.'
        return
      }

      this.loading = true
      this.repos = null
      this.error = null

      this.repos = this.user.githubRepos
      this.loading = false
    },
  },
  watch: {
    user: {
      handler() {
        this.load()
      },
      immediate: true,
    }
  },
});
</script>
