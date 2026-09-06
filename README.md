# Humperdinck

Vue 3 and Firebase application for inspecting repository release state.

## Requirements

- Node.js 22
- npm
- Firebase CLI for emulator and deployment workflows

## Setup

```sh
npm install
npm --prefix functions install
```

## Development

```sh
npm run dev
```

The frontend currently uses Firebase project `humperdinck-a7b3e`. Authentication,
Firestore, and callable Functions therefore use that project unless emulator or
environment configuration is added.

## Verify

```sh
npm run build
npm run test
npm run lint
npm --prefix functions run build
```

## Deploy

Reauthenticate the Firebase CLI first if necessary:

```sh
firebase login --reauth
firebase deploy
```
