<template>
  <div class="repo-nav-container">
    <RepoNav class="repo-nav" :user="user" />
    <div class="content-container">
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue'
import RepoNav from './RepoNav.vue'
import { User } from '@/model'

export default Vue.extend({
  name: 'RepoNavContainer',
  props: {
    user: Object as PropType<User>,
  },
  components: {
    RepoNav,
  }
})
</script>

<style lang="scss" scoped>
.repo-nav-container {
  display: flex;
}
.repo-nav {
  max-width: 350px;
}
.content-container {
  flex: 1;
}
</style>