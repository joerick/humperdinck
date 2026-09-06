import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';

const app = firebase.initializeApp({
  "apiKey": "AIzaSyDh8ipYyhj9vZKANRU6uVDkFeIyFeUjl4s",
  "databaseURL": "https://humperdinck-a7b3e.firebaseio.com",
  "storageBucket": "humperdinck-a7b3e.appspot.com",
  "authDomain": "humperdinck-a7b3e.firebaseapp.com",
  "messagingSenderId": "846696014888",
  "projectId": "humperdinck-a7b3e",
});
export default app;

export const db = app.firestore();
export const auth = app.auth();
export const authProvider = new firebase.auth.GithubAuthProvider();
authProvider.addScope('repo');
authProvider.setCustomParameters({
  'allow_signup': 'false'
});
