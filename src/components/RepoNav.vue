<template>
  <div class="repo-nav">
    <h3>Repos</h3>

    <div class="loading" v-if="user === undefined">Loading…</div>

    <div class="empty" v-else-if="user === null">Log in to see repositories.</div>

    <div class="repos" v-else>
      <router-link class="repo"
                   v-for="(repo, index) in user.githubRepos"
                   :key="index"
                   :to="{name: 'repo', params: {owner: repo.ownerUsername, repoName: repo.name}}">
        <div class="repo-icon"></div>
        {{repo.ownerUsername}}/{{repo.name}}
      </router-link>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { User } from '../model';

export default defineComponent({
  name: 'RepoNav',
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    },
  },
});
</script>

<style lang="scss" scoped>
.repo-nav {
  border-right: 2px solid #474747;
  overflow-y: auto;
  height: 100%;
}

.repo {
  display: block;
}
</style>
