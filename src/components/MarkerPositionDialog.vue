<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';

const props = defineProps<{
  path: string;
  source: string;
  marker: string;
  modelValue: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [line: number];
}>();

const dialog = useTemplateRef('dialog');
const draftLine = ref<number | null>(null);

const lines = computed(() => props.source.split('\n'));

function open(): void {
  draftLine.value = props.modelValue;
  dialog.value?.showModal();
}

function close(): void {
  dialog.value?.close();
}

function confirm(): void {
  if (draftLine.value === null) return;
  emit('update:modelValue', draftLine.value);
  close();
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="marker-dialog" aria-labelledby="marker-dialog-title" @close="draftLine = null">
    <div class="dialog-layout">
      <header>
        <div>
          <p class="eyebrow">{{ path }}</p>
          <h3 id="marker-dialog-title">Choose the marker insertion point</h3>
          <p>Click a line to insert the marker after it.</p>
        </div>
        <button type="button" class="dialog-close" aria-label="Close insertion point chooser" @click="close">×</button>
      </header>

      <div class="dialog-content">
        <div class="source-file" aria-label="Changelog file contents">
          <template v-for="(line, index) in lines" :key="index">
            <button
              type="button"
              class="source-line"
              :class="{ selected: draftLine === index + 1 }"
              :aria-pressed="draftLine === index + 1"
              :aria-label="`Insert marker after line ${index + 1}`"
              @click="draftLine = index + 1"
            >
              <span class="line-number">{{ index + 1 }}</span>
              <code>{{ line || ' ' }}</code>
            </button>
            <template v-if="draftLine === index + 1">
              <div class="marker-placement">
                <span class="line-number added-line">+</span>
                <code>{{ marker }}</code>
              </div>
              <div class="marker-placement blank-line">
                <span class="line-number added-line">+</span>
                <code> </code>
              </div>
            </template>
          </template>
        </div>
      </div>

      <footer>
        <button type="button" class="button-secondary" @click="close">Cancel</button>
        <button type="button" :disabled="draftLine === null" @click="confirm">Done</button>
      </footer>
    </div>
  </dialog>
</template>

<style lang="scss" scoped>
.marker-dialog {
  width: min(1100px, calc(100vw - 48px));
  height: calc(100dvh - 48px);
  max-width: none;
  max-height: none;
  margin: auto;
  padding: 0;
  overflow: hidden;
  color: #273444;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 16px;
  background: #edf1f5;
  box-shadow: 0 28px 80px rgb(10 21 33 / 45%), 0 8px 24px rgb(10 21 33 / 24%);
}
.marker-dialog::backdrop { background: rgb(18 28 39 / 54%); }
.dialog-layout { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; height: 100%; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 20px 28px; color: #fff; background: linear-gradient(135deg, #28384d, #405e7c); }
header h3 { margin: 3px 0 5px; font-size: 1.25rem; }
header p:last-child { margin: 0; color: #dce8f3; }
.eyebrow { margin: 0; color: #a9d5ff; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
button { padding: 10px 15px; color: #fff; font: inherit; font-weight: 750; border: 0; border-radius: 8px; background: #365f82; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
.button-secondary { color: #365f82; background: #e9f0f6; }
.dialog-close { display: grid; flex: 0 0 auto; width: 36px; height: 36px; padding: 0; place-items: center; color: #fff; border-radius: 50%; background: rgb(255 255 255 / 12%); font-size: 1.6rem; font-weight: 400; }
.dialog-close:hover { background: rgb(255 255 255 / 22%); }
.dialog-content { min-height: 0; overflow-y: auto; padding: 24px; }
.source-file { max-width: 1100px; margin: 0 auto; overflow: hidden; color: #d9e2ec; border: 1px solid #293849; border-radius: 8px; background: #18222e; font: .78rem ui-monospace, monospace; }
.source-line, .marker-placement { display: grid; grid-template-columns: 48px minmax(0, 1fr); width: 100%; min-height: 25px; padding: 0; color: inherit; border-radius: 0; background: transparent; font: inherit; font-weight: 400; text-align: left; }
.source-line { cursor: pointer; }
.source-line:hover { color: inherit; background: #1d2b39; box-shadow: inset 0 -2px #62b5f1; }
.source-line.selected { color: inherit; background: #213345; box-shadow: inset 0 -3px #62b5f1; }
.line-number { padding: 4px 9px; color: #7f93a7; border-right: 1px solid rgb(159 176 193 / 16%); text-align: right; user-select: none; }
.source-line code, .marker-placement code { padding: 4px 10px; overflow-wrap: anywhere; white-space: pre-wrap; }
.marker-placement { color: #b9e1ff; background: #1f435e; }
.marker-placement .line-number { border-right-color: rgb(185 225 255 / 20%); }
.marker-placement .added-line { color: #72d995; font-weight: 800; }
.marker-placement.blank-line { min-height: 19px; }
footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #cdd5dd; background: #fff; }
@media (max-width: 720px) {
  .marker-dialog { width: calc(100vw - 20px); height: calc(100dvh - 20px); border-radius: 12px; }
  header { padding: 18px; }
  .dialog-content { padding: 12px; }
  footer { padding: 12px; }
}
</style>
