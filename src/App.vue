<script setup lang="ts">
import { ref } from 'vue';
import { Auth, type User } from './model';

const user = ref<User | null>();

Auth.addAuthStateListener(currentUser => {
  user.value = currentUser;
});

</script>

<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <component :is="Component" :user="user" />
    </router-view>
  </div>
</template>

<style lang="scss">
* {
  box-sizing: border-box;
}
html, body {
  min-height: 100%;
  margin: 0;
  padding: 0;
}
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #474747;
  min-height: 100%;
}
</style>
