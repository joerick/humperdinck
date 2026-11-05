<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeaderIcon from './HeaderIcon.vue';

const props = defineProps<{
  branch: string;
  branches: string[];
  defaultBranch: string;
  loading: boolean;
  error: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
const route = useRoute();
const router = useRouter();
const picker = useTemplateRef('picker');
const searchInput = useTemplateRef('searchInput');
const search = ref('');
const navigationError = ref('');
const visibleBranches = computed(() => props.branches.filter(branch => branch.toLowerCase().includes(search.value.trim().toLowerCase())));

function close(): void { picker.value?.removeAttribute('open'); }
async function opened(): Promise<void> {
  if (!picker.value?.open) return;
  search.value = '';
  navigationError.value = '';
  await nextTick();
  searchInput.value?.focus();
}
watch(() => props.disabled, disabled => { if (disabled) close(); });
watch(() => route.fullPath, close);

async function selectBranch(branch: string): Promise<void> {
  if (props.disabled) return;
  if (branch === props.branch) { close(); return; }
  navigationError.value = '';
  try {
    const failure = await router.push({
      name: route.name === 'repo-settings' ? 'repo-settings' : 'repo-branch',
      params: { owner: route.params.owner, repoName: route.params.repoName, branch },
    });
    // The label follows the confirmed route, so cancellation preserves it and the form.
    if (!failure) close();
  } catch (error) {
    navigationError.value = error instanceof Error ? error.message : String(error);
  }
}
</script>
<template>
  <details ref="picker" class="branch-picker" @toggle="opened">
    <summary :aria-label="`Switch branch: ${branch}`" :title="branch" :aria-disabled="disabled" @click="disabled && $event.preventDefault()">
      <HeaderIcon name="branch" /><span>{{ branch }}</span>
    </summary>
    <div class="branch-menu">
      <div class="menu-title">Switch branch <span>{{ route.params.repoName }}</span></div>
      <label class="search"><HeaderIcon name="search" /><input ref="searchInput" v-model="search" type="search" aria-label="Find a branch" placeholder="Find a branch…" /></label>
      <p v-if="loading" class="status" role="status">Loading branches…</p>
      <div v-else-if="error" class="status" role="alert">Could not load branches. <button type="button" :disabled="disabled" @click="emit('retry')">Retry</button></div>
      <div v-else class="options" role="group" aria-label="Branches">
        <button v-for="name in visibleBranches" :key="name" type="button" :class="{ chosen: name === branch }" :aria-current="name === branch ? 'true' : undefined" :disabled="disabled" @click="selectBranch(name)">
          <HeaderIcon name="branch" /><span class="option-text">{{ name }}<small v-if="name === defaultBranch">Default branch</small></span><HeaderIcon v-if="name === branch" name="check" class="check" />
        </button>
        <p v-if="!visibleBranches.length" class="status">No matching branches.</p>
      </div>
      <p v-if="navigationError" class="status error" role="alert">{{ navigationError }}</p>
    </div>
  </details>
</template>
<style scoped>
.branch-picker { min-width:0; position:relative; max-width:240px; color:#556375; }
summary { display:flex; align-items:center; gap:8px; min-width:0; min-height:36px; padding:0 8px; border-radius:6px; cursor:pointer; list-style:none; font-size:14px; font-weight:500; line-height:20px; }
summary::-webkit-details-marker { display:none; }
summary span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
summary:hover, [open]>summary { background:#edf2f7; }
summary:focus-visible { outline:2px solid #3764ce; outline-offset:3px; }
summary[aria-disabled="true"] { opacity:.55; cursor:wait; }
summary .header-icon { color:#6b7888; }
.branch-menu { position:absolute; top:calc(100% + 10px); right:0; z-index:50; width:330px; max-width:calc(100vw - 24px); border:1px solid #d6dee7; border-radius:10px; background:#fff; box-shadow:0 16px 40px #22334a24,0 3px 8px #22334a0a; overflow:hidden; }
.menu-title { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px 16px 11px; color:#29394c; font-size:13px; font-weight:650; }
.menu-title>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:400; color:#8390a0; }
.search { display:flex; gap:8px; align-items:center; margin:0 12px 10px; padding:0 10px; border:1px solid #d7dfe8; border-radius:6px; color:#8491a0; background:#fafbfd; }
.search:focus-within { border-color:#6488c4; box-shadow:0 0 0 2px #3764ce15; }
.search .header-icon { width:16px; height:16px; flex-basis:16px; }
input { width:100%; min-width:0; padding:9px 0; border:0; outline:0; background:transparent; color:#29394c; font:inherit; font-size:12px; }
input::placeholder { color:#8a96a5; }
.options { display:grid; gap:2px; max-height:min(330px,55vh); overflow:auto; padding:0 6px 7px; }
.options button { display:flex; align-items:center; gap:10px; width:100%; padding:10px; border:0; border-radius:6px; background:transparent; color:#34445a; text-align:left; font:inherit; font-size:13px; cursor:pointer; }
.options button:hover { background:#f2f5f9; }
.options button.chosen { background:#f0f5fc; }
.options .header-icon { color:#8591a0; }
.option-text { flex:1; min-width:0; overflow-wrap:anywhere; font-weight:500; }
.option-text small { display:block; margin-top:3px; font-size:11px; color:#8390a0; font-weight:400; }
.options .check { color:#3764ce; }
.status { margin:0; padding:12px 16px; color:#8390a0; font-size:12px; }
.status button { border:0; background:none; color:#3764ce; font:inherit; cursor:pointer; }
.error { color:#a3421b; }
@media(max-width:720px) {
 .branch-picker { position:static; flex-shrink:0; max-width:44%; }
 summary { gap:5px; padding:0 5px; font-size:13px; }
 .branch-menu { top:calc(100% - 1px); left:12px; width:calc(100vw - 24px); }
}
</style>
