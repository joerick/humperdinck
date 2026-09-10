<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { computedAsync, useAsyncState } from '@vueuse/core';
import type { Branch } from '@/model';
import { createLineDiff, type DiffLine } from '@/diff';
import {
  DEFAULT_TAG_PATTERN,
  RELEASE_CONFIG_PATH,
  emptyReleaseConfig,
  expandVersionFind,
  findChangelogMarker,
  parseReleaseConfig,
  renderReleaseConfig,
  type ReleaseConfig,
} from '@/model/ReleaseConfig';

const props = defineProps<{
  branch: Branch;
  initialConfig: ReleaseConfig | null;
}>();

const emit = defineEmits<{
  saved: [config: ReleaseConfig];
}>();

const config = ref<ReleaseConfig>(emptyReleaseConfig());
const busy = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const markerStatus = ref<string | null>(null);
const tagPatternPreset = ref<'starts-with-v' | 'any' | 'custom'>('starts-with-v');
const versionFileStatuses = ref<Record<number, { checking?: boolean; found?: boolean; preview?: string; error?: string }>>({});
const changelogSource = ref<string | null>(null);
const changelogMarkerLine = ref(1);
const changelogOrder = ref<'newest-first' | 'newest-last'>('newest-first');
const changelogHeading = ref(2);
const configPath = ref(RELEASE_CONFIG_PATH);
const settingsLoading = ref(false);

