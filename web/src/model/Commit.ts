import Octokit from '@octokit/rest';
import Repo from './Repo';
import File, { RepoRootFile } from './File';
import { cacheMethod } from '@/util-cache';


export default class Commit {
    constructor (public githubObj: Octokit.ReposGetBranchResponseCommit, 
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get sha() { return this.githubObj.sha; }
    get treeSha() { return this.githubObj.commit.tree.sha; }
    get root() { return new RepoRootFile(this, this.repo, this.octokit) }
}
