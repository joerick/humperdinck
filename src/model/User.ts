import * as firebase from 'firebase/app';
import 'firebase/functions';
import firebaseApp from '@/firebase';
import {Octokit} from '@octokit/rest';
import Repo from './Repo';
import * as GithubApi from './GithubApiTypes';
import { FirestoreDocumentObserver } from '@/util';

interface UserDocument {
    githubUsername: string,
    profileURL: string,
    githubToken: string,
    githubRepos?: Octokit.ReposListPublicResponseItem[]
}

export default class User {
    octokit!: Octokit;
    userDocumentData!: UserDocument;
    userDocumentRef: firebase.firestore.DocumentReference<UserDocument>;
    reposCollectionRef: firebase.firestore.CollectionReference<UserRepo>;

    repoSummaries!: UserRepo[]

    constructor (readonly uid: string) {
        this.userDocumentRef = firebaseApp.firestore().collection("users").doc(this.uid) as any;
        this.reposCollectionRef = this.userDocumentRef.collection('repos') as any;
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
                firebaseApp.functions().httpsCallable('updateUserRepos')(),
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

    get githubRepos(): UserRepo[] {
        return this.userDocumentData.githubRepos!.map(githubObj => ({
            ownerUsername: githubObj.owner.login,
            name: githubObj.name,
        }))
    }

    async getRepo(owner: string, name: string): Repo {
        const response = await this.octokit.repos.get({
            owner: owner,
            repo: name,
        })
        return new Repo(response.data, this.octokit);
    }
}

export interface UserRepo {
    ownerUsername: string,
    name: string,
}
