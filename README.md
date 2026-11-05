# Humperdinck

Vue 3 and Firebase application for inspecting repository release state.

## Repository configuration

Release settings are branch-specific and live in `.humperdinck.yml` (or the
also-supported `.humperdinck.yaml`) on the
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

### Local UI fixture

Run `npm run dev:fixture` and open
<http://localhost:5174/example/humperdinck/branches/main> to browse the real
screens with a sample signed-in account, repositories, branches, release changes,
and settings. No GitHub account is needed. `new-project` and the `unconfigured`
branch show the setup state; long repository and branch names exercise truncation.

The **Local UI fixture** panel controls successful/failed writes, write delay,
and discard confirmation. The native dialog is the default; automatic allow/cancel
options are available for browser automation. To inspect saving and error states,
edit Settings, choose a write outcome and delay, then commit the settings.
Settings, drafts, and releases use in-memory fixture data; reload resets it.
Refresh/close warnings still use the browser's native unsaved-settings warning.

Fixture mode uses a separate port and a fixture account ID for browser caches.
Its auth replacement is enabled only by the Vite dev server in `fixture` mode;
production builds use normal authentication and exclude the fixture controls.

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
