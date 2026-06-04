# Command Reference

## Desktop GUI

```bash
coolstory-plugin
coolstory-plugin gui
```

Launches a local desktop-style GUI and opens it in the default browser. Authentication uses CoolStory's device-code flow: the client starts a connection request, the user approves it in the authenticated CoolStory web app, and the client stores the generated token locally.

## Auth

```bash
coolstory-plugin auth login --token <token> [--api-url https://coolstory.dev]
```

Stores CoolStory API URL and token in `~/.coolstory/plugin.json`.

## Status

```bash
coolstory-plugin status
```

Shows configured API URL, token presence, and backend health.

## Current User

```bash
coolstory-plugin whoami
```

Shows the CoolStory profile attached to the configured token.

## Repositories

```bash
coolstory-plugin repos list
coolstory-plugin repos refs <repo-slug>
coolstory-plugin repos archive <repo-slug> [output.tar] [--ref main]
```

## PRDs

```bash
coolstory-plugin prds list <repo-slug>
coolstory-plugin prds get <repo-slug> <prd-slug>
coolstory-plugin prds get <repo-slug> <prd-slug> --json
```

## Checkpoints

```bash
coolstory-plugin checkpoints list <repo-slug>
coolstory-plugin checkpoint "Title" --repo <repo-slug> [--branch <branch>] [--summary "..."] [--file path ...]
```

If `--branch` is omitted, the plugin uses `COOLSTORY_BRANCH`, then falls back to `main`.

## Build Binaries

```bash
npm install
npm run build:binary
```

Outputs:

- `dist/coolstory-desktop-win-x64.exe`
- `dist/coolstory-desktop-macos-arm64`
- `dist/coolstory-desktop-linux-x64`

Windows and macOS binaries are built by the `Release Binaries` GitHub Actions workflow on native runners using Node SEA. Source installs still require Node.js 20 or newer.
