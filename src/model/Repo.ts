import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { doc, onSnapshot, type DocumentReference } from 'firebase/firestore';
import { db } from '@/firebase';
import Branch from './Branch';
import { asyncGeneratorToList } from '@/util';
import { cacheMethod } from '@/util-cache';

interface RepoSettings {
    // changelogPath?: string,
    // changelogNewestFirst: boolean,
    filesContainingVersionNumbersToUpdate: string[],
}

type GithubRepository = RestEndpointMethodTypes['repos']['get']['response']['data'];

export default class Repo {
    repoSettings: RepoSettings|null = null;
    repoSettingsRef: DocumentReference;

    constructor (public githubObj: GithubRepository, readonly octokit: Octokit) {
        this.repoSettingsRef = doc(db, 'repos', String(githubObj.id));
    }

    async init() {
        await new Promise<void>((resolve, reject) => {
            onSnapshot(this.repoSettingsRef, (snapshot) => {
                if (snapshot.exists()) {
                    this.repoSettings = snapshot.data() as RepoSettings;
                } else {
                    this.repoSettings = null;
                }

                // continue init after the first value
                // (only the first call to resolve() does anything.)
                console.log('got repo obj', this.repoSettingsRef.path)
                resolve();
            }, (error) => {
                console.error('failed to get repo object from firestore', this.repoSettingsRef.path, this.githubObj.id);
                reject(error);
            });
        })
    }

    get isEnabled() {
        return this.repoSettings !== null;
    }

    get ownerUsername() { return this.githubObj.owner.login }
    get name() { return this.githubObj.name }

    get defaultBranchName() { return this.githubObj.default_branch }
    async branch(branchName: string) {
        const branchResult = await this.octokit.rest.repos.getBranch({
            owner: this.ownerUsername,
            repo: this.name,
            branch: branchName
        })
        return new Branch(branchResult.data, this, this.octokit);
    }
    async defaultBranch() {
        return await this.branch(this.defaultBranchName);
    }
    @cacheMethod({ttl: 180})
    async branchNames() {
        const branchResponse = await this.octokit.rest.repos.listBranches({
            owner: this.ownerUsername,
            repo: this.name,
        })

        return branchResponse.data.map(b => b.name);
    }

    async *tagsGenerator() {
        let page = 1;

        while (true) {
            const tagsRequest = await this.octokit.rest.repos.listTags({
                owner: this.ownerUsername,
                repo: this.name,
                per_page: 100,
                page,
            })

            for (const tag of tagsRequest.data) {
                yield tag;
            }

            if (tagsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }
    }

    async tags() {
        return asyncGeneratorToList(this.tagsGenerator());
    }

    async *commitsGenerator({headSha}: {headSha: string}) {
        let page = 1;
        while (true) {
            const commitsRequest = await this.octokit.rest.repos.listCommits({
                owner: this.ownerUsername,
                repo: this.name,
                sha: headSha,
                per_page: 100,
                page,
            });

            for (const commit of commitsRequest.data) {
                yield commit;
            }

            if (commitsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }
    }
}
