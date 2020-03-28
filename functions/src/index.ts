import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as Octokit from '@octokit/rest';

admin.initializeApp();


// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const updateUserAccess = functions.https.onCall(async (data, context) => {
    const {uid} = data;

    if (!uid) {
        throw new Error('param "uid" must be provided');
    }

    const db = admin.firestore();

    const userDocument = await db.collection('users').doc(uid).get();
    const userDocumentData = userDocument.data();

    if (!userDocumentData) throw 'missing user data';

    const githubToken = userDocumentData['githubToken'];

    const octokit: Octokit = new Octokit({
        auth: `token ${githubToken}`,
        userAgent: 'joerick/humperdinck server',
    });

    const reposResponse = await octokit.repos.list({
        visibility: 'all',
        sort: 'pushed',
        per_page: 100,
    });

    const repos = reposResponse.data as Octokit.ReposListPublicResponse

    const userAccessRecord = db.collection('useraccess').doc(uid);

    userAccessRecord.set({
        repoIds: repos.map(r => r.id.toString()),
    })

    return null;
});
