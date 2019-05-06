import Octokit from '@octokit/rest';
import Repo from './Repo';
import { Base64 } from '@/util';
import { cacheMethod } from '@/util-cache';
import { Commit } from '.';

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
    get path() { return this.githubObj.path }
    get name() { 
        const pathComponents = this.path.split('/');
        // the last path component is the filename
        return pathComponents[pathComponents.length - 1];
    }
    
    @cacheMethod({ttl: 60})
    async contents() {
        if (this.isADirectory) { throw new Error('directories have no contents') }

        const response = await this.octokit.git.getBlob({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            file_sha: this.sha
        })

        return Base64.decode(response.data.content);
    }

    @cacheMethod({ttl: 60})
    async files(): Promise<File[]> {
        if (!this.isADirectory) { throw new Error('only directories have files in them') }

        const response = await this.octokit.git.getTree({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            tree_sha: this.sha,
        })

        return response.data.tree.map((gho: any) => new File(gho, this.repo, this.octokit));
    }

    async getFile(path: string): Promise<File> {
        const files = await this.files()

        const pathComponents = path.split('/')
        // get the first path in that sequence, and leave the rest in 
        // pathComponents
        const childFilename = pathComponents.shift();
        const file = files.find(f => f.name === childFilename);

        if (!file) {
            throw new Error('file not found');
        }

        if (pathComponents.length == 0) {
            // the recursion is done, we found it.
            return file;
        } else {
            // recurse into this directory
            return file.getFile(pathComponents.join('/'));
        }
    }
}

export class RepoRootFile extends File {
    constructor (readonly commit: Commit, repo: Repo, octokit: Octokit) {
        super({} as any, repo, octokit);
    }

    get isADirectory() { return true }
    get sha() { return this.commit.treeSha }
    get path() { return '' }
}