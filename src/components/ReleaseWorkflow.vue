<template>
  <section class="release-workflow">
    <header>
      <p class="eyebrow">Release workflow</p>
      <h3>Prepare a GitHub release</h3>
      <p class="intro">
        Work through each step explicitly. Previewing is read-only; GitHub is only
        changed when you create the draft commit or publish the release.
      </p>
    </header>

    <div class="step">
      <div class="step-number">1</div>
      <div class="step-content">
        <h4>Configure version files</h4>
        <p class="muted">
          One repository-relative path per line. The first occurrence of the current
          version in each file will be replaced in the draft commit.
        </p>
        <textarea
          v-model="versionFilesText"
          rows="4"
          placeholder="package.json&#10;src/version.ts"
          :disabled="busy"
        />
        <div class="actions">
          <button type="button" :disabled="busy" @click="saveSettings">
            {{ repo.isEnabled ? 'Save settings' : 'Enable release workflow' }}
          </button>
          <button
            v-if="repo.isEnabled"
            type="button"
            class="button-secondary"
            :disabled="busy"
            @click="disableWorkflow"
          >
            Disable
          </button>
        </div>
        <p v-if="settingsMessage" class="message">{{ settingsMessage }}</p>
      </div>
    </div>

    <div class="step" :class="{ disabled: !repo.isEnabled }">
      <div class="step-number">2</div>
      <div class="step-content">
        <h4>Preview the release</h4>
        <dl class="facts">
          <div>
            <dt>Current version</dt>
            <dd>{{ currentVersion ?? 'Not detected' }}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{{ branch.name }}</dd>
          </div>
          <div>
            <dt>Unreleased commits</dt>
            <dd>{{ commitCount }}</dd>
          </div>
        </dl>
        <label>
          New version
          <input v-model.trim="newVersion" type="text" placeholder="v1.2.3" :disabled="busy" />
        </label>
        <label>
          Changelog
          <textarea
            v-model="changelog"
            rows="6"
            placeholder="What changed in this release?"
            :disabled="busy"
          />
        </label>
        <button
          type="button"
          :disabled="!canPreview || busy"
          @click="previewRelease"
        >
          Preview file changes
        </button>

        <ul v-if="filePreviews" class="file-previews">
          <li v-if="filePreviews.length === 0">No version files are configured.</li>
          <li v-for="file in filePreviews" :key="file.path">
            <code>{{ file.path }}</code>
            <span :class="file.currentVersionFound ? 'good' : 'warning'">
              {{ file.currentVersionFound ? 'version found' : 'current version not found' }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div class="step" :class="{ disabled: !previewIsValid }">
      <div class="step-number">3</div>
      <div class="step-content">
        <h4>Create the release commit</h4>
        <p class="muted">
          This creates Git blobs, a tree, and a commit, but does not move the branch yet.
        </p>
        <button
          type="button"
          :disabled="!canCreateDraft || busy || draftCommit !== null"
          @click="createDraftCommit"
        >
          Create draft commit
        </button>
        <p v-if="draftCommit" class="message good">
          Draft commit created: <code>{{ shortSha(draftCommit.sha) }}</code>
        </p>
      </div>
    </div>

    <div class="step" :class="{ disabled: draftCommit === null }">
      <div class="step-number">4</div>
      <div class="step-content">
        <h4>Publish</h4>
        <p class="muted">
          Publishing creates the GitHub release and tag, then advances
          <strong>{{ branch.name }}</strong> to the draft commit.
        </p>
        <label class="confirmation">
          <input v-model="publishConfirmed" type="checkbox" :disabled="busy || !draftCommit" />
          I understand this writes to GitHub and moves the branch.
        </label>
        <button
          type="button"
          class="button-primary"
          :disabled="!draftCommit || !publishConfirmed || busy || publishedUrl !== null"
          @click="publishRelease"
        >
          Publish {{ newVersion || 'release' }}
        </button>
        <p v-if="publishedUrl" class="message good">
          Release published successfully.
          <a :href="publishedUrl" target="_blank" rel="noreferrer">View on GitHub</a>
        </p>
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Branch, Commit, Repo } from '@/model';
import type { ReleaseFilePreview } from '@/model/Branch';
import Version from '@/model/Version';

const props = defineProps<{
  repo: Repo;
  branch: Branch;
  commitCount: number;
}>();

const emit = defineEmits<{
  released: [];
}>();

const currentVersion = ref<string | null>(null);
const newVersion = ref('');
const changelog = ref('');
const versionFilesText = ref('');
const savedVersionFilesText = ref('');
const filePreviews = ref<ReleaseFilePreview[] | null>(null);
const draftCommit = ref<Commit | null>(null);
const publishConfirmed = ref(false);
const publishedUrl = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const settingsMessage = ref<string | null>(null);

const canPreview = computed(() => (
  props.repo.isEnabled &&
  currentVersion.value !== null &&
  versionFilesText.value === savedVersionFilesText.value &&
  newVersion.value.length > 0 &&
  Version.parse(newVersion.value) !== null &&
  newVersion.value !== currentVersion.value
));

const previewIsValid = computed(() => (
  filePreviews.value !== null &&
  filePreviews.value.every(file => file.currentVersionFound)
));
const canCreateDraft = computed(() => (
  previewIsValid.value && changelog.value.trim().length > 0
));

function suggestedNextVersion(version: string): string {
  const parsed = Version.parse(version);
  if (!parsed) return '';
  if (parsed.patch === undefined) {
    parsed.minor += 1;
  } else {
    parsed.patch += 1;
  }
  parsed.postamble = '';
  return Version.render(parsed);
}

async function load(): Promise<void> {
  versionFilesText.value = (
    props.repo.repoSettings?.filesContainingVersionNumbersToUpdate ?? []
  ).join('\n');
  savedVersionFilesText.value = versionFilesText.value;
  filePreviews.value = null;
  draftCommit.value = null;
  publishedUrl.value = null;
  error.value = null;

  try {
    const version = await props.branch.currentVersion();
    currentVersion.value = version.name;
    newVersion.value = suggestedNextVersion(version.name);
  } catch (caught) {
    currentVersion.value = null;
    error.value = messageFor(caught);
  }
}

async function saveSettings(): Promise<void> {
  await run(async () => {
    const filesContainingVersionNumbersToUpdate = versionFilesText.value
      .split('\n')
      .map(path => path.trim())
      .filter(Boolean);
    await props.repo.updateSettings({ filesContainingVersionNumbersToUpdate });
    savedVersionFilesText.value = versionFilesText.value;
    settingsMessage.value = 'Release settings saved.';
    filePreviews.value = null;
  });
}

async function disableWorkflow(): Promise<void> {
  await run(async () => {
    await props.repo.disableReleaseWorkflow();
    settingsMessage.value = 'Release workflow disabled for this repository.';
    filePreviews.value = null;
  });
}

async function previewRelease(): Promise<void> {
  await run(async () => {
    filePreviews.value = await props.branch.previewRelease(newVersion.value);
    draftCommit.value = null;
    publishConfirmed.value = false;
  });
}

async function createDraftCommit(): Promise<void> {
  await run(async () => {
    draftCommit.value = await props.branch.draftReleaseCommit(newVersion.value);
  });
}

async function publishRelease(): Promise<void> {
  if (!draftCommit.value) return;
  await run(async () => {
    const release = await props.branch.release(newVersion.value, changelog.value, draftCommit.value!);
    publishedUrl.value = release.html_url;
    emit('released');
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
  settingsMessage.value = null;
  try {
    await action();
  } catch (caught) {
    error.value = messageFor(caught);
  } finally {
    busy.value = false;
  }
}

function messageFor(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

watch(() => props.branch, () => load().catch(console.error), { immediate: true });
watch(newVersion, () => {
  filePreviews.value = null;
  draftCommit.value = null;
  publishConfirmed.value = false;
});
</script>

<style lang="scss" scoped>
.release-workflow {
  max-width: 780px;
  margin: 32px auto;
  text-align: left;
  border: 1px solid #d7dce2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 32px rgb(24 39 75 / 8%);
  overflow: hidden;
}

header {
  padding: 28px 32px;
  color: #fff;
  background: linear-gradient(135deg, #28384d, #405e7c);
}

header h3 { margin: 4px 0 8px; font-size: 1.6rem; }
.eyebrow { margin: 0; color: #a9d5ff; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.intro, .muted { color: #657081; }
header .intro { margin: 0; color: #dce8f3; }

.step { display: grid; grid-template-columns: 42px 1fr; gap: 16px; padding: 26px 32px; border-top: 1px solid #e9edf1; }
.step.disabled { opacity: .55; }
.step-number { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; font-weight: 800; border-radius: 50%; background: #365f82; }
.step-content h4 { margin: 4px 0 6px; font-size: 1.05rem; }
.muted { margin: 0 0 16px; font-size: .92rem; }

label { display: grid; gap: 7px; margin: 16px 0; font-weight: 700; }
input[type='text'], textarea { width: 100%; padding: 11px 12px; color: #273444; font: inherit; border: 1px solid #b9c3ce; border-radius: 8px; resize: vertical; }
input:focus, textarea:focus { outline: 3px solid rgb(55 132 190 / 20%); border-color: #3784be; }

button { padding: 10px 15px; color: #fff; font: inherit; font-weight: 750; border: 0; border-radius: 8px; background: #365f82; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
.button-secondary { color: #365f82; background: #e9f0f6; }
.button-primary { background: #137a54; }
.actions { display: flex; gap: 10px; }

.facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0; }
.facts div { padding: 12px; border-radius: 8px; background: #f3f6f9; }
.facts dt { color: #697687; font-size: .72rem; font-weight: 800; text-transform: uppercase; }
.facts dd { margin: 5px 0 0; font-weight: 750; }
.file-previews { padding: 0; list-style: none; }
.file-previews li { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid #edf0f3; }
.confirmation { display: flex; grid-template-columns: auto 1fr; align-items: center; font-weight: 500; }
.message { margin-bottom: 0; }
.good { color: #087747; }
.warning, .error { color: #a3421b; }
.error { margin: 0 32px 28px 90px; padding: 12px; border-radius: 8px; background: #fff0e9; }

@media (max-width: 700px) {
  .step { padding: 22px 18px; }
  .facts { grid-template-columns: 1fr; }
  .file-previews li { align-items: flex-start; flex-direction: column; }
}
</style>
