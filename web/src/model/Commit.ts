import Octokit from '@octokit/rest';
import { Repo } from './Repo';
import File from './File';

export default class Commit {
    constructor (public githubObj: Octokit.ReposGetBranchResponseCommit, 
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get sha() { return this.githubObj.sha; }
    get treeSha() { return this.githubObj.commit.tree.sha; }

    async files(root?: File): Promise<File[]> {
        const response = await this.octokit.git.getTree({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            tree_sha: this.treeSha,
            recursive: 1
        })
        return response.data.tree.map((gho: any) => new File(gho, this.repo, this.octokit));
    }   
}
