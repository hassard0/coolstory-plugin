# Command Reference

## Desktop GUI

```bash
coolstory-plugin
coolstory-desktop gui
```

Launches the local desktop GUI. The packaged Windows and macOS builds open as native app windows; source installs can also run this browser-backed local shell. Authentication uses CoolStory's device-code flow: the client starts a connection request, the user approves it in the authenticated CoolStory web app, and the client stores the generated token locally.

## Auth

```bash
coolstory-desktop auth login --token <token> [--api-url https://coolstory.dev]
```

Stores CoolStory API URL and token in `~/.coolstory/plugin.json`.

## Status

```bash
coolstory-desktop status
```

Shows configured API URL, token presence, and backend health.

## Current User

```bash
coolstory-desktop whoami
```

Shows the CoolStory profile attached to the configured token.

## Repositories

```bash
coolstory-desktop repos list
coolstory-desktop repos refs <repo-slug>
coolstory-desktop repos archive <repo-slug> [output.tar] [--ref main]
```

## Artifacts

```bash
coolstory-desktop artifacts list <repo-slug>
coolstory-desktop artifacts get <repo-slug> <artifact-slug>
coolstory-desktop artifacts get <repo-slug> <artifact-slug> --json
```

`coolstory-desktop prds ...` remains available as a compatibility alias for existing PRD-only workflows.

## Checkpoints

```bash
coolstory-desktop checkpoints list <repo-slug>
coolstory-desktop checkpoint "Title" --repo <repo-slug> [--branch <branch>] [--summary "..."] [--file path ...]
```

If `--branch` is omitted, the plugin uses `COOLSTORY_BRANCH`, then falls back to `main`.

## Build Binaries

```bash
npm install
npm run build:desktop
```

Outputs:

- `dist-electron/coolstory-desktop-win-x64.exe`
- `dist-electron/coolstory-desktop-macos-arm64.zip`
- `dist-electron/coolstory-desktop-linux-x64.AppImage`

Windows and macOS packages are built by the `Release Binaries` GitHub Actions workflow on native runners using Electron. Source installs still require Node.js 20 or newer.
