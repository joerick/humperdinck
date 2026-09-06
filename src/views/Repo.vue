<template>
  <div class="repo">
    <RepoNavContainer :user="user">
      <div v-if="repo === null">
        {{repoLoadingStatus}}
      </div>
      <div v-else>
        <h2>
          <svg class="repo-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 2.75C2 1.78 2.78 1 3.75 1h8.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 13.25ZM3.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25H5v-11Zm2.75 11h5.75c.14 0 .25-.11.25-.25V2.75a.25.25 0 0 0-.25-.25H6.5Z" />
          </svg>
          {{repo.ownerUsername}}/{{repo.name}}
        </h2>
        <p>
          Current branch: {{repo.defaultBranchName}}
        </p>

        <p v-if="status == 'pending'">
          Tests pending
        </p>
        <p v-if="status == 'failure'">
          Tests failing
        </p>
        <p v-if="status == 'success'">
          Tests passing
        </p>

        <p v-if="commits">
          {{commits.length}} commits since latest tag.
        </p>
      </div>
    </RepoNavContainer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { type Repo, type User, type Branch, type Commit } from '../model';
import type { CommitStatus } from '@/model/Commit';
import RepoNavContainer from "@/components/RepoNavContainer.vue";

const props = defineProps<{
  user?: User | null;
}>();
const route = useRoute();

const repo = ref<Repo | null>(null);
const repoLoadingStatus = ref<string | null>('Loading...');
const branch = ref<Branch | null>(null);
const commits = ref<Commit[] | null>(null);
const status = ref<CommitStatus | null>(null);

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
.repo-icon {
  vertical-align: -22%;
  width: 0.8em;
  height: auto;
  fill: currentColor;
}
</style>
