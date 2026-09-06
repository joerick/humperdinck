import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {Octokit} from '@octokit/rest';

admin.initializeApp();


export const updateUserRepos = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid

    if (!uid) {
        throw new Error('user must be logged in');
    }

    const db = admin.firestore();

    const userDocumentRef = db.collection('users').doc(uid);
    const userDocument = await userDocumentRef.get();
    const userDocumentData = userDocument.data();

    if (!userDocumentData) throw 'missing user data';

    const repos = await getAllUserRepos(userDocumentData['githubToken'])

    const userAccessRecord = db.collection('useraccess').doc(uid);

    await Promise.all([
        userAccessRecord.set({
            repoIds: repos.map(r => r.id.toString()),
        }),
        userDocumentRef.update({githubRepos: repos})
    ])

    return null;
});

async function getAllUserRepos(githubToken: string) {
    const octokit: Octokit = new Octokit({
        auth: `token ${githubToken}`,
        userAgent: 'joerick/humperdinck server',
    });

    const repos: Octokit.ReposListPublicResponseItem[] = []
    let page = 1

    while (true) {
        const reposResponse = await octokit.repos.list({
            visibility: 'all',
            sort: 'pushed',
            per_page: 100,
            page,
        });

        const pageRepos = reposResponse.data as Octokit.ReposListPublicResponseItem[]

        repos.push(...pageRepos)

        if (pageRepos.length < 100) {
            break;
        }

        // there are more to fetch!
        page += 1
    }
    return repos;
}
