import firebaseApp, { authProvider } from "@/firebase";
import User from './User';
import { Mutex } from 'async-mutex';

const auth = firebaseApp.auth();

type AuthStateListener = (user: User|null)=>void;
const authStateListeners: AuthStateListener[] = [];
const authStateMutex = new Mutex();

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

        return new User(user.uid);
    },
    async logout(): Promise<void> {
        await auth.signOut();
    },
    addAuthStateListener(listener: AuthStateListener) {
        authStateListeners.push(listener);
    },
    async _authStateChanged(firebaseUser: firebase.User|null): Promise<void> {
        await authStateMutex.runExclusive(async () => {
            if (firebaseUser) {
                const user = new User(firebaseUser.uid);
                await user.init();
                authStateListeners.forEach(listener => listener(user));
            } else {
                authStateListeners.forEach(listener => listener(null));
            }
        });
    }
}

export default Auth;

auth.onAuthStateChanged((user) => {
  Auth._authStateChanged(user).catch;
});
