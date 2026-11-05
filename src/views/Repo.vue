<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { type Repo, type User, type Branch } from '../model';
import type { CheckStatusSummary } from '@/model/Commit';
import type { ReleaseChanges as ReleaseChangesModel } from '@/model/Branch';
import type { ReleaseConfig } from '@/model/ReleaseConfig';
import ReleaseChanges from '@/components/ReleaseChanges.vue';
import ReleaseWorkflow from '@/components/ReleaseWorkflow.vue';
import RepoSettings from '@/components/RepoSettings.vue';
import { CancellableTask } from '@/util';
import {
  INITIAL_CHECK_POLL_DELAY,
  checkSummariesEqual,
  nextCheckPollDelay,
} from '@/check-polling';

const props = defineProps<{
  user?: User | null;
}>();
const route = useRoute();
const router = useRouter();

interface RepoPageState {
  repo: Repo | null;
  branch: Branch | null;
  config: ReleaseConfig | null;
  changes: ReleaseChangesModel | null;
  checks: CheckStatusSummary | null;
  error: string | null;
}

const EMPTY_PAGE: RepoPageState = {
  repo: null,
  branch: null,
  config: null,
  changes: null,
  checks: null,
  error: null,
};

const refreshKey = ref(0);
const isLoading = ref(false);

