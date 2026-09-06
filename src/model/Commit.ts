import { Octokit } from '@octokit/rest';
import Repo from './Repo';
import File, { RepoRootFile } from './File';
import { cacheMethod } from '@/util-cache';

export type CommitStatus = 'none'|'pending'|'success'|'failure'

export interface CheckStatusSummary {
    status: CommitStatus;
    total: number;
    passed: number;
    pending: number;
    failed: number;
}

export interface GithubCommit {
    sha: string;
    commit: {
        tree: {
            sha: string;
        };
    };
}

export default class Commit {
    constructor (public githubObj: GithubCommit,
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get sha() { return this.githubObj.sha; }
    get treeSha() { return this.githubObj.commit.tree.sha; }
    get root() { return new RepoRootFile(this, this.repo, this.octokit) }

    async getStatus(): Promise<CommitStatus> {
        return (await this.getCheckStatus()).status;
    }

    async getCheckStatus(): Promise<CheckStatusSummary> {
        const request = {
            ref: this.sha,
            repo: this.repo.name,
            owner: this.repo.ownerUsername,
        };
        const [statusResponse, checksResponse] = await Promise.all([
            this.octokit.rest.repos.getCombinedStatusForRef(request),
            this.octokit.rest.checks.listForRef(request),
        ]);

        const legacyStates = statusResponse.data.statuses.map(status => status.state);
        const checkStates: Array<'pending' | 'success' | 'failure'> = checksResponse.data.check_runs.map(check => {
            if (check.status !== 'completed') return 'pending';
            return check.conclusion === 'success' || check.conclusion === 'neutral' || check.conclusion === 'skipped'
                ? 'success'
                : 'failure';
        });
        const states = [...legacyStates, ...checkStates];
        const failed = states.filter(state => state === 'failure' || state === 'error').length;
        const pending = states.filter(state => state === 'pending').length;
        const passed = states.length - failed - pending;
        const status: CommitStatus = states.length === 0
            ? 'none'
            : failed > 0
                ? 'failure'
                : pending > 0
                    ? 'pending'
                    : 'success';
        return { status, total: states.length, passed, pending, failed };
    }
}