const yamlPreview = computed(() => renderReleaseConfig(config.value));
const ANY_TAG_PATTERN = '(?<version>\\d.*)';
const loadedSettings = computedAsync(async () => {
  const branch = props.branch;
  const initialConfig = props.initialConfig;
  const loadedConfig = initialConfig
    ? parseReleaseConfig(renderReleaseConfig(initialConfig))
    : emptyReleaseConfig();
  try {
    const [path, source] = await Promise.all([
      branch.releaseConfigPath(),
      branch.fileContents(loadedConfig.changelog.path),
    ]);
    return { branch, config: loadedConfig, path: path ?? RELEASE_CONFIG_PATH, source, error: null };
  } catch (caught) {
    return {
      branch,
      config: loadedConfig,
      path: RELEASE_CONFIG_PATH,
      source: null,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}, null, { evaluating: settingsLoading });
const versionFileRequest = useAsyncState(
  async (branch: Branch, releaseConfig: ReleaseConfig, path: string, find: string | undefined) => {
    const [release, source] = await Promise.all([
      branch.latestRelease(releaseConfig),
      branch.fileContents(path),
    ]);
    const preview = expandVersionFind(find, release.version);
    return { preview, found: source.includes(preview) };
  },
  null,
  { immediate: false, throwError: true, onError: () => undefined },
);
const changelogRequest = useAsyncState(
  async (branch: Branch, path: string) => ({ branch, path, source: await branch.fileContents(path) }),
  null,
  { immediate: false, throwError: true, onError: () => undefined },
);
const loading = computed(() => (
  busy.value || settingsLoading.value || versionFileRequest.isLoading.value || changelogRequest.isLoading.value
));
const existingChangelogMarker = computed(() => (
  changelogSource.value === null ? null : findChangelogMarker(changelogSource.value)
));
const changelogLines = computed(() => changelogSource.value?.split('\n') ?? []);
const renderedChangelogMarker = computed(() => (
  `<!-- humperdinck: releases order=${changelogOrder.value} heading=${changelogHeading.value} -->`
));
const updatedChangelogSource = computed(() => {
  if (changelogSource.value === null) return null;
  const marker = existingChangelogMarker.value;
  if (marker) {
    return changelogSource.value.slice(0, marker.index) + renderedChangelogMarker.value +
      changelogSource.value.slice(marker.index + marker.length);
  }
  const lines = [...changelogLines.value];
  lines.splice(Math.max(0, changelogMarkerLine.value - 1), 0, renderedChangelogMarker.value);
  return lines.join('\n');
});
const changePreviews = computed(() => {
  const originalYaml = props.initialConfig ? renderReleaseConfig(props.initialConfig) : '';
  const previews: Array<{ path: string; lines: DiffLine[] }> = [];
  if (originalYaml !== yamlPreview.value) {
    previews.push({ path: configPath.value, lines: createLineDiff(originalYaml, yamlPreview.value) });
  }
  if (
    changelogSource.value !== null &&
    updatedChangelogSource.value !== null &&
    changelogSource.value !== updatedChangelogSource.value
  ) {
    previews.push({
      path: config.value.changelog.path,
      lines: createLineDiff(changelogSource.value, updatedChangelogSource.value),
    });
  }
  return previews;
});
const hasChanges = computed(() => changePreviews.value.length > 0);

function reset(): void {
  config.value = props.initialConfig
    ? parseReleaseConfig(renderReleaseConfig(props.initialConfig))
    : emptyReleaseConfig();
  tagPatternPreset.value = config.value.tagPattern === DEFAULT_TAG_PATTERN
    ? 'starts-with-v'
    : config.value.tagPattern === ANY_TAG_PATTERN ? 'any' : 'custom';
  error.value = null;
  message.value = null;
  markerStatus.value = null;
  versionFileStatuses.value = {};
  changelogSource.value = null;
  changelogMarkerLine.value = 1;
  changelogOrder.value = 'newest-first';
  changelogHeading.value = 2;
  configPath.value = RELEASE_CONFIG_PATH;
}

function selectTagPattern(): void {
  if (tagPatternPreset.value === 'starts-with-v') config.value.tagPattern = DEFAULT_TAG_PATTERN;
  if (tagPatternPreset.value === 'any') config.value.tagPattern = ANY_TAG_PATTERN;
}

function addVersionFile(): void {
  config.value.versionFiles.push({ path: '' });
}

function removeVersionFile(index: number): void {
  config.value.versionFiles.splice(index, 1);
}

async function validateVersionFile(index: number): Promise<void> {
  const file = config.value.versionFiles[index];
  if (!file?.path) return;
  const branch = props.branch;
  const path = file.path;
  versionFileStatuses.value[index] = { checking: true };
  try {
    const result = await versionFileRequest.execute(0, branch, config.value, path, file.find);
    if (result && props.branch === branch && config.value.versionFiles[index]?.path === path) {
      versionFileStatuses.value[index] = result;
    }
  } catch (caught) {
    versionFileStatuses.value[index] = {
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

async function validateChangelog(): Promise<void> {
  const branch = props.branch;
  const path = config.value.changelog.path;
  error.value = null;
  markerStatus.value = null;
  try {
    const result = await changelogRequest.execute(0, branch, path);
    if (result && props.branch === result.branch && config.value.changelog.path === result.path) {
      applyChangelogSource(result.source);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  }
}

function applyChangelogSource(source: string): void {
  changelogSource.value = source;
  const marker = existingChangelogMarker.value;
  if (marker) {
    changelogOrder.value = marker.order;
    changelogHeading.value = marker.heading;
    changelogMarkerLine.value = source.slice(0, marker.index).split('\n').length;
    markerStatus.value = `Marker found on line ${changelogMarkerLine.value}.`;
  } else {
    changelogMarkerLine.value = Math.min(2, changelogLines.value.length + 1);
    markerStatus.value = 'No marker found. Choose where to insert it below.';
  }
}

async function save(): Promise<void> {
  if (!hasChanges.value) return;
  await run(async () => {
    const validated = parseReleaseConfig(yamlPreview.value);
    if (changelogSource.value === null || updatedChangelogSource.value === null) {
      throw new Error('The changelog file could not be loaded. Check its path before saving.');
    }
    if (!findChangelogMarker(updatedChangelogSource.value)) {
      throw new Error('The changelog marker configuration is incomplete.');
    }
    const changelogChanged = updatedChangelogSource.value !== changelogSource.value;
    await props.branch.saveReleaseConfig(validated, changelogChanged ? [{
      path: validated.changelog.path,
      contents: updatedChangelogSource.value,
    }] : []);
    config.value = validated;
    message.value = `${configPath.value} committed to ${props.branch.name}.`;
    window.dispatchEvent(new CustomEvent('humperdinck:release-config-saved', {
      detail: {
        key: `${props.branch.repo.ownerUsername}/${props.branch.repo.name}`,
        branch: props.branch.name,
      },
    }));
    emit('saved', validated);
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
  message.value = null;
  markerStatus.value = null;
  try {
    await action();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    busy.value = false;
  }
}

watch([() => props.branch, () => props.initialConfig], () => {
  reset();
}, { immediate: true });
watch(loadedSettings, loaded => {
  if (!loaded || loaded.branch !== props.branch) return;
  config.value = loaded.config;
  configPath.value = loaded.path;
  error.value = loaded.error;
  if (loaded.source !== null) applyChangelogSource(loaded.source);
}, { immediate: true });
</script>

<template>
  <section class="settings-card">
    <header>
      <p class="eyebrow">Branch settings</p>
      <h3>Configure releases from {{ branch.name }}</h3>
      <p>
        Saving commits <code>{{ configPath }}</code> directly to this branch.
        Other branches can carry different release settings.
      </p>
    </header>

    <div class="settings-section">
      <div class="section-heading">
        <div>
          <h4>Files containing version numbers</h4>
          <p class="hint">Optionally narrow where the current version is found using <code>#</code> as its placeholder.</p>
        </div>
        <button type="button" class="button-secondary" :disabled="loading" @click="addVersionFile">
          Add file
        </button>
      </div>

      <div v-if="config.versionFiles.length === 0" class="empty-row">
        No version files yet. Releases can still update the changelog.
      </div>
      <div v-for="(file, index) in config.versionFiles" :key="index" class="version-file">
        <label class="path-field">
          File path
          <input v-model.trim="file.path" type="text" placeholder="package.json" :disabled="loading" @blur="validateVersionFile(index)" />
        </label>
        <label class="find-field">
          Find (optional)
          <input
            v-model="file.find"
            type="text"
            placeholder="__version__ = &quot;#&quot;"
            :disabled="loading"
            @blur="validateVersionFile(index)"
          />
        </label>
        <button
          type="button"
          class="remove"
          :disabled="loading"
          :aria-label="`Remove ${file.path || 'version file'}`"
          title="Remove file"
          @click="removeVersionFile(index)"
        >
          ×
        </button>
        <small v-if="versionFileStatuses[index]?.checking" class="file-status">Checking file…</small>
        <small v-else-if="versionFileStatuses[index]?.found" class="file-status good">
          ✓ Found <code>{{ versionFileStatuses[index]?.preview }}</code> at branch head
        </small>
        <small v-else-if="versionFileStatuses[index]?.preview" class="file-status bad">
          × <code>{{ versionFileStatuses[index]?.preview }}</code> was not found at branch head
        </small>
        <small v-else-if="versionFileStatuses[index]?.error" class="file-status bad">
          × {{ versionFileStatuses[index]?.error }}
        </small>
      </div>
    </div>

    <div class="settings-section">
      <label>
        Markdown changelog path
        <input
          v-model.trim="config.changelog.path"
          type="text"
          placeholder="CHANGELOG.md"
          :disabled="loading"
          @blur="validateChangelog"
        />
      </label>
      <p
        v-if="markerStatus"
        class="marker-status"
        :class="{ good: existingChangelogMarker, warning: !existingChangelogMarker }"
      >
        {{ existingChangelogMarker ? `✓ Marker on line ${changelogMarkerLine}` : markerStatus }}
      </p>

      <div v-if="changelogSource !== null" class="marker-editor">
        <div v-if="!existingChangelogMarker" class="marker-position">
          <label>
            Insert marker before
            <select v-model.number="changelogMarkerLine" :disabled="loading">
              <option v-for="(line, index) in changelogLines" :key="index" :value="index + 1">
                Line {{ index + 1 }} — {{ line.trim() || '(blank line)' }}
              </option>
              <option :value="changelogLines.length + 1">End of file</option>
            </select>
          </label>
        </div>
        <div class="marker-options">
          <label>
            Ordering
            <select v-model="changelogOrder" :disabled="loading">
              <option value="newest-first">Newest first</option>
              <option value="newest-last">Newest last</option>
            </select>
          </label>
          <label>
            Version heading level
            <select v-model.number="changelogHeading" :disabled="loading">
              <option v-for="level in 6" :key="level" :value="level">
                {{ '#'.repeat(level) }} Heading {{ level }}
              </option>
            </select>
          </label>
        </div>
        <p class="hint">Marker preview: <code>{{ renderedChangelogMarker }}</code></p>
      </div>
    </div>

    <div class="settings-section tag-settings">
      <details :open="tagPatternPreset === 'custom'">
        <summary>Advanced: release tag format</summary>
        <div class="advanced-content">
          <label>
            Tags to treat as releases
            <select v-model="tagPatternPreset" :disabled="loading" @change="selectTagPattern">
              <option value="starts-with-v">Starts with “v”</option>
              <option value="any">Any tag containing a version</option>
              <option value="custom">Custom regular expression</option>
            </select>
          </label>
          <label v-if="tagPatternPreset === 'custom'">
            Custom regular expression
            <input v-model="config.tagPattern" type="text" :disabled="loading" />
          </label>
          <p class="hint">
            The expression uses a named <code>version</code> group. The default is
            <code>{{ DEFAULT_TAG_PATTERN }}</code>.
          </p>
        </div>
      </details>
    </div>

    <details v-if="hasChanges" class="changes-preview">
      <summary>Preview changes</summary>
      <div v-for="preview in changePreviews" :key="preview.path" class="change-preview">
        <strong>{{ preview.path }}</strong>
        <div class="diff" role="table" :aria-label="`Changes to ${preview.path}`">
          <div class="diff-file-header">--- a/{{ preview.path }}</div>
          <div class="diff-file-header">+++ b/{{ preview.path }}</div>
          <div v-for="(line, index) in preview.lines" :key="index" class="diff-line" :class="line.kind">
            <span class="line-number">{{ line.oldLine ?? '' }}</span>
            <span class="line-number">{{ line.newLine ?? '' }}</span>
            <code><span class="prefix">{{ line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '-' : ' ' }}</span>{{ line.content }}</code>
          </div>
        </div>
      </div>
    </details>

    <div class="save-row">
      <p v-if="hasChanges" class="hint">This action creates a commit on <strong>{{ branch.name }}</strong>.</p>
      <button type="button" :disabled="loading || !hasChanges" @click="save">
        {{ initialConfig ? 'Commit settings update' : 'Create settings file' }}
      </button>
    </div>

    <p v-if="message" class="message good">{{ message }}</p>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
  </section>
</template>

<style lang="scss" scoped>
.settings-card { max-width: 850px; margin: 30px auto; text-align: left; border: 1px solid #d7dce2; border-radius: 16px; background: #fff; box-shadow: 0 12px 32px rgb(24 39 75 / 8%); overflow: hidden; }
header { padding: 28px 32px; color: #fff; background: linear-gradient(135deg, #28384d, #405e7c); }
header h3 { margin: 4px 0 8px; font-size: 1.55rem; }
header p:last-child { margin-bottom: 0; color: #dce8f3; }
.eyebrow { margin: 0; color: #a9d5ff; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.settings-section { padding: 24px 32px; border-top: 1px solid #e9edf1; }
.section-heading, .save-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
h4 { margin: 0 0 5px; }
label { display: grid; gap: 7px; font-weight: 700; }
input, select { width: 100%; padding: 11px 12px; color: #273444; font: inherit; border: 1px solid #b9c3ce; border-radius: 8px; background: #fff; }
input:focus { outline: 3px solid rgb(55 132 190 / 20%); border-color: #3784be; }
input::placeholder { color: #718092; opacity: .42; }
.tag-settings summary { cursor: pointer; color: #43566a; font-weight: 750; }
.advanced-content { display: grid; gap: 14px; margin-top: 16px; }
.hint { margin: 8px 0 0; color: #657081; font-size: .9rem; }
.version-file {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) 30px;
  grid-template-areas:
    'path find remove'
    '. status .';
  column-gap: 12px;
  row-gap: 7px;
  align-items: end;
  margin-top: 16px;
  padding: 16px;
  border-radius: 10px;
  background: #f3f6f9;
}
.path-field { grid-area: path; }
.find-field { grid-area: find; }
.empty-row { margin-top: 16px; padding: 18px; color: #657081; border: 1px dashed #bdc7d2; border-radius: 10px; }
.file-status { grid-area: status; min-height: 1.2em; color: #657081; font-weight: 600; }
.file-status.good { color: #087747; background: none; }
.file-status.bad { color: #a3421b; }
button { padding: 10px 15px; color: #fff; font: inherit; font-weight: 750; border: 0; border-radius: 8px; background: #365f82; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
.button-secondary { color: #365f82; background: #e9f0f6; }
.remove { grid-area: remove; align-self: end; display: grid; width: 30px; height: 30px; margin-bottom: 7px; padding: 0; place-items: center; color: #c43b37; border-radius: 50%; background: transparent; font-size: 1.6rem; font-weight: 400; line-height: 1; }
.remove:hover { background: #ffe9e7; }
.marker-status { display: inline-block; margin: 8px 0 0; color: #657081; font-size: .82rem; }
.marker-status.good { padding: 0; color: #087747; background: none; }
.marker-status.warning { color: #9a5b16; }
.marker-editor { display: grid; gap: 15px; margin-top: 16px; padding: 16px; border: 1px solid #d9e1e8; border-radius: 10px; background: #f8fafc; }
.marker-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.changes-preview { margin: 0 32px 24px; }
.changes-preview summary { cursor: pointer; font-weight: 700; }
.change-preview { margin-top: 14px; }
.change-preview strong { font-family: ui-monospace, monospace; }
.diff { overflow-x: auto; margin-top: 8px; color: #d9e2ec; border: 1px solid #293849; border-radius: 8px; background: #18222e; font: .78rem ui-monospace, monospace; }
.diff-file-header { padding: 2px 12px; color: #9fb0c1; }
.diff-file-header:first-child { padding-top: 9px; }
.diff-file-header:nth-child(2) { padding-bottom: 7px; border-bottom: 1px solid #344557; }
.diff-line { display: grid; grid-template-columns: 42px 42px minmax(max-content, 1fr); min-height: 22px; }
.diff-line.addition { color: #b7efc5; background: #173b2b; }
.diff-line.deletion { color: #ffd0cc; background: #482727; }
.diff-line.skip { color: #92a5b8; background: #203044; }
.line-number { padding: 3px 7px; color: #7f93a7; border-right: 1px solid rgb(159 176 193 / 16%); text-align: right; user-select: none; }
.diff-line code { padding: 3px 10px; white-space: pre; }
.prefix { display: inline-block; width: 1.4em; user-select: none; }
.no-changes { margin: 12px 0 0; color: #657081; font-size: .9rem; }
.save-row { padding: 22px 32px; border-top: 1px solid #e9edf1; background: #f8fafc; }
.save-row button { margin-left: auto; }
.message { margin: 0 32px 22px; padding: 12px; border-radius: 8px; }
.good { color: #087747; background: #e4f6ed; }
.error { color: #a3421b; background: #fff0e9; }
@media (max-width: 720px) {
  .settings-section, header { padding: 22px 18px; }
  .version-file {
    grid-template-columns: minmax(0, 1fr) 30px;
    grid-template-areas:
      'path remove'
      'find find'
      'status status';
  }
  .section-heading, .save-row { align-items: stretch; flex-direction: column; }
}
</style>
