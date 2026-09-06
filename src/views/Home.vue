<template>
  <div class="home">
    <RepoNavContainer :user="user" />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import RepoNavContainer from '@/components/RepoNavContainer.vue'
import { User } from '@/model';

export default defineComponent({
  name: 'home',
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    },
  },
  components: {
    RepoNavContainer,
  },
});
</script>
