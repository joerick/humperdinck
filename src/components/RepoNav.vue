<template>
  <div class="repo-nav">
    <h3>Repos</h3>

    <div class="loading" v-if="!user">Loading…</div>

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
import Vue, { PropType } from 'vue'
import octicons from 'octicons';
import { User, Repo } from '../model';
import { UserRepo } from '@/model/User';

export default Vue.extend({
  name: 'RepoNav',
  props: {
    user: Object as PropType<User|null|undefined>,
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