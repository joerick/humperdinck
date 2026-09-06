<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Branch, Commit } from '@/model';
import { nextVersion, type ReleaseConfig } from '@/model/ReleaseConfig';
import type { ChangelogPreview, ReleasePlan, ReleaseTag } from '@/model/Branch';

const props = defineProps<{
  branch: Branch;
  config: ReleaseConfig;
  currentRelease: ReleaseTag;
}>();

const emit = defineEmits<{
  released: [];
}>();

type Increment = 'major' | 'minor' | 'patch' | 'custom';

const increment = ref<Increment>('patch');
const customVersion = ref('');
const notes = ref('');
const changelog = ref<ChangelogPreview | null>(null);
const plan = ref<ReleasePlan | null>(null);
const draftCommit = ref<Commit | null>(null);
const publishConfirmed = ref(false);
const publishedUrl = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const newVersion = computed(() => {
  if (increment.value === 'custom') return customVersion.value.trim();
  const incrementedVersion = nextVersion(props.currentRelease.version, increment.value);
  return props.currentRelease.tag.replace(props.currentRelease.version, incrementedVersion);
});

const planIsValid = computed(() => (
  plan.value !== null && plan.value.files.every(file => file.versionFound !== false)
));

async function load(): Promise<void> {
  resetDraft();
  notes.value = '';
  error.value = null;
  try {
    changelog.value = await props.branch.changelogPreview(props.config);
  } catch (caught) {
    changelog.value = null;
    error.value = messageFor(caught);
  }
}

function resetDraft(): void {
  plan.value = null;
  draftCommit.value = null;
  publishConfirmed.value = false;
  publishedUrl.value = null;
}

async function previewRelease(): Promise<void> {
  await run(async () => {
    plan.value = await props.branch.planRelease(props.config, newVersion.value, notes.value);
    draftCommit.value = null;
    publishConfirmed.value = false;
  });
}

async function createDraft(): Promise<void> {
  if (!plan.value) return;
  await run(async () => {
    draftCommit.value = await props.branch.createDraftCommit(plan.value!);
  });
}

async function publish(): Promise<void> {
  if (!plan.value || !draftCommit.value) return;
  await run(async () => {
    const release = await props.branch.publishRelease(plan.value!, draftCommit.value!);
    publishedUrl.value = release.html_url;
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
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

watch(
  [() => props.branch, () => props.config, () => props.currentRelease],
  () => load().catch(console.error),
  { immediate: true },
);
watch([increment, customVersion, notes], resetDraft);
</script>

<template>
  <section class="release-workflow">
    <header>
      <p class="eyebrow">Create release</p>
      <h3>Release from {{ branch.name }}</h3>
      <p>Preview the exact repository changes, create a reviewable commit, then publish.</p>
    </header>

    <div class="step">
      <div class="step-number">1</div>
      <div class="step-content">
        <h4>Choose the next version</h4>
        <p class="muted">The latest release on this branch is <strong>{{ currentRelease.tag }}</strong>.</p>
        <div class="increments">
          <label v-for="choice in (['major', 'minor', 'patch', 'custom'] as const)" :key="choice">
            <input v-model="increment" type="radio" :value="choice" :disabled="busy" />
            {{ choice }}
          </label>
        </div>
        <input
          v-if="increment === 'custom'"
          v-model="customVersion"
          type="text"
          placeholder="v2.0.0-rc.1"
          :disabled="busy"
        />
        <p class="next-version">New version: <strong>{{ newVersion || 'Enter a version' }}</strong></p>
      </div>
    </div>

    <div class="step" :class="{ disabled: !changelog }">
      <div class="step-number">2</div>
      <div class="step-content">
        <h4>Write the release notes</h4>
        <p class="muted">
          This entry will be written to <code>{{ config.changelog.path }}</code> and used as the GitHub release description.
        </p>
        <div v-if="changelog" class="changelog-editor">
          <pre>{{ changelog.beforeMarker }}</pre>
          <div v-if="changelog.marker.order === 'newest-first'" class="marker">{{ changelog.marker.source }}</div>
          <div class="editable-entry">
            <strong>{{ '#'.repeat(changelog.marker.heading) }} {{ newVersion }}</strong>
            <textarea
              v-model="notes"
              rows="8"
              placeholder="Describe the changes in Markdown…"
              :disabled="busy"
            />
          </div>
          <div v-if="changelog.marker.order === 'newest-last'" class="marker">{{ changelog.marker.source }}</div>
          <pre>{{ changelog.afterMarker }}</pre>
        </div>
      </div>
    </div>

    <div class="step" :class="{ disabled: !notes.trim() || !newVersion }">
      <div class="step-number">3</div>
      <div class="step-content">
        <h4>Preview repository changes</h4>
        <button type="button" :disabled="!notes.trim() || !newVersion || busy" @click="previewRelease">
          Build preview
        </button>
        <ul v-if="plan" class="file-list">
          <li v-for="file in plan.files" :key="file.path">
            <code>{{ file.path }}</code>
            <span v-if="file.versionFound === false" class="warning">
              {{ file.foundVersion ? `found ${file.foundVersion}; it does not match ${currentRelease.tag}` : 'version pattern not found' }}
            </span>
            <span v-else class="good">ready</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="step" :class="{ disabled: !planIsValid }">
      <div class="step-number">4</div>
      <div class="step-content">
        <h4>Create a reviewable draft commit</h4>
        <p class="muted">The commit is created without moving {{ branch.name }}.</p>
        <button type="button" :disabled="!planIsValid || busy || draftCommit !== null" @click="createDraft">
          Create draft commit
        </button>
        <p v-if="draftCommit" class="message good">
          Draft <code>{{ shortSha(draftCommit.sha) }}</code> is ready.
          <a :href="branch.draftDiffUrl(draftCommit)" target="_blank" rel="noreferrer">Review the diff on GitHub</a>
        </p>
      </div>
    </div>

    <div class="step" :class="{ disabled: !draftCommit }">
      <div class="step-number">5</div>
      <div class="step-content">
        <h4>Publish the release</h4>
        <p class="muted">
          This advances <strong>{{ branch.name }}</strong>, creates tag <strong>{{ newVersion }}</strong>,
          and publishes the GitHub release.
        </p>
        <label class="confirmation">
          <input v-model="publishConfirmed" type="checkbox" :disabled="busy || !draftCommit" />
          I have reviewed the diff and want to publish this release.
        </label>
        <button
          type="button"
          class="button-primary"
          :disabled="!draftCommit || !publishConfirmed || busy || publishedUrl !== null"
          @click="publish"
        >
          Publish {{ newVersion || 'release' }}
        </button>
        <p v-if="publishedUrl" class="message good">
          Release published. <a :href="publishedUrl" target="_blank" rel="noreferrer">View it on GitHub</a>
          <button type="button" class="button-inline" @click="emit('released')">Refresh release state</button>
        </p>
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style lang="scss" scoped>
.release-workflow { max-width: 850px; margin: 30px auto; text-align: left; border: 1px solid #d7dce2; border-radius: 16px; background: #fff; box-shadow: 0 12px 32px rgb(24 39 75 / 8%); overflow: hidden; }
header { padding: 28px 32px; color: #fff; background: linear-gradient(135deg, #28384d, #405e7c); }
header h3 { margin: 4px 0 8px; font-size: 1.55rem; }
header p:last-child { margin-bottom: 0; color: #dce8f3; }
.eyebrow { margin: 0; color: #a9d5ff; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.step { display: grid; grid-template-columns: 42px 1fr; gap: 16px; padding: 26px 32px; border-top: 1px solid #e9edf1; }
.step.disabled { opacity: .55; }
.step-number { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; font-weight: 800; border-radius: 50%; background: #365f82; }
.step-content h4 { margin: 4px 0 6px; font-size: 1.05rem; }
.muted { margin: 0 0 16px; color: #657081; font-size: .92rem; }
.increments { display: flex; flex-wrap: wrap; gap: 8px; }
.increments label { padding: 8px 12px; border: 1px solid #c8d0d8; border-radius: 999px; text-transform: capitalize; }
.next-version { font-size: 1.05rem; }
input[type='text'], textarea { width: 100%; padding: 11px 12px; color: #273444; font: inherit; border: 1px solid #b9c3ce; border-radius: 8px; resize: vertical; }
input:focus, textarea:focus { outline: 3px solid rgb(55 132 190 / 20%); border-color: #3784be; }
.changelog-editor { overflow: hidden; border: 1px solid #cdd5dd; border-radius: 10px; background: #f6f8fa; }
.changelog-editor pre { max-height: 180px; overflow: auto; margin: 0; padding: 15px; color: #66717e; white-space: pre-wrap; }
.marker { padding: 8px 15px; color: #587087; font: .78rem ui-monospace, monospace; border-block: 1px dashed #bac7d2; background: #edf3f7; }
.editable-entry { display: grid; gap: 10px; padding: 18px; background: #fff; }
.editable-entry strong { font: 700 1rem ui-monospace, monospace; }
button { padding: 10px 15px; color: #fff; font: inherit; font-weight: 750; border: 0; border-radius: 8px; background: #365f82; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
.button-primary { background: #137a54; }
.button-inline { margin-left: 10px; padding: 5px 8px; color: #087747; background: #dff5ea; }
.file-list { padding: 0; list-style: none; }
.file-list li { display: flex; justify-content: space-between; gap: 15px; padding: 9px 0; border-bottom: 1px solid #edf0f3; }
.confirmation { display: flex; align-items: center; gap: 8px; margin: 16px 0; }
.message { margin-bottom: 0; padding: 12px; border-radius: 8px; }
.good { color: #087747; }
.warning, .error { color: #a3421b; }
.error { margin: 0 32px 28px 90px; padding: 12px; border-radius: 8px; background: #fff0e9; }
@media (max-width: 720px) { .step { padding: 22px 18px; } .file-list li { align-items: flex-start; flex-direction: column; } }
</style>
