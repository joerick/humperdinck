import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import Branch, { type ReleasePlan } from '@/model/Branch';
import Commit from '@/model/Commit';
import type Repo from '@/model/Repo';

const baseSha = 'base';
const releaseSha = 'release';

function createSubject(headsAfterRefresh: string[]) {
  const getBranch = vi.fn().mockImplementation(async () => ({
    data: branchObject(headsAfterRefresh.shift() ?? baseSha),
  }));
  const updateRef = vi.fn().mockResolvedValue({ data: {} });
  const createRelease = vi.fn().mockRejectedValue(new Error('GitHub release failed'));
  const octokit = {
    rest: {
      repos: { getBranch, createRelease },
      git: { updateRef },
    },
  } as unknown as Octokit;
  const repo = { ownerUsername: 'owner', name: 'repo' } as Repo;
  const branch = new Branch(branchObject(baseSha) as never, repo, octokit);
  const commit = new Commit({ sha: releaseSha, commit: { tree: { sha: 'tree' } } }, repo, octokit);
  const plan = { baseSha, newTag: 'v2.0.0', notes: 'Notes' } as ReleasePlan;
  return { branch, commit, plan, updateRef };
}

function branchObject(sha: string) {
  return {
    name: 'main',
    commit: { sha, commit: { tree: { sha: `tree-${sha}` } } },
  };
}

describe('Branch.publishRelease', () => {
  it('does not force the branch backward when release creation fails', async () => {
    const { branch, commit, plan, updateRef } = createSubject([baseSha, releaseSha]);

    await expect(branch.publishRelease(plan, commit)).rejects.toThrow('left the branch untouched');
    expect(updateRef).toHaveBeenCalledTimes(1);
    expect(updateRef).toHaveBeenCalledWith(expect.objectContaining({ sha: releaseSha }));
  });

  it('does not overwrite a branch that moved while the release was being created', async () => {
    const { branch, commit, plan, updateRef } = createSubject([baseSha, 'concurrent-commit']);

    await expect(branch.publishRelease(plan, commit)).rejects.toThrow('left the branch untouched');
    expect(updateRef).toHaveBeenCalledTimes(1);
    expect(updateRef).toHaveBeenCalledWith(expect.objectContaining({ sha: releaseSha }));
  });
});
