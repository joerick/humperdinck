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
<script>
export default {
  name: 'RepoList',
  props: ['user'],
  data() {
    return {
      repos: null,
      loading: false,
    }
  },
  methods: {
    repoClick(repo) {
      repo.defaultBranch().then((branch) => {
        console.log('branch', branch.name);
        return branch.currentVersion();
      }).then(version => {
        console.log({version});
      }).catch(console.error);
    },
  },
  watch: {
    user() {
      if (this.user) {
        this.loading = true;
        this.user.githubRepos().then(repos => {
          this.loading = false;
          this.repos = repos;
        }).catch(error => {
          this.loading = false;
          console.error(error);
        })
      }
    }
  },
}
</script>
