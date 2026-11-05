<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { User } from '@/model';
import RepoNav from './RepoNav.vue';
import AccountMenu from './AccountMenu.vue';
import BranchPicker from './BranchPicker.vue';
import { useEventListener } from '@vueuse/core';
import logo from '@/assets/logo.svg';
import { useSettingsNavigation } from '@/settings-navigation';

const props = defineProps<{ user?: User | null }>();
const route = useRoute();
const header = useTemplateRef('header');
useEventListener(document, 'pointerdown', event => {
  for (const menu of header.value?.querySelectorAll<HTMLDetailsElement>('details[open]') ?? []) {
    if (!menu.contains(event.target as Node)) menu.open = false;
  }
});
function dismissMenu(event: KeyboardEvent): void {
  const menu = (event.target as Element).closest('details');
  if (menu?.open) {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
}
const { saving } = useSettingsNavigation();
const branchNames = ref<string[]>([]);
const loadingBranches = ref(false);
const branchError = ref(false);
const defaultBranch = ref('');
const branchRefresh = ref(0);
const selectedBranch = computed(() => String(route.params.branch ?? ''));
const branches = computed(() => [...new Set([selectedBranch.value, ...branchNames.value])].filter(Boolean));

watch([() => props.user, () => route.params.owner, () => route.params.repoName, branchRefresh], async ([user, owner, repoName], _, onCleanup) => {
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  branchNames.value = [];
  defaultBranch.value = '';
  branchError.value = false;
  loadingBranches.value = false;
  if (!user || !owner || !repoName) return;
  loadingBranches.value = true;
  try {
    const repo = await user.getRepo(String(owner), String(repoName));
    const names = await repo.branchNames();
    if (!cancelled) {
      branchNames.value = names;
      defaultBranch.value = repo.defaultBranchName;
    }
  } catch (error) {
    if (!cancelled) branchError.value = true;
    console.error('Could not load branches', error);
  } finally {
    if (!cancelled) loadingBranches.value = false;
  }
}, { immediate: true });

</script>

<template>
  <header ref="header" class="app-header" @keydown.esc="dismissMenu">
    <router-link class="brand" to="/" aria-label="Humperdinck home" :aria-disabled="saving">
      <img :src="logo" alt="" width="38" height="32" />
      <span>Humperdinck</span>
    </router-link>
    <div v-if="user" class="repository-controls">
      <RepoNav :user="user" :disabled="saving" />
      <span v-if="selectedBranch" class="context-divider" aria-hidden="true"></span>
      <BranchPicker
        v-if="selectedBranch"
        :branch="selectedBranch"
        :branches="branches"
        :default-branch="defaultBranch"
        :loading="loadingBranches"
        :error="branchError"
        :disabled="saving"
        @retry="branchRefresh++"
      />
    </div>
    <span v-if="saving" class="saving" role="status">Saving settings…</span>
    <AccountMenu :user="user" />
  </header>
</template>

<style scoped>
.app-header { position: relative; z-index: 40; display: flex; align-items: center; gap: 24px; min-height: 68px; padding: 12px 24px; border-bottom: 1px solid #d7dce2; background: #fff; text-align: left; }
.brand { display: flex; flex: 0 0 auto; align-items: center; gap: 9px; color: #273444; font-size: 1.1rem; font-weight: 750; text-decoration: none; }
.brand img { display: block; }
.repository-controls { display: flex; min-width: 0; align-items: center; gap: 10px; }
.context-divider { width:1px; height:18px; background:#e1e6ec; margin:0 2px; flex-shrink:0; }
.app-header :deep(.account-menu) { flex: 0 0 auto; margin-left: auto; }
.saving { color: #657081; font-size: .8rem; }
[aria-disabled="true"] { opacity: .55; cursor: wait; }
@media (max-width: 720px) {
  .app-header { gap: 12px; padding: 10px 12px; }
  .brand span { display: none; }
  .repository-controls { flex: 1; gap: 3px; }
  .saving { position: absolute; top: 100%; right: 12px; padding: 5px 9px; background: #fff; border: 1px solid #d7dce2; border-radius: 0 0 6px 6px; }
}
</style>
