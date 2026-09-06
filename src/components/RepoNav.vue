<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { User } from '../model';
import type { UserRepo } from '@/model/User';

const props = defineProps<{
  user?: User | null;
}>();

interface ConfigurationCache {
  version: 1;
  checkedAt: number;
  repositories: Record<string, { defaultBranchName: string; configured: boolean }>;
}

const route = useRoute();
const router = useRouter();
const picker = ref<HTMLDetailsElement | null>(null);
const search = ref('');
const showAll = ref(false);
const configuration = reactive(new Map<string, boolean>());
const lastUsed = reactive(new Map<string, number>());
const checkedCount = ref(0);
const checkTotal = ref(0);
const checkFailures = ref(0);
const isScanning = ref(false);
const lastCheckedAt = ref<number | null>(null);
let scanGeneration = 0;

const selectedRepoKey = computed(() => {
  if (!route.params.owner || !route.params.repoName) return '';
  return repoKey({
    ownerUsername: String(route.params.owner),
    name: String(route.params.repoName),
    defaultBranchName: '',
  });
});

const configuredRepos = computed(() => {
  if (!props.user) return [];
  return props.user.githubRepos
    .filter(repo => configuration.get(repoKey(repo)) === true)
    .sort((left, right) => {
      const recency = (lastUsed.get(repoKey(right)) ?? 0) - (lastUsed.get(repoKey(left)) ?? 0);
      return recency || compareRepos(left, right);
    });
});

const showingAll = computed(() => showAll.value || configuredRepos.value.length === 0);

const visibleRepos = computed(() => {
  if (!props.user) return [];
  const query = search.value.trim().toLowerCase();
  const repos = showingAll.value
    ? [...props.user.githubRepos].sort(compareRepos)
    : configuredRepos.value;
  return repos.filter(repo => !query || repoKey(repo).includes(query));
});

