<template>
  <div>
    <div class="loading" v-if="loading">Loading…</div>
    <div class="repos" v-else>
      <div class="repo"
           v-for="(repo, index) in repos"
           :key="index"
           @click="repoClick(repo)">
        {{repo.ownerUsername}}/{{repo.name}}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import { User, Repo } from '@/model';

export default Vue.extend({
  name: 'RepoList',
  props: {
    user: Object as PropType<User>,
  },
  data() {
    return {
      repos: null as Repo[]|null,
      error: null as null|string,
      loading: false,
    }
  },
  methods: {
    async load() {
      this.loading = true
      this.repos = null
      this.error = null

      this.user.githubRepos()
        .then(repos => {
          this.repos = repos;
        })
        .catch(error => {
          this.error = error;
          console.error(error);
        })
        .finally(() => {
          this.loading = false;
        })
    },
    repoClick(repo: Repo) {
      repo.defaultBranch().then((branch) => {
        console.log('branch', branch.name);
        return branch.currentVersion();
      }).then(version => {
        console.log({version});
      }).catch(console.error);
    },
  },
  watch: {
    user: {
      handler() {
        if (this.user !== undefined) {
          this.load()
        }
      },
      immediate: true,
    }
  },
});
</script>
