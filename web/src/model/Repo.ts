import * as GithubApi from './GithubApiTypes';
import { Octokit } from '@octokit/rest';
import firebaseApp from "@/firebase";
import Branch from './Branch';
import { asyncGeneratorToList } from '@/util';
import { cacheMethod } from '@/util-cache';

interface RepoSettings {
    // changelogPath?: string,
    // changelogNewestFirst: boolean,
    filesContainingVersionNumbersToUpdate: string[],
}

function RepoSettingsDefault(): RepoSettings {
    return {filesContainingVersionNumbersToUpdate: []}
}

export default class Repo {
    repoSettings: RepoSettings|null = null;
    repoSettingsRef: firebase.firestore.DocumentReference;

    constructor (public githubObj: GithubApi.Repository, readonly octokit: Octokit) {
        this.repoSettingsRef = firebaseApp.firestore().collection("repos").doc(`${githubObj.id}`);
    }

    async init() {
        await new Promise((resolve, reject) => {
            this.repoSettingsRef.onSnapshot((doc) => {
                if (doc.exists) {
                    this.repoSettings = (doc.data()! as any);
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
        const branchResult = await this.octokit.repos.getBranch({
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
        const branchResponse = await this.octokit.repos.listBranches({
            owner: this.ownerUsername,
            repo: this.name,
        })

        return branchResponse.data.map(b => b.name);
    }

    async *tagsGenerator() {
        let page = 0;

        while (true) {
            const tagsRequest = await this.octokit.repos.listTags({
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

    async tags(): Promise<Octokit.ReposListTagsResponseItem[]> {
        return asyncGeneratorToList(this.tagsGenerator());
    }

    async *commitsGenerator({headSha}: {headSha: string}) {
        let page = 0;
        while (true) {
            const commitsRequest = await this.octokit.repos.listCommits({
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
