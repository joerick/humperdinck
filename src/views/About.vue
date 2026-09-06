<template>
  <div class="about">
    <h1>This is an about page</h1>
    <RepoList :user="user" />
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import RepoList from '../components/RepoList.vue';
import type { User } from '@/model';

export default defineComponent({
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    },
  },
  components: {
    RepoList,
  }
})
</script>
