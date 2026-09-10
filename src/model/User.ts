import {
    doc,
    type DocumentReference,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/firebase';
import {Octokit, type RestEndpointMethodTypes} from '@octokit/rest';
import Repo from './Repo';
import { FirestoreDocumentObserver } from '@/util';

type GithubRepository = RestEndpointMethodTypes['repos']['get']['response']['data'];

interface UserDocument {
    githubUsername: string,
    profileURL: string,
    githubToken: string,
    githubRepos?: GithubRepository[]
}

export default class User {
    octokit!: Octokit;
    userDocumentData!: UserDocument;
    userDocumentRef: DocumentReference<UserDocument>;

    constructor (readonly uid: string) {
        this.userDocumentRef = doc(db, 'users', this.uid) as DocumentReference<UserDocument>;
    }

    /**
     * Callers must call this method and wait for completion before calling
     * any other method on this object.
     */
    async init() {
        const documentObserver = new FirestoreDocumentObserver(this.userDocumentRef, userDocumentData => {
            this.userDocumentData = userDocumentData!;
        })

        await documentObserver.nextValue()

        if (!this.userDocumentData) {
            throw new Error("user doesn't exist in Firestore")
        }

        if (this.userDocumentData.githubRepos === undefined) {
            await Promise.all([
                httpsCallable<void, null>(functions, 'updateUserRepos')(),
                documentObserver.nextValue(),
            ])
        }

        this.octokit = new Octokit({
            auth: `token ${this.githubToken}`,
            userAgent: 'joerick/humperdinck',
        })
    }

    get githubToken() { return this.userDocumentData.githubToken }
    get githubUsername() { return this.userDocumentData.githubUsername }
    get profileURL() { return this.userDocumentData.profileURL }

    get githubRepos(): Repo[] {
        return this.userDocumentData.githubRepos!.map(githubObj => new Repo(githubObj, this.octokit));
    }

    async getRepo(owner: string, name: string): Promise<Repo> {
        const response = await this.octokit.rest.repos.get({
            owner: owner,
            repo: name,
        })
        return new Repo(response.data, this.octokit);
    }
}
