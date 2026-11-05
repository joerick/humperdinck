import { reactive } from 'vue';
import Branch from '../model/Branch';
import type User from '../model/User';
import type Repo from '../model/Repo';
import type Commit from '../model/Commit';
import type { ReleaseChanges, ReleasePlan } from '../model/Branch';
import { emptyReleaseConfig, renderReleaseConfig, type ReleaseConfig } from '../model/ReleaseConfig';

export const fixtureState = reactive({
  saveResult: 'success' as 'success' | 'failure',
  delayMs: 800,
  confirmation: 'native' as 'cancel' | 'allow' | 'native',
  lastAction: 'Fixture ready. Changes stay in memory until reload.',
});

async function write(action: string) {
  const result = fixtureState.saveResult;
  fixtureState.lastAction = `${action} in progress…`;
  await new Promise(resolve => setTimeout(resolve, fixtureState.delayMs));
  if (result === 'failure') {
    fixtureState.lastAction = `${action} failed (simulated).`;
    throw new Error('Simulated write failure. Your edits have been kept.');
  }
  fixtureState.lastAction = `${action} succeeded in memory.`;
}

class FixtureBranch extends Branch {
  _config: ReleaseConfig | null;
  _files: Record<string, string>;
  _release = { sha: '1234567abcdef', tag: 'v1.4.0', version: '1.4.0' };

  constructor(repo: Repo, name: string, configured: boolean) {
    // This fixture supplies every operation used by the UI; it has no API client.
    super({ name, commit: { sha: 'abcdef1234567', html_url: '#fixture-commit' } } as Branch['githubObj'], repo, undefined!);
    this._config = configured ? { ...emptyReleaseConfig(), versionFiles: [{ path: 'package.json', find: '"version": "#"' }] } : null;
    this._files = {
      'package.json': '{\n  "name": "demo-library",\n  "version": "1.4.0"\n}\n',
      'CHANGELOG.md': '# Changelog\n\n<!-- humperdinck: releases order=newest-first heading=2 -->\n\n## v1.4.0\n\n- Improve repository navigation.\n- Speed up release previews.\n',
    };
  }
  override get headCommit() {
    return { sha: this.githubObj.commit.sha, getCheckStatus: async () => ({ status: 'success', total: 3, passed: 3, failed: 0, pending: 0 }) } as Commit;
  }
  override async refresh() {}
  override async loadReleaseConfig() { return this._config ? JSON.parse(JSON.stringify(this._config)) as ReleaseConfig : null; }
  override async releaseConfigPath() { return this._config ? '.humperdinck.yml' : null; }
  override async fileContents(path: string) {
    if (path === '.humperdinck.yml' && this._config) return renderReleaseConfig(this._config);
    const contents = this._files[path];
    if (contents === undefined) throw new Error('file not found');
    return contents;
  }
  override async latestRelease() { return { ...this._release }; }
  override async changesSinceLatestRelease(): Promise<ReleaseChanges> {
    const commit = { sha: 'abcdef1234567', message: 'Keep repository and branch controls together on mobile', author: 'alex', url: '#fixture-commit' };
    const pullRequest = { number: 42, title: 'Add searchable branch navigation', body: 'Find branches quickly, including long feature names.', author: 'sam', url: '#fixture-pull-request', commits: [commit] };
    return { release: { ...this._release }, pullRequests: [pullRequest], standaloneCommits: [commit], timeline: [{ kind: 'pull-request', pullRequest }, { kind: 'commit', commit }] };
  }
  override async saveReleaseConfig(config: ReleaseConfig, files: Array<{ path: string; contents: string }> = []) {
    await write('Save settings');
    this._config = JSON.parse(JSON.stringify(config));
    for (const file of files) this._files[file.path] = file.contents;
  }
  override async createDraftCommit() {
    await write('Create draft');
    return { sha: 'fedcba7654321' } as Commit;
  }
  override draftDiffUrl() { return '#fixture-draft'; }
  override async publishRelease(plan: ReleasePlan) {
    await write('Publish release');
    for (const file of plan.files) this._files[file.path] = file.after;
    this._release = { sha: 'fedcba7654321', tag: plan.newTag, version: plan.newVersion };
    return { html_url: '#fixture-release' } as Awaited<ReturnType<Branch['publishRelease']>>;
  }
}

const branchNames = ['main', 'feature/unified-header-and-repository-navigation', 'fix/mobile', 'unconfigured'];
const repositories = ['humperdinck', 'a-repository-with-a-long-name-for-layout-checks', 'new-project'].map((name, index) => {
  const branches = new Map<string, FixtureBranch>();
  const repo = {
    id: 9000 + index, ownerUsername: 'example', name, defaultBranchName: 'main',
    async branchNames() { return [...branchNames]; },
    async branch(name: string) {
      if (!branchNames.includes(name)) throw new Error(`Fixture branch not found: ${name}`);
      if (!branches.has(name)) branches.set(name, new FixtureBranch(repo as unknown as Repo, name, index !== 2 && name !== 'unconfigured'));
      return branches.get(name)!;
    },
    async defaultBranch() { return this.branch('main'); },
    async hasDefaultBranchConfig() { return (await (await this.defaultBranch()).loadReleaseConfig()) !== null; },
    async tags() { return [{ name: 'v1.4.0', commit: { sha: '1234567abcdef' } }]; },
  };
  return repo as unknown as Repo;
});

const user = {
  uid: 'local-ui-fixture', githubUsername: 'alex-demo', profileURL: '', githubRepos: repositories,
  async getRepo(owner: string, name: string) {
    const repo = repositories.find(repo => repo.ownerUsername === owner && repo.name === name);
    if (!repo) throw new Error(`Fixture repository not found: ${owner}/${name}`);
    return repo;
  },
} as User;
let current: User | null = user;
const listeners: Array<(user: User | null) => void> = [];
const Auth = {
  async login() { current = user; listeners.forEach(listener => listener(current)); return user; },
  async logout() { current = null; listeners.forEach(listener => listener(null)); },
  async currentUser() { return current; },
  addAuthStateListener(listener: (user: User | null) => void) { listeners.push(listener); listener(current); },
};
export default Auth;
