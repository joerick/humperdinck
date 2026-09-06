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

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Repo, User, Branch, Commit } from '../model';
import type { CommitStatus } from '@/model/Commit';
import RepoNavContainer from "@/components/RepoNavContainer.vue";

export default defineComponent({
  name: 'Repo',
  props: {
    user: {
      type: Object as PropType<User|null>,
      default: undefined,
    }
  },
  data() {
    return {
      repo: null as Repo|null,
      repoLoadingStatus: 'Loading...' as string|null,
      branch: null as Branch|null,
      commits: null as Commit[]|null,
      latestVersion: null,
      status: null as CommitStatus|null,
    }
  },
  mounted() {
    this.loadRepo().catch(console.error);
  },
  methods: {
    async loadRepo() {
      this.repo = null;
      this.branch = null;
      this.commits = null;
      this.latestVersion = null;
      this.status = null;
      
      if (this.user === undefined) {
        // don't know about the user yet. do nothing.
        return;
      }

      if (this.user === null) {
        this.repoLoadingStatus = 'Login to view this page';
        return;
      }
      this.repoLoadingStatus = 'Loading...';

      let repo;
      try {
        repo = await this.user.getRepo(
          String(this.$route.params.owner),
          String(this.$route.params.repoName),
        )
      }
      catch(error) {
        this.repoLoadingStatus = 'An error occurred. ' + String(error)
        return;
      }

      (window as any).pageRepo = repo;
      this.repo = repo;
      this.branch = await this.repo.branch(String(this.$route.params.branch));
      [this.commits, this.status] = await Promise.all([
        this.branch.commitsSinceLatestTag(),
        this.branch.headCommit.getStatus(),
      ])
      this.repoLoadingStatus = null;
    }
  },
  watch: {
    user() {
      this.loadRepo().catch(console.error);
    },
    $route() {
      this.loadRepo().catch(console.error);
    },
  },
  components: {
    RepoNavContainer,
  }
})
</script>

<style>
.repo-icon {
  vertical-align: -22%;
  width: 0.8em;
  height: auto;
  fill: currentColor;
}
</style>
