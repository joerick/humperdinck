<template>
  <div class="home">
    <RepoNavContainer :user="user" />
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import RepoNavContainer from '@/components/RepoNavContainer.vue'
import { User } from '@/model';

export default Vue.extend({
  name: 'home',
  props: {
    user: Object as PropType<User|null|undefined>,
  },
  components: {
    RepoNavContainer,
  },
});
</script>
