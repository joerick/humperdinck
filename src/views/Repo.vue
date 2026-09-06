<template>
  <div class="repo">
    <RepoNavContainer :user="user">
      <div v-if="repo === null">
        {{repoLoadingStatus}}
      </div>
      <div v-else class="repo-content">
        <div class="repo-summary">
          <div>
            <p class="eyebrow">Repository</p>
            <h2>
              <svg class="repo-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 2.75C2 1.78 2.78 1 3.75 1h8.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 13.25ZM3.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25H5v-11Zm2.75 11h5.75c.14 0 .25-.11.25-.25V2.75a.25.25 0 0 0-.25-.25H6.5Z" />
              </svg>
              {{repo.ownerUsername}}/{{repo.name}}
            </h2>
            <p>Current branch: <strong>{{branch?.name}}</strong></p>
          </div>
          <div class="status" :class="`status-${status}`">
            {{ statusLabel }}
          </div>
        </div>

        <ReleaseWorkflow
          v-if="branch && commits"
          :repo="repo"
          :branch="branch"
          :commit-count="commits.length"
          @released="loadRepo"
        />
      </div>
    </RepoNavContainer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { type Repo, type User, type Branch, type Commit } from '../model';
import type { CommitStatus } from '@/model/Commit';
import RepoNavContainer from "@/components/RepoNavContainer.vue";
import ReleaseWorkflow from '@/components/ReleaseWorkflow.vue';

const props = defineProps<{
  user?: User | null;
}>();
const route = useRoute();

const repo = ref<Repo | null>(null);
const repoLoadingStatus = ref<string | null>('Loading...');
const branch = ref<Branch | null>(null);
const commits = ref<Commit[] | null>(null);
const status = ref<CommitStatus | null>(null);
const statusLabel = computed(() => ({
  null: 'Checking tests',
  none: 'No test status',
  pending: 'Tests pending',
  failure: 'Tests failing',
  success: 'Tests passing',
})[String(status.value)] ?? 'Unknown status');

async function loadRepo(): Promise<void> {
      repo.value = null;
      branch.value = null;
      commits.value = null;
      status.value = null;
      
      if (props.user === undefined) {
        // don't know about the user yet. do nothing.
        return;
      }

      if (props.user === null) {
        repoLoadingStatus.value = 'Login to view this page';
        return;
      }
      repoLoadingStatus.value = 'Loading...';

      let loadedRepo: Repo;
      try {
        loadedRepo = await props.user.getRepo(
          String(route.params.owner),
          String(route.params.repoName),
        )
      }
      catch(error) {
        repoLoadingStatus.value = 'An error occurred. ' + String(error)
        return;
      }

      (window as any).pageRepo = loadedRepo;
      await loadedRepo.init();
      repo.value = loadedRepo;
      branch.value = await loadedRepo.branch(String(route.params.branch));
      [commits.value, status.value] = await Promise.all([
        branch.value.commitsSinceLatestTag(),
        branch.value.headCommit.getStatus(),
      ])
      repoLoadingStatus.value = null;
}

watch(
  [() => props.user, () => route.fullPath],
  () => loadRepo().catch(console.error),
  { immediate: true },
);
</script>

<style>
.repo-content {
  padding: 30px;
  background: #f5f7fa;
  min-height: calc(100vh - 68px);
}
.repo-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 780px;
  margin: 0 auto;
  text-align: left;
}
.repo-summary h2 {
  margin: 3px 0 8px;
}
.repo-summary p {
  margin: 0;
}
.eyebrow {
  color: #657081;
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.status {
  padding: 8px 12px;
  border-radius: 999px;
  color: #53606f;
  background: #e4e9ee;
  font-weight: 700;
}
.status-success { color: #087747; background: #dff5ea; }
.status-failure { color: #a3421b; background: #ffe5da; }
.status-pending { color: #7a5c00; background: #fff2c4; }
.repo-icon {
  vertical-align: -22%;
  width: 0.8em;
  height: auto;
  fill: currentColor;
}

@media (max-width: 700px) {
  .repo-content { padding: 22px 12px; }
  .repo-summary { align-items: flex-start; flex-direction: column; gap: 16px; }
}
</style>