const scanLabel = computed(() => {
  if (!props.user) return '';
  if (isScanning.value) {
    return `Checking settings ${checkedCount.value}/${checkTotal.value}`;
  }
  if (checkFailures.value) return `${checkFailures.value} checks failed`;
  const configured = [...configuration.values()].filter(Boolean).length;
  if (!lastCheckedAt.value) return `${configured} configured`;
  const time = new Date(lastCheckedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${configured} configured · ${time}`;
});

function selectRepo(selected: UserRepo): void {
  recordLastUsed(selected);
  picker.value?.removeAttribute('open');
  router.push({
    name: 'repo',
    params: { owner: selected.ownerUsername, repoName: selected.name },
  });
}

async function scanRepositories(user: User, reset = false): Promise<void> {
  const generation = ++scanGeneration;
  const allRepos = [...user.githubRepos];
  if (reset) configuration.clear();
  const repos = allRepos.filter(repo => !configuration.has(repoKey(repo)));
  checkedCount.value = allRepos.length - repos.length;
  checkTotal.value = allRepos.length;
  checkFailures.value = 0;
  isScanning.value = true;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < repos.length && generation === scanGeneration) {
      const repo = repos[cursor++]!;
      const key = repoKey(repo);
      try {
        configuration.set(key, await user.repoHasDefaultBranchConfig(repo));
      } catch (error) {
        console.error(`Could not check release settings for ${key}`, error);
        checkFailures.value += 1;
      } finally {
        checkedCount.value += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, repos.length) }, () => worker()));
  if (generation !== scanGeneration) return;
  isScanning.value = false;
  lastCheckedAt.value = Date.now();
  saveCache(user);
}

function repoKey(repo: UserRepo): string {
  return `${repo.ownerUsername}/${repo.name}`.toLowerCase();
}

function compareRepos(left: UserRepo, right: UserRepo): number {
  return repoKey(left).localeCompare(repoKey(right), undefined, { sensitivity: 'base' });
}

function cacheKey(user: User): string {
  return `humperdinck:repo-configuration:v1:${user.uid}`;
}

function usageKey(user: User): string {
  return `humperdinck:repo-last-used:v1:${user.uid}`;
}

function restoreLastUsed(user: User): void {
  lastUsed.clear();
  try {
    const value = localStorage.getItem(usageKey(user));
    if (!value) return;
    const stored = JSON.parse(value) as Record<string, number>;
    for (const [key, timestamp] of Object.entries(stored)) {
      if (Number.isFinite(timestamp)) lastUsed.set(key, timestamp);
    }
  } catch (error) {
    console.warn('Could not restore repository usage history', error);
  }
}

function recordLastUsed(repo: UserRepo): void {
  if (!props.user) return;
  lastUsed.set(repoKey(repo), Date.now());
  try {
    localStorage.setItem(usageKey(props.user), JSON.stringify(Object.fromEntries(lastUsed)));
  } catch (error) {
    console.warn('Could not save repository usage history', error);
  }
}

function restoreCache(user: User): boolean {
  configuration.clear();
  try {
    const value = localStorage.getItem(cacheKey(user));
    if (!value) return false;
    const cache = JSON.parse(value) as ConfigurationCache;
    if (cache.version !== 1 || typeof cache.repositories !== 'object') return false;
    for (const repo of user.githubRepos) {
      const cached = cache.repositories[repoKey(repo)];
      if (cached?.defaultBranchName === repo.defaultBranchName) {
        configuration.set(repoKey(repo), cached.configured);
      }
    }
    lastCheckedAt.value = cache.checkedAt;
    checkedCount.value = configuration.size;
    checkTotal.value = user.githubRepos.length;
    return configuration.size === user.githubRepos.length;
  } catch (error) {
    console.warn('Could not restore repository configuration cache', error);
    return false;
  }
}

function saveCache(user: User): void {
  const repositories: ConfigurationCache['repositories'] = {};
  for (const repo of user.githubRepos) {
    const configured = configuration.get(repoKey(repo));
    if (configured !== undefined) {
      repositories[repoKey(repo)] = { defaultBranchName: repo.defaultBranchName, configured };
    }
  }
  try {
    localStorage.setItem(cacheKey(user), JSON.stringify({
      version: 1,
      checkedAt: lastCheckedAt.value ?? Date.now(),
      repositories,
    } satisfies ConfigurationCache));
  } catch (error) {
    console.warn('Could not save repository configuration cache', error);
  }
}

function refresh(): void {
  if (props.user) scanRepositories(props.user, true).catch(console.error);
}

function markRepoConfigured(event: Event): void {
  const detail = (event as CustomEvent<{ key?: string; branch?: string }>).detail;
  if (!detail?.key || !props.user) return;
  const key = detail.key.toLowerCase();
  const repo = props.user.githubRepos.find(candidate => repoKey(candidate) === key);
  if (!repo || repo.defaultBranchName !== detail.branch) return;
  configuration.set(key, true);
  lastCheckedAt.value = Date.now();
  saveCache(props.user);
}

onMounted(() => window.addEventListener('humperdinck:release-config-saved', markRepoConfigured));
onBeforeUnmount(() => window.removeEventListener('humperdinck:release-config-saved', markRepoConfigured));

watch(() => props.user, user => {
  scanGeneration += 1;
  isScanning.value = false;
  lastCheckedAt.value = null;
  if (user) {
    restoreLastUsed(user);
    if (!restoreCache(user)) scanRepositories(user).catch(console.error);
  }
}, { immediate: true });

watch([() => props.user, selectedRepoKey], ([user, key]) => {
  if (!user || !key) return;
  const repo = user.githubRepos.find(candidate => repoKey(candidate) === key);
  if (repo) recordLastUsed(repo);
}, { immediate: true });
</script>

<template>
  <div v-if="user === undefined" class="state">Loading repositories…</div>
  <div v-else-if="user === null" class="state">Log in to see repositories.</div>
  <details v-else ref="picker" class="repo-picker">
    <summary aria-label="Choose repository">
      <svg class="repo-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 2.75C2 1.78 2.78 1 3.75 1h8.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 13.25ZM3.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25H5v-11Zm2.75 11h5.75c.14 0 .25-.11.25-.25V2.75a.25.25 0 0 0-.25-.25H6.5Z" />
      </svg>
      <span>{{ selectedRepoKey || 'Choose a repository' }}</span>
      <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.22 6.22 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 0 0-1.06-1.06L8 7.88 5.28 5.16a.75.75 0 1 0-1.06 1.06Z" /></svg>
    </summary>
    <div class="popover">
      <div class="popover-heading">
        <strong>Switch repository</strong>
        <div class="scan-status">
          <small>{{ scanLabel }}</small>
          <button type="button" class="refresh" :disabled="isScanning" @click="refresh">
            {{ isScanning ? 'Scanning…' : 'Refresh' }}
          </button>
        </div>
      </div>
      <input v-model="search" type="search" placeholder="Filter repositories…" aria-label="Filter repositories" />
      <div class="list-heading">
        <span>{{ showingAll ? 'All repositories' : 'Configured repositories' }}</span>
        <small>{{ showingAll ? 'Alphabetical' : 'Recently used' }}</small>
      </div>
      <div class="repo-results" role="listbox" aria-label="Repositories">
        <button
          v-for="repo in visibleRepos"
          :key="repoKey(repo)"
          type="button"
          :class="{ selected: repoKey(repo) === selectedRepoKey }"
          @click="selectRepo(repo)"
        >
          <span>{{ repo.ownerUsername }}/<strong>{{ repo.name }}</strong></span>
          <span v-if="configuration.get(repoKey(repo)) === true" class="configured">Configured</span>
        </button>
        <p v-if="visibleRepos.length === 0" class="empty">No matching repositories.</p>
      </div>
      <div class="list-footer">
        <small class="result-count">{{ visibleRepos.length }} shown</small>
        <button
          v-if="configuredRepos.length"
          type="button"
          class="more"
          @click="showAll = !showAll"
        >
          {{ showAll ? 'Configured only' : 'More…' }}
        </button>
      </div>
    </div>
  </details>
</template>

<style lang="scss" scoped>
.repo-picker { position: relative; width: fit-content; max-width: min(100%, 620px); }
summary { display: flex; align-items: center; gap: 9px; min-width: 0; color: #273444; cursor: pointer; font-size: 1.5rem; font-weight: 750; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repo-icon { flex: 0 0 auto; width: .8em; fill: currentColor; }
.chevron { flex: 0 0 auto; width: .7em; fill: #718092; transition: transform .15s ease; }
[open] .chevron { transform: rotate(180deg); }
.popover { position: absolute; z-index: 20; top: calc(100% + 10px); left: 0; display: grid; gap: 10px; width: min(520px, calc(100vw - 40px)); padding: 16px; border: 1px solid #cfd6de; border-radius: 12px; background: #fff; box-shadow: 0 16px 45px rgb(24 39 75 / 20%); }
.popover-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.popover-heading small, .result-count { color: #718092; font-size: .75rem; }
.scan-status { display: flex; align-items: center; gap: 9px; }
.refresh { padding: 4px 8px; color: #365f82; border: 0; border-radius: 6px; background: #e9f0f6; cursor: pointer; font: inherit; font-size: .75rem; font-weight: 750; }
.refresh:disabled { cursor: wait; opacity: .55; }
input, select { min-width: 0; width: 100%; height: 39px; padding: 8px 10px; color: #273444; border: 1px solid #b9c3ce; border-radius: 8px; background: #fff; font: inherit; }
input:focus, select:focus { outline: 3px solid rgb(55 132 190 / 18%); border-color: #3784be; }
.list-heading, .list-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.list-heading { color: #536577; font-size: .78rem; font-weight: 750; }
.list-heading small { color: #8a96a3; font-weight: 500; }
.repo-results { max-height: min(390px, 55vh); overflow-y: auto; border: 1px solid #e1e6eb; border-radius: 8px; }
.repo-results button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; color: #34485b; border: 0; border-top: 1px solid #edf0f3; background: #fff; cursor: pointer; text-align: left; }
.repo-results button:first-child { border-top: 0; }
.repo-results button:hover, .repo-results button.selected { background: #edf4fa; }
.configured { color: #087747; font-size: .72rem; font-weight: 750; }
.more { padding: 3px 0; color: #365f82; border: 0; background: transparent; cursor: pointer; font: inherit; font-size: .8rem; font-weight: 750; }
.empty { margin: 0; padding: 18px; color: #718092; text-align: center; }
.state { color: #657081; }
@media (max-width: 560px) { summary { font-size: 1.25rem; } .popover { left: -4px; } }
</style>
