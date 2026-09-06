import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const app = initializeApp({
  "apiKey": "AIzaSyDh8ipYyhj9vZKANRU6uVDkFeIyFeUjl4s",
  "databaseURL": "https://humperdinck-a7b3e.firebaseio.com",
  "storageBucket": "humperdinck-a7b3e.appspot.com",
  "authDomain": "humperdinck-a7b3e.firebaseapp.com",
  "messagingSenderId": "846696014888",
  "projectId": "humperdinck-a7b3e",
});
export default app;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const authProvider = new GithubAuthProvider();
authProvider.addScope('repo');
authProvider.setCustomParameters({
  'allow_signup': 'false'
});
