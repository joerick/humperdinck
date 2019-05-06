import Octokit from '@octokit/rest';
import { Repo } from './Repo';
import { Base64 } from '@/util';

export interface GithubTreeEntry {
    path: string,
    mode: string,
    sha: string,
    url: string,
    type: string,
}
export interface GithubTreeEntryBlob extends GithubTreeEntry {
    type: 'blob',
    size: number,
}
export interface GithubTreeEntryTree extends GithubTreeEntry {
    type: 'tree',
}

export default class File {
    constructor (public githubObj: GithubTreeEntry, readonly repo: Repo, readonly octokit: Octokit) {
    }

    get isADirectory() { return this.githubObj.type == 'tree' }
    get sha() { return this.githubObj.sha }
    
    async contents() {
        if (this.isADirectory) { throw 'directories have no contents' }

        const response = await this.octokit.git.getBlob({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            file_sha: this.sha
        })

        return Base64.decode(response.data.content);
    }
    async files() {
        if (!this.isADirectory) { throw 'only directories have files in them' }

        const response = await this.octokit.git.getTree({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            tree_sha: this.sha,
        })

        return response.data.tree.map((gho: any) => new File(gho, this.repo, this.octokit));
    }
}
