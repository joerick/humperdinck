<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue';
import { Semaphore } from 'async-mutex';
import { useRoute, useRouter } from 'vue-router';
import type { Repo, User } from '../model';
import { CancellableTask } from '@/util';
import HeaderIcon from './HeaderIcon.vue';

const props = defineProps<{
  user?: User | null;
  disabled?: boolean;
}>();

interface ConfigurationCache {
  version: 1;
  checkedAt: number;
  repositories: Record<string, { defaultBranchName: string; configured: boolean }>;
}

type RepoIdentity = Pick<Repo, 'ownerUsername' | 'name'>;

const route = useRoute();
const router = useRouter();
const picker = useTemplateRef('picker');
const search = ref('');
const searchInput = useTemplateRef('searchInput');
const navigationError = ref('');
async function opened(): Promise<void> {
  if (!picker.value?.open) return;
  navigationError.value = '';
  await nextTick();
  searchInput.value?.focus();
}
const showAll = ref(false);
const configuration = reactive(new Map<string, boolean>());
const lastUsed = reactive(new Map<string, number>());
const checkedCount = ref(0);
const checkTotal = ref(0);
const checkFailures = ref(0);
const isScanning = ref(false);
const lastCheckedAt = ref<number | null>(null);
let scanTask: CancellableTask | null = null;

