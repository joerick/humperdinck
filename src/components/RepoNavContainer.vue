<template>
  <div class="repo-nav-container">
    <RepoNav class="repo-nav" :user="user" />
    <div class="content-container">
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import RepoNav from './RepoNav.vue'
import { User } from '@/model'

export default defineComponent({
  name: 'RepoNavContainer',
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    },
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
