<template>
  <div class="about">
    <h1>This is an about page</h1>
    <RepoList :user="user" />
  </div>
</template>
<script>
import RepoList from '../components/RepoList.vue';

export default {
  props: ['user'],
  components: {
    RepoList,
  }
}
</script>