const selectedRepoKey = computed(() => {
  if (!route.params.owner || !route.params.repoName) return '';
  return repoKey({
    ownerUsername: String(route.params.owner),
    name: String(route.params.repoName),
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

async function selectRepo(selected: Repo): Promise<void> {
  if (props.disabled) return;
  navigationError.value = '';
  try {
    const failure = await router.push({
      name: 'repo-branch',
      params: { owner: selected.ownerUsername, repoName: selected.name, branch: selected.defaultBranchName },
    });
    if (!failure) picker.value?.removeAttribute('open');
  } catch (error) {
    navigationError.value = error instanceof Error ? error.message : String(error);
  }
}

watch(() => route.fullPath, () => picker.value?.removeAttribute('open'));

watch(() => props.disabled, disabled => {
  if (disabled) picker.value?.removeAttribute('open');
});

function scanRepositories(user: User, reset = false): void {
  scanTask?.cancel();
  isScanning.value = true;
  scanTask = new CancellableTask(async task => {
    try {
      const allRepos = [...user.githubRepos];
      if (reset) configuration.clear();
      const repos = allRepos.filter(repo => !configuration.has(repoKey(repo)));
      checkedCount.value = allRepos.length - repos.length;
      checkTotal.value = allRepos.length;
      checkFailures.value = 0;
      const semaphore = new Semaphore(6);
      await Promise.all(repos.map(repo => semaphore.runExclusive(async () => {
        try {
          task.yield();
          const key = repoKey(repo);
          const configured = await task.promise(repo.hasDefaultBranchConfig());
          configuration.set(key, configured);
        } catch (error) {
          task.yield();
          console.error(`Could not check release settings for ${repoKey(repo)}`, error);
          checkFailures.value += 1;
        } finally {
          if (!task.isCancelled && !task.signal?.aborted) checkedCount.value += 1;
        }
      })));
      lastCheckedAt.value = Date.now();
      saveCache(user);
    } finally {
      if (scanTask === task) isScanning.value = false;
    }
  });
}

function repoKey(repo: RepoIdentity): string {
  return `${repo.ownerUsername}/${repo.name}`.toLowerCase();
}

function compareRepos(left: Repo, right: Repo): number {
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

function recordLastUsed(repo: Repo): void {
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
  if (props.user) scanRepositories(props.user, true);
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
onBeforeUnmount(() => {
  scanTask?.cancel();
  window.removeEventListener('humperdinck:release-config-saved', markRepoConfigured);
});

watch(() => props.user, user => {
  scanTask?.cancel();
  isScanning.value = false;
  lastCheckedAt.value = null;
  if (user) {
    restoreLastUsed(user);
    if (!restoreCache(user)) scanRepositories(user);
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
  <details v-else ref="picker" class="repo-picker" @toggle="opened">
    <summary aria-label="Choose repository" :title="selectedRepoKey || 'Choose repository'" :aria-disabled="disabled" @click="disabled && $event.preventDefault()">
      <HeaderIcon name="repo" class="repo-icon" />
      <span v-if="selectedRepoKey" class="repo-name"><span class="owner">{{ route.params.owner }}<span class="slash">/</span></span><strong>{{ route.params.repoName }}</strong></span>
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
      <label class="search"><HeaderIcon name="search" /><input ref="searchInput" v-model="search" type="search" placeholder="Find a repository…" aria-label="Find a repository" /></label>
      <div class="list-heading">
        <span>{{ showingAll ? 'All repositories' : 'Configured repositories' }}</span>
        <small>{{ showingAll ? 'Alphabetical' : 'Recently used' }}</small>
      </div>
      <div class="repo-results" role="group" aria-label="Repositories">
        <button
          v-for="repo in visibleRepos"
          :key="repoKey(repo)"
          type="button"
          :class="{ selected: repoKey(repo) === selectedRepoKey }"
          :disabled="disabled"
          @click="selectRepo(repo)"
        >
          <HeaderIcon name="repo" class="option-icon" />
          <span class="option-text"><strong>{{ repo.name }}</strong><small>{{ repo.ownerUsername }}</small></span>
          <span v-if="configuration.get(repoKey(repo)) === true" class="configured">Configured</span>
          <HeaderIcon v-if="repoKey(repo) === selectedRepoKey" name="check" class="check" />
        </button>
        <p v-if="visibleRepos.length === 0" class="empty">No matching repositories.</p>
      </div>
      <p v-if="navigationError" class="navigation-error" role="alert">{{ navigationError }}</p>
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

<style scoped>
.repo-picker { position:relative; width:fit-content; min-width:0; max-width:min(100%,620px); flex:0 1 auto; }
summary { display:flex; align-items:center; gap:8px; min-width:0; min-height:36px; padding:0 8px; border-radius:6px; color:#283444; cursor:pointer; font-size:14px; line-height:20px; list-style:none; }
summary::-webkit-details-marker { display:none; }
summary:hover,[open]>summary { background:#edf2f7; }
summary:focus-visible { outline:2px solid #3764ce; outline-offset:3px; }
summary[aria-disabled="true"] { opacity:.55; cursor:wait; }
.repo-name { display:flex; min-width:0; align-items:baseline; white-space:nowrap; }
.repo-name strong { overflow:hidden; text-overflow:ellipsis; font-weight:650; }
.owner { color:#687484; }
.slash { padding:0 5px; color:#a2acb8; }
.repo-icon { color:#6b7888; }
.popover { position:absolute; z-index:50; top:calc(100% + 10px); left:0; display:grid; gap:10px; width:min(440px,calc(100vw - 260px)); padding:14px 12px 10px; border:1px solid #d6dee7; border-radius:10px; background:#fff; box-shadow:0 16px 40px #22334a24,0 3px 8px #22334a0a; }
.popover-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:0 4px; color:#29394c; font-size:13px; }
.popover-heading small,.result-count { color:#8390a0; font-size:10px; }
.scan-status { display:flex; align-items:center; gap:8px; }
.refresh { padding:4px 6px; color:#5f7697; border:0; border-radius:4px; background:#f0f3f7; cursor:pointer; font:inherit; font-size:10px; }
.refresh:disabled { cursor:wait; opacity:.55; }
.search { display:flex; align-items:center; gap:8px; padding:0 10px; border:1px solid #d7dfe8; border-radius:6px; background:#fafbfd; color:#8491a0; }
.search:focus-within { border-color:#6488c4; box-shadow:0 0 0 2px #3764ce15; }
.search .header-icon { width:16px; height:16px; flex-basis:16px; }
input { width:100%; min-width:0; padding:9px 0; border:0; outline:0; background:transparent; color:#29394c; font:inherit; font-size:12px; }
input::placeholder { color:#8a96a5; }
.list-heading,.list-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 4px; }
.list-heading { color:#7b899b; font-size:10px; font-weight:600; }
.list-heading small { color:#96a1af; font-size:10px; font-weight:400; }
.repo-results { max-height:min(390px,55vh); overflow-y:auto; display:grid; gap:2px; margin:0 -6px; }
.repo-results button { display:flex; width:100%; align-items:center; gap:10px; padding:10px; color:#34445a; border:0; border-radius:6px; background:#fff; cursor:pointer; text-align:left; font:inherit; font-size:13px; }
.repo-results button:hover { background:#f2f5f9; }
.repo-results button.selected { background:#f0f5fc; }
.option-icon { color:#8591a0; }
.option-text { flex:1; min-width:0; overflow-wrap:anywhere; }
.option-text strong { font-weight:500; }
.option-text small { display:block; margin-top:3px; color:#8390a0; font-size:11px; }
.check { color:#3764ce; }
.configured { color:#648772; font-size:10px; }
.more { padding:3px 0; color:#5f7697; border:0; background:transparent; cursor:pointer; font:inherit; font-size:11px; }
.empty { margin:0; padding:18px; color:#8390a0; font-size:12px; text-align:center; }
.state { color:#657081; }
.navigation-error { margin:0; color:#a3421b; font-size:12px; }
@media(max-width:720px) {
 .repo-picker { position:static; }
 summary { padding:0 5px; gap:5px; font-size:13px; }
 .owner { display:none; }
 .popover { top:calc(100% - 1px); left:12px; width:calc(100vw - 24px); }
}
</style>
