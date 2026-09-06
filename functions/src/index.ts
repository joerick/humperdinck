import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {Octokit} from '@octokit/rest';

initializeApp();

export const updateUserRepos = onCall(async (request) => {
    const uid = request.auth?.uid

    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = getFirestore();

    const userDocumentRef = db.collection('users').doc(uid);
    const userDocument = await userDocumentRef.get();
    const userDocumentData = userDocument.data();

    if (!userDocumentData) {
        throw new HttpsError('failed-precondition', 'Missing user data.');
    }

    const githubToken = userDocumentData.githubToken;
    if (typeof githubToken !== 'string' || !githubToken) {
        throw new HttpsError('failed-precondition', 'Missing GitHub credentials.');
    }

    const repos = await getAllUserRepos(githubToken)

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

    return octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        visibility: 'all',
        sort: 'pushed',
        per_page: 100,
    });
}
