import * as GithubApi from './GithubApiTypes';
import Octokit from '@octokit/rest';
import firebaseApp from "@/firebase";
import Branch from './Branch';

interface RepoSettings {
    // changelogPath?: string,
    // changelogNewestFirst: boolean,
    filesContainingVersionNumbersToUpdate: string[],
}

export class Repo {
    repoSettings!: RepoSettings;
    repoSettingsRef: firebase.firestore.DocumentReference;

    constructor (public githubObj: GithubApi.Repository, readonly octokit: Octokit) {
        this.repoSettingsRef = firebaseApp.firestore().collection("repos").doc(`${githubObj.id}`);
    }

    async init() {
        await new Promise((resolve, reject) => {
            this.repoSettingsRef.onSnapshot((doc) => {
                if (!doc.exists) {
                    this.repoSettings = {filesContainingVersionNumbersToUpdate: []};
                } else {
                    this.repoSettings = (doc.data()! as any);
                }

                // continue init after the first value
                // (only the first call to resolve() does anything.)
                resolve();
            }, reject);
        })
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
}