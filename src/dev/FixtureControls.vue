<script setup lang="ts">
import { fixtureState } from './fixture-auth';
</script>

<template>
  <details class="fixture-controls">
    <summary>Local UI fixture</summary>
    <p>Sample account · in-memory writes · reload to reset</p>
    <a href="/example/humperdinck/branches/main">Open sample repository</a>
    <label>Writes
      <select v-model="fixtureState.saveResult" aria-label="Fixture write result">
        <option value="success">Succeed</option><option value="failure">Fail</option>
      </select>
    </label>
    <label>Write delay
      <select v-model.number="fixtureState.delayMs" aria-label="Fixture write delay">
        <option :value="0">Instant</option><option :value="800">800 ms</option><option :value="5000">5 seconds</option>
      </select>
    </label>
    <label>Discard confirmation
      <select v-model="fixtureState.confirmation" aria-label="Fixture discard confirmation">
        <option value="native">Native dialog</option><option value="cancel">Auto-cancel (automation)</option><option value="allow">Auto-allow (automation)</option>
      </select>
    </label>
    <p role="status">{{ fixtureState.lastAction }}</p>
  </details>
</template>

<style scoped>
.fixture-controls { position:fixed; bottom:12px; right:12px; z-index:1000; max-width:calc(100vw - 24px); width:300px; border:1px solid #64748b; border-radius:10px; background:#172335; color:#fff; padding:12px; font:13px/1.5 system-ui; box-shadow:0 4px 20px #0003; }
summary { cursor:pointer; font-weight:700; }
a { color:#b8dcff; }
label { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-top:12px; }
select { max-width:170px; padding:4px; }
p { margin:10px 0 0; }
</style>
