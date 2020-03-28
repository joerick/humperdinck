import * as firebase from 'firebase/app';
import 'firebase/functions';
import {Octokit} from '@octokit/rest';
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
        const firstDocumentUpdate = new Promise((resolve, reject) => {
            this.userDocumentRef.onSnapshot((doc) => {
                if (!doc.exists) { reject('user doesn\'t exist in firestore') };

                this.userDocumentData = (doc.data()! as any);
                // continue init after the first value
                // (only the first call to resolve() does anything.)
                resolve();
            });
        })
        const updateUserAccessFunction = firebase.functions().httpsCallable('updateUserAccess')
        const userAccessUpdate = updateUserAccessFunction({uid: this.uid});

        await Promise.all([firstDocumentUpdate, userAccessUpdate]);

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
            const successfulRepos: Repo[] = []
            await Promise.all(this._cachedGithubRepos!.map(async repo => {
                try {
                    await repo.init()
                    successfulRepos.push(repo);
                } catch (error) {
                    console.warn('failed to init project', repo, error)
                }
            }));
            this._cachedGithubRepos = successfulRepos;
        }
        return this._cachedGithubRepos!;
    }

    async getRepo(owner: string, name: string) {
        const repos = await this.githubRepos();
        const repo = repos.find(r => (
            r.ownerUsername === owner && r.name === name
        ))
        if (!repo) {
            throw new Error('Repo not found.');
        }
        return repo;
    }
}
