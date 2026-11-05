<script setup lang="ts">
import { onBeforeUnmount, provide, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import { createSettingsNavigation, settingsNavigationKey } from './settings-navigation';
import { Auth, type User } from './model';

const user = ref<User | null>();
const navigation = createSettingsNavigation(() => window.confirm('Discard your unsaved settings changes?'));
provide(settingsNavigationKey, navigation);
const router = useRouter();
// Resolve guards run after redirects, so a repository redirect prompts only once.
const removeGuard = router.beforeResolve((to, from) => to.fullPath === from.fullPath || navigation.canLeave());
function warnBeforeUnload(event: BeforeUnloadEvent): void {
  if (!navigation.needsWarning.value) return;
  event.preventDefault();
  event.returnValue = '';
}
watch(navigation.needsWarning, warning => {
  if (warning) window.addEventListener('beforeunload', warnBeforeUnload);
  else window.removeEventListener('beforeunload', warnBeforeUnload);
}, { flush: 'sync' });
onBeforeUnmount(() => {
  removeGuard();
  window.removeEventListener('beforeunload', warnBeforeUnload);
});

Auth.addAuthStateListener(currentUser => {
  user.value = currentUser;
});

</script>

<template>
  <div id="app">
    <AppHeader :user="user" />
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