const isSettings = computed(() => route.name === 'repo-settings');
const page = computedAsync(async () => {
  refreshKey.value;
  const user = props.user;
  const owner = String(route.params.owner);
  const repoName = String(route.params.repoName);
  const branchName = String(route.params.branch);
  const settingsRoute = route.name === 'repo-settings';
  if (!user) return EMPTY_PAGE;

  try {
    const loadedRepo = await user.getRepo(owner, repoName);
    const loadedBranch = await loadedRepo.branch(branchName);
    const [config, checks] = await Promise.all([
      loadedBranch.loadReleaseConfig(),
      loadedBranch.headCommit.getCheckStatus(),
    ]);
    const changes = config && !settingsRoute
      ? await loadedBranch.changesSinceLatestRelease(config)
      : null;
    return { repo: loadedRepo, branch: loadedBranch, config, changes, checks, error: null };
  } catch (caught) {
    return {
      ...EMPTY_PAGE,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}, EMPTY_PAGE, { evaluating: isLoading });
const repo = computed(() => page.value.repo);
const branch = computed(() => page.value.branch);
const config = computed(() => page.value.config);
const changes = computed(() => page.value.changes);
const checks = ref<CheckStatusSummary | null>(null);
const error = computed(() => page.value.error);
const loadingMessage = computed(() => {
  if (props.user === undefined) return 'Loading account…';
  if (props.user === null) return 'Log in to view this page.';
  return 'Loading repository…';
});
const checkLabel = computed(() => {
  if (checks.value === null) return 'Checking…';
  if (checks.value.total === 0) return 'No checks reported';
  const passing = `${checks.value.passed}/${checks.value.total} checks pass`;
  if (checks.value.failed) return `${passing} · ${checks.value.failed} failed`;
  if (checks.value.pending) return `${passing} · ${checks.value.pending} running`;
  return passing;
});
const headCommitUrl = computed(() => branch.value?.githubObj.commit.html_url);

watch(
  [branch, () => page.value.checks, isLoading],
  ([selectedBranch, initialChecks, loading], _, onCleanup) => {
    checks.value = initialChecks;
    if (!selectedBranch || !initialChecks || loading || isSettings.value) return;

    const pollTask = new CancellableTask(async task => {
      let previous = initialChecks;
      let delay = INITIAL_CHECK_POLL_DELAY;

      while (true) {
        await task.delay(delay);
        try {
          const refreshed = await task.promise(selectedBranch.headCommit.getCheckStatus());
          const changed = !checkSummariesEqual(previous, refreshed);
          checks.value = refreshed;
          previous = refreshed;
          delay = nextCheckPollDelay(delay, changed);
        } catch (caught) {
          task.yield();
          console.warn('Could not refresh check status', caught);
          delay = nextCheckPollDelay(delay, false);
        }
      }
    });

    onCleanup(() => pollTask.cancel());
  },
  { immediate: true },
);

function routeFor(name: 'repo-branch' | 'repo-settings', selectedBranch = branch.value?.name) {
  return {
    name,
    params: {
      owner: route.params.owner,
      repoName: route.params.repoName,
      branch: selectedBranch,
    },
  };
}

function settingsSaved(): void {
  router.push(routeFor('repo-branch'));
}

function checkClass(): string {
  return `checks-${checks.value?.status ?? 'loading'}`;
}

function reloadRepo(): void {
  refreshKey.value += 1;
}
</script>

<template>
  <div class="repo">
      <div v-if="error || isLoading || repo === null || branch === null" class="loading-state">
        <p v-if="error" class="page-error">{{ error }}</p>
        <p v-else>{{ loadingMessage }}</p>
      </div>
      <main v-else class="repo-content">
        <nav class="repo-tabs" aria-label="Repository sections">
          <router-link :to="routeFor('repo-branch')">Release</router-link>
          <router-link :to="routeFor('repo-settings')">Settings</router-link>
        </nav>

        <p v-if="error" class="page-error">{{ error }}</p>

        <RepoSettings
          v-if="!error && isSettings"
          :branch="branch"
          :initial-config="config"
          @saved="settingsSaved"
        />

        <section v-else-if="!error && config === null" class="setup-prompt">
          <p class="eyebrow">Setup required</p>
          <h3>This branch has no release settings yet</h3>
          <p>
            Configure its tag pattern, version files, and Markdown changelog. Humperdinck
            will commit the settings to this branch so the configuration travels with the code.
          </p>
          <router-link class="primary-link" :to="routeFor('repo-settings')">Configure this branch</router-link>
        </section>

        <template v-else-if="!error && changes && config">
          <ReleaseChanges :changes="changes" />
          <section class="checks-card" :class="checkClass()">
            <div class="checks-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0L3.22 8.28a.75.75 0 0 1 1.06-1.06L7 9.94l5.72-5.72a.75.75 0 0 1 1.06 0Z" /></svg>
            </div>
            <div>
              <p class="eyebrow">Checks on {{ branch.name }}</p>
              <strong>{{ checkLabel }}</strong>
            </div>
            <a :href="headCommitUrl" target="_blank" rel="noreferrer">View on GitHub</a>
          </section>
          <ReleaseWorkflow
            :branch="branch"
            :config="config"
            :current-release="changes.release"
            @released="reloadRepo"
          />
        </template>

        <div v-else-if="!error" class="loading-state">{{ loadingMessage }}</div>
      </main>
  </div>
</template>

<style scoped>
.repo-content { min-height: 100vh; padding: 30px; background: #f5f7fa; }
.loading-state { padding: 50px 24px; color: #657081; }
.eyebrow { margin: 0; color: #657081; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.checks-card { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 13px; max-width: 850px; margin: 30px auto 0; padding: 15px 18px; text-align: left; border: 1px solid #d7dce2; border-radius: 12px; background: #fff; }
.checks-icon { display: grid; width: 34px; height: 34px; place-items: center; color: #596675; border-radius: 50%; background: #edf1f4; }
.checks-icon svg { width: 17px; fill: currentColor; }
.checks-card > div:nth-child(2) { display: grid; gap: 3px; }
.checks-card a { color: #536577; font-size: .85rem; font-weight: 700; text-decoration: none; }
.checks-success .checks-icon { color: #fff; background: #1a7f4b; }
.checks-success strong { color: #087747; }
.checks-failure .checks-icon { color: #fff; background: #c14c24; }
.checks-failure strong { color: #a3421b; }
.checks-pending .checks-icon { color: #7a5c00; background: #fff2c4; }
.repo-tabs { display: flex; gap: 6px; max-width: 850px; margin: 0 auto; border-bottom: 1px solid #ccd4dc; }
.repo-tabs a { padding: 10px 15px; color: #536577; text-decoration: none; border-bottom: 3px solid transparent; }
.repo-tabs a.router-link-active { color: #245f8d; border-bottom-color: #245f8d; font-weight: 750; }
.setup-prompt { max-width: 650px; margin: 60px auto; padding: 40px; text-align: left; border: 1px solid #d7dce2; border-radius: 16px; background: #fff; box-shadow: 0 12px 32px rgb(24 39 75 / 8%); }
.setup-prompt h3 { margin: 6px 0 10px; font-size: 1.5rem; }
.setup-prompt p:not(.eyebrow) { color: #657081; line-height: 1.55; }
.primary-link { display: inline-block; margin-top: 10px; padding: 11px 16px; color: #fff; border-radius: 8px; background: #365f82; font-weight: 750; text-decoration: none; }
.page-error { max-width: 850px; margin: 24px auto; padding: 14px; color: #a3421b; border-radius: 8px; background: #fff0e9; }
@media (max-width: 760px) { .repo-content { padding: 22px 12px; } .checks-card { grid-template-columns: 34px 1fr; } .checks-card > a { grid-column: 2; margin-left: 0; } }
</style>
