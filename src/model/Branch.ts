import { Base64 } from '@/util';
import { cacheMethod } from '@/util-cache';
import Commit from './Commit';
import Repo from './Repo';
import Version from './Version';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';


interface VersionTag {
    sha: string,
    name: string,
}

export interface ReleaseFilePreview {
    path: string,
    currentVersionFound: boolean,
}

type GithubBranch = RestEndpointMethodTypes['repos']['getBranch']['response']['data'];

export default class Branch {
    constructor (public githubObj: GithubBranch,
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get headCommit() {
        return new Commit(this.githubObj.commit, this.repo, this.octokit);
    }

    get name() {
        return this.githubObj.name;
    }

    async refresh() {
        const response = await this.octokit.rest.repos.getBranch({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            branch: this.name,
        })
        this.githubObj = response.data
    }

    @cacheMethod({ttl: 60})
    async commitsSinceLatestTag() {
        const tags = await this.repo.tags();
        const tagShas = tags.map(t => t.commit.sha);
        const commits = [];

        for await (const commit of this.repo.commitsGenerator({headSha: this.headCommit.sha})) {
            if (tagShas.includes(commit.sha)) {
                break;
            }

            commits.push(commit);
        }
        
        return commits.map(c => new Commit(c, this.repo, this.octokit));
    }

    async currentVersion(): Promise<VersionTag> {
        // get all the tags
        let tags = await this.repo.tags();

        // build a map of commit sha to version name
        const versionTags = tags.filter(t => Version.parse(t.name));
        const commitShaToVersionMap: {[sha: string]: string} = {};
        versionTags.forEach(v => { commitShaToVersionMap[v.commit.sha] = v.name });

        if (versionTags.length == 0) {
            throw new Error('No version tags found in this repo');
        }
        
        const headSha = this.headCommit.sha;

        // find the latest commit that's tagged with a version number
        for await (const commit of this.repo.commitsGenerator({headSha})) {
            const versionName = commitShaToVersionMap[commit.sha];

            if (versionName) {
                return {
                    name: versionName,
                    sha: commit.sha,
                }
            }
        }

        throw new Error('Couldn\'t find a commit in this branch has a version');
    }

    async previewRelease(newVersion: string): Promise<ReleaseFilePreview[]> {
        const currentVersion = await this.currentVersion();
        const filePaths = this.repo.repoSettings?.filesContainingVersionNumbersToUpdate ?? [];

        return Promise.all(filePaths.map(async path => {
            const file = await this.headCommit.root.getFile(path);
            const contents = await file.contents();
            return {
                path,
                currentVersionFound: contents.includes(currentVersion.name),
            };
        }));
    }

    async draftReleaseCommit(newVersion: string): Promise<Commit> {
        const currentVersion = await this.currentVersion();
        const filePaths = this.repo.repoSettings?.filesContainingVersionNumbersToUpdate ?? [];
        const files = await Promise.all(filePaths.map(path => this.headCommit.root.getFile(path)));

        const newFiles = await Promise.all(files.map(async f => {
            const oldContents = await f.contents();
            const newContents = oldContents.replace(currentVersion.name, newVersion);

            const newBlobResponse = await this.octokit.rest.git.createBlob({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                content: Base64.encode(newContents),
                encoding: 'base64',
            });

            return {
                path: f.path,
                mode: f.githubObj.mode as any,
                type: 'blob' as any,
                sha: newBlobResponse.data.sha,
            }
        }));

        let commitTreeSha = this.headCommit.treeSha;

        if (newFiles.length > 0) {
            const newTreeResponse = await this.octokit.rest.git.createTree({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                base_tree: this.headCommit.treeSha,
                tree: newFiles,
            });
            commitTreeSha = newTreeResponse.data.sha;
        }

        const newCommitResponse = await this.octokit.rest.git.createCommit({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            message: `${newVersion}`,
            tree: commitTreeSha,
            parents: [this.headCommit.sha],
        });

        return new Commit(newCommitResponse.data as any, this.repo, this.octokit);
    }

    async release(newVersion: string, changelog: string, commit: Commit) {
        // update this branch to point at the commit, tag with newVersion,
        // and release with Github releases
        const releaseResponse = await this.octokit.rest.repos.createRelease({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            tag_name: newVersion,
            target_commitish: commit.sha,
            name: newVersion,
            body: changelog,
        })
        const release = releaseResponse.data;

        try {
            await this.octokit.rest.git.updateRef({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                ref: `heads/${this.name}`,
                sha: commit.sha,
            })
            await this.refresh();
        }
        catch(error) {
            await this.octokit.rest.repos.deleteRelease({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                release_id: release.id,
            })
            throw error;
        }

        return release
    }
}
