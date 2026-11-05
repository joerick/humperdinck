<script setup lang="ts">
import { Auth, type User } from '@/model';
import { useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsNavigation } from '@/settings-navigation';

const navigation = useSettingsNavigation();
const { saving } = navigation;
const menu = useTemplateRef('menu');
const route = useRoute();
watch(() => route.fullPath, () => menu.value?.removeAttribute('open'));
watch(saving, () => menu.value?.removeAttribute('open'));

defineProps<{
  user?: User | null;
}>();

function login(): void {
  Auth.login().catch(console.error);
}

function logout(): void {
  if (!navigation.canLeave()) return;
  Auth.logout().then(() => menu.value?.removeAttribute('open')).catch(console.error);
}
</script>

<template>
  <details ref="menu" class="account-menu">
    <summary aria-label="Account menu">
      <img v-if="user?.profileURL" :src="user.profileURL" :alt="user.githubUsername" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0Z" />
      </svg>
    </summary>
    <nav>
      <strong v-if="user">@{{ user.githubUsername }}</strong>
      <span v-else-if="user === undefined">Loading account…</span>
      <router-link to="/">Home</router-link>
      <router-link to="/about">About</router-link>
      <button v-if="user === null" type="button" @click="login">Log in with GitHub</button>
      <button v-else-if="user" type="button" :disabled="saving" @click="logout">Log out</button>
    </nav>
  </details>
</template>

<style scoped>
.account-menu { position: relative; }
summary { display: grid; width: 40px; height: 40px; overflow: hidden; place-items: center; color: #536577; border: 1px solid #c8d1da; border-radius: 50%; background: #fff; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary img { width: 100%; height: 100%; object-fit: cover; }
summary svg { width: 23px; fill: currentColor; }
nav { position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; display: grid; min-width: 190px; overflow: hidden; padding: 7px; text-align: left; border: 1px solid #cfd6de; border-radius: 10px; background: #fff; box-shadow: 0 14px 38px rgb(24 39 75 / 20%); }
nav strong, nav span { padding: 8px 10px; color: #657081; font-size: .8rem; }
nav a, nav button { padding: 9px 10px; color: #34485b; border: 0; border-radius: 6px; background: transparent; cursor: pointer; font: inherit; text-align: left; text-decoration: none; }
nav a:hover, nav button:hover { background: #edf4fa; }
</style>
