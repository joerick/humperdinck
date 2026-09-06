# Humperdinck

Vue 3 and Firebase application for inspecting repository release state.

## Repository configuration

Release settings are branch-specific and live in `.humperdinck.yaml` on the
branch being released. They can be created from the repository Settings screen.

```yaml
version: 1
tagPattern: v(?<version>\d.*)
versionFiles:
  - path: package.json
    find: '"version": "#"'
  - path: docs/install.md
    find: 'humperdinck@#'
changelog:
  path: CHANGELOG.md
```

The optional `find` text uses `#` as the version placeholder. Without it,
Humperdinck replaces the first occurrence of the current version in the file.

The configured Markdown changelog must contain an insertion marker:

```markdown
<!-- humperdinck: releases order=newest-first heading=2 -->
```

`order` can be `newest-first` or `newest-last`, and `heading` can be from 1 to
6. Humperdinck leaves the marker in place and inserts each new version entry on
the corresponding side of it.

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
