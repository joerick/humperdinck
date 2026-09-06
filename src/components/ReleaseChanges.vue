<script setup lang="ts">
import type { ReleaseChanges } from '@/model/Branch';

defineProps<{
  changes: ReleaseChanges;
}>();

function bodyPreview(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No pull request description.';
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized;
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
</script>

<template>
  <section class="changes-card">
    <header>
      <div>
        <p class="eyebrow">Since {{ changes.release.tag }}</p>
        <h3>Changes ready to release</h3>
      </div>
      <span class="count">
        {{ changes.pullRequests.length }} PR{{ changes.pullRequests.length === 1 ? '' : 's' }} ·
        {{ changes.standaloneCommits.length }} direct commit{{ changes.standaloneCommits.length === 1 ? '' : 's' }}
      </span>
    </header>

    <div v-if="changes.pullRequests.length === 0 && changes.standaloneCommits.length === 0" class="empty">
      This branch has no changes since {{ changes.release.tag }}.
    </div>

    <div v-if="changes.timeline.length" class="timeline">
      <article
        v-for="item in changes.timeline"
        :key="item.kind === 'pull-request' ? `pr-${item.pullRequest.number}` : item.commit.sha"
        class="timeline-item"
        :class="item.kind"
      >
        <div class="icon" aria-hidden="true">
          <svg v-if="item.kind === 'pull-request'" viewBox="0 0 16 16">
            <path d="M5 3.25a2.25 2.25 0 1 1-3.5 1.866v5.768a2.25 2.25 0 1 1 1.5 0V5.116A2.25 2.25 0 0 1 5 3.25Zm7.5 7.634V6.5A2.5 2.5 0 0 0 10 4H8.56l1.22-1.22a.75.75 0 1 0-1.06-1.06l-2.5 2.5a.75.75 0 0 0 0 1.06l2.5 2.5a.75.75 0 1 0 1.06-1.06L8.56 5.5H10a1 1 0 0 1 1 1v4.384a2.25 2.25 0 1 0 1.5 0Z" />
          </svg>
          <svg v-else viewBox="0 0 16 16">
            <path d="M5.25 8a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1-5.5 0ZM8 6.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM0 7.25h5.35v1.5H0Zm10.65 0H16v1.5h-5.35Z" />
          </svg>
        </div>

        <div v-if="item.kind === 'pull-request'" class="item-content pr-content">
          <div class="change-heading">
            <a :href="item.pullRequest.url" target="_blank" rel="noreferrer">
              #{{ item.pullRequest.number }} {{ item.pullRequest.title }}
            </a>
            <span v-if="item.pullRequest.author">@{{ item.pullRequest.author }}</span>
          </div>
          <p>{{ bodyPreview(item.pullRequest.body) }}</p>
          <details>
            <summary>{{ item.pullRequest.commits.length }} associated commit{{ item.pullRequest.commits.length === 1 ? '' : 's' }}</summary>
            <ul>
              <li v-for="commit in item.pullRequest.commits" :key="commit.sha">
                <a :href="commit.url" target="_blank" rel="noreferrer"><code>{{ shortSha(commit.sha) }}</code></a>
                {{ commit.message }}
              </li>
            </ul>
          </details>
        </div>

        <div v-else class="item-content commit-content">
          <a :href="item.commit.url" target="_blank" rel="noreferrer"><code>{{ shortSha(item.commit.sha) }}</code></a>
          <span>{{ item.commit.message }}</span>
          <small v-if="item.commit.author">{{ item.commit.author }}</small>
        </div>
      </article>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.changes-card { max-width: 850px; margin: 30px auto; text-align: left; border: 1px solid #d7dce2; border-radius: 16px; background: #fff; box-shadow: 0 12px 32px rgb(24 39 75 / 8%); overflow: hidden; }
header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 28px; border-bottom: 1px solid #e5e9ed; }
header h3 { margin: 4px 0 0; }
.eyebrow { margin: 0; color: #657081; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.count { padding: 7px 11px; color: #365f82; border-radius: 999px; background: #e9f0f6; font-size: .85rem; font-weight: 700; white-space: nowrap; }
.timeline { padding: 12px 28px 22px; }
.timeline-item { position: relative; display: grid; grid-template-columns: 34px 1fr; gap: 13px; padding-top: 14px; }
.timeline-item::before { position: absolute; top: 0; bottom: -14px; left: 16px; width: 2px; background: #e1e6eb; content: ''; }
.timeline-item:last-child::before { bottom: calc(100% - 31px); }
.icon { z-index: 1; display: grid; width: 34px; height: 34px; place-items: center; color: #596675; border: 1px solid #cdd5dd; border-radius: 50%; background: #fff; }
.icon svg { width: 17px; height: 17px; fill: currentColor; }
.pull-request .icon { color: #fff; border-color: #8250df; background: #8250df; }
.item-content { min-width: 0; border: 1px solid #dfe4e9; border-radius: 10px; background: #fff; }
.pr-content { padding: 16px; border-left: 4px solid #8250df; }
.commit-content { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: baseline; padding: 12px 14px; }
.change-heading { display: flex; justify-content: space-between; gap: 15px; }
.change-heading a { color: #6639ba; font-weight: 750; text-decoration: none; }
.change-heading span, .change p, small { color: #66717e; }
.pr-content p { margin: 8px 0; color: #66717e; }
details summary { cursor: pointer; color: #536577; }
details ul { margin-bottom: 0; }
.empty { padding: 28px; color: #66717e; }
@media (max-width: 700px) { header, .change-heading { align-items: flex-start; flex-direction: column; } .commit-content { grid-template-columns: auto 1fr; } .commit-content small { grid-column: 2; } }
</style>
