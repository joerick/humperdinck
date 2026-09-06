import {
    GithubAuthProvider,
    getAdditionalUserInfo,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, authProvider, db } from '@/firebase';
import User from './User';
import { Mutex } from 'async-mutex';

type AuthStateListener = (user: User|null)=>void;
const authStateListeners: AuthStateListener[] = [];
const authStateMutex = new Mutex();

let AuthCurrentUser: undefined|null|User = undefined;

const Auth = {
    async login(): Promise<User> {
        const result = await signInWithPopup(auth, authProvider);
        const credential = GithubAuthProvider.credentialFromResult(result);
        const githubToken = credential?.accessToken;
        const githubUsername = getAdditionalUserInfo(result)?.username;
        const firebaseUser = result.user;

        if (!githubToken || !githubUsername) {
            throw new Error('GitHub did not return the required account details.');
        }
    
        await setDoc(doc(db, 'users', firebaseUser.uid), {
            githubUsername,
            profileURL: firebaseUser.photoURL,
            githubToken,
        }, {merge: true});

        const userModel = new User(firebaseUser.uid);
        await userModel.init()
        AuthCurrentUser = userModel;
        authStateListeners.forEach(listener => listener(userModel));
        return userModel
    },
    async logout(): Promise<void> {
        await signOut(auth);
    },
    async currentUser() {
        if (AuthCurrentUser === undefined) {
            return new Promise<User|null>(r => {
                this.addAuthStateListener(r);
            })
        } else {
            return AuthCurrentUser
        }
    },
    addAuthStateListener(listener: AuthStateListener) {
        authStateListeners.push(listener);

        if (AuthCurrentUser !== undefined) {
            listener(AuthCurrentUser);
        }
    },
    async _authStateChanged(firebaseUser: FirebaseUser|null): Promise<void> {
        await authStateMutex.runExclusive(async () => {
            if (firebaseUser) {
                let user: User|null = new User(firebaseUser.uid);

                try {
                    await user.init();
                } catch (error) {
                    console.error('failed to init user', error)
                    user = null
                }

                AuthCurrentUser = user;
                authStateListeners.forEach(listener => listener(user));
            } else {
                AuthCurrentUser = null;
                authStateListeners.forEach(listener => listener(null));
            }
        });
    }
}

export default Auth;

// hook it up to Firebase
onAuthStateChanged(auth, (user) => {
  Auth._authStateChanged(user).catch(console.error);
});
