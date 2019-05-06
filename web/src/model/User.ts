import * as firebase from 'firebase/app';
import Octokit from '@octokit/rest';
import Repo from './Repo';

interface UserDocument {
    githubUsername: string,
    profileURL: string,
    githubToken: string,
}

export default class User {
    octokit!: Octokit;
    userDocumentData!: UserDocument;
    userDocumentRef: firebase.firestore.DocumentReference;

    constructor (readonly uid: string) {
        this.userDocumentRef = firebase.firestore().collection("users").doc(this.uid);
    }

    /**
     * Callers must call this method and wait for completion before calling
     * any other method on this object.
     */
    async init() {
        await new Promise((resolve, reject) => {
            this.userDocumentRef.onSnapshot((doc) => {
                if (!doc.exists) { reject('user doesn\'t exist in firestore') };

                this.userDocumentData = (doc.data()! as any);
                // continue init after the first value
                // (only the first call to resolve() does anything.)
                resolve();
            });
        })
        this.octokit = new Octokit({
            auth: `token ${this.githubToken}`,
            userAgent: 'joerick/humperdinck',
        })
    }

    get githubToken() { return this.userDocumentData.githubToken }
    get githubUsername() { return this.userDocumentData.githubUsername }

    _cachedGithubRepos: Repo[]|null = null
    async githubRepos(): Promise<Repo[]> {
        if (this._cachedGithubRepos === null) {
            const result = await this.octokit.repos.list({per_page: 100});
            this._cachedGithubRepos = result.data.map((obj: any) => new Repo(obj, this.octokit));
            // run the `init`s in parallel
            await Promise.all(this._cachedGithubRepos!.map(r => r.init()));
        }
        return this._cachedGithubRepos!;
    }
}