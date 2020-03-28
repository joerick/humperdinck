import { Octokit } from '@octokit/rest';
import Repo from './Repo';
import File, { RepoRootFile } from './File';
import { cacheMethod } from '@/util-cache';

export type CommitStatus = 'none'|'pending'|'success'|'failure'

export default class Commit {
    constructor (public githubObj: Octokit.ReposGetBranchResponseCommit, 
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get sha() { return this.githubObj.sha; }
    get treeSha() { return this.githubObj.commit.tree.sha; }
    get root() { return new RepoRootFile(this, this.repo, this.octokit) }

    async getStatus(): Promise<CommitStatus> {
        const response = await this.octokit.repos.getCombinedStatusForRef({
            ref: this.sha,
            repo: this.repo.name,
            owner: this.repo.ownerUsername,
        })
        
        if (response.data.statuses.length == 0) {
            return 'none';
        }

        const status = response.data.state;

        if (status == 'failure' || status == 'success' || status == 'pending') {
            return status;
        } else {
            throw new Error('Unknown commit status: '+status);
        }
    }
}
