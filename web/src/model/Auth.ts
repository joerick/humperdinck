import firebaseApp, { authProvider } from "@/firebase";
import User from './User';
import { Mutex } from 'async-mutex';

const auth = firebaseApp.auth();

type AuthStateListener = (user: User|null)=>void;
const authStateListeners: AuthStateListener[] = [];
const authStateMutex = new Mutex();

let AuthCurrentUser: undefined|null|User = undefined;

const Auth = {
    async login(): Promise<User> {
        const result = await auth.signInWithPopup(authProvider);
        var githubToken = (result.credential as any).accessToken;
        const githubUsername = result.additionalUserInfo!.username!;
        var user = result.user!;
        console.log({result, githubToken, user});
    
        const db = firebaseApp.firestore();
        await db.collection("users").doc(user.uid).set({
            githubUsername,
            profileURL: user.photoURL,
            githubToken,
        });

        const userModel = new User(user.uid);
        await userModel.init()
        return userModel
    },
    async logout(): Promise<void> {
        await auth.signOut();
    },
    async currentUser() {
        if (AuthCurrentUser === undefined) {
            return new Promise<User|null>(r => {
                this.addAuthStateListener(r);
            })
        }
    },
    addAuthStateListener(listener: AuthStateListener) {
        authStateListeners.push(listener);

        if (AuthCurrentUser !== undefined) {
            listener(AuthCurrentUser);
        }
    },
    async _authStateChanged(firebaseUser: firebase.User|null): Promise<void> {
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
auth.onAuthStateChanged((user) => {
  Auth._authStateChanged(user).catch;
});
