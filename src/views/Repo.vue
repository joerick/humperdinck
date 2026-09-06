<template>
  <div class="repo">
    <RepoNavContainer :user="user">
      <div v-if="repo === null">
        {{repoLoadingStatus}}
      </div>
      <div v-else>
        <h2>
          <span v-html="octicons.repo.toSVG()"></span>
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
import octicons from 'octicons';
import Vue, { PropType } from 'vue';
import { Repo, User, Branch, Commit } from '../model';
import { CommitStatus } from '@/model/Commit';
import RepoNavContainer from "@/components/RepoNavContainer.vue";

export default Vue.extend({
  name: 'Repo',
  props: {
    user: Object as PropType<User>
  },
  data() {
    return {
      octicons,
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
        repo = await this.user.getRepo(this.$route.params.owner, this.$route.params.repoName)
      }
      catch(error) {
        this.repoLoadingStatus = 'An error occurred. ' + error.toString()
        return;
      }

      (window as any).pageRepo = repo;
      this.repo = repo;
      this.branch = await this.repo.branch(this.$route.params.branch);
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
.octicon {
  vertical-align: -22%;
  width: 0.8em;
  height: auto;
}
</style>
