# Command Reference

## Headless CLI For BMAD

```bash
coolstory --help
coolstory quickstart
```

`coolstory` is the canonical command for BMAD agents, automation, and terminal workflows.

## Desktop GUI

```bash
coolstory-desktop
coolstory-desktop gui
```

Launches the local desktop GUI. The packaged Windows and macOS builds open as native app windows; source installs can also run this browser-backed local shell. Authentication uses CoolStory's device-code flow: the client starts a connection request, the user approves it in the authenticated CoolStory web app, and the client stores the generated token locally.

## Auth

```bash
coolstory auth login --token <token> [--api-url https://coolstory.dev]
```

Stores CoolStory API URL and token in `~/.coolstory/plugin.json`.

## Status

```bash
coolstory status
```

Shows configured API URL, token presence, and backend health.

## Current User

```bash
coolstory whoami
```

Shows the CoolStory profile attached to the configured token.

## Repositories

```bash
coolstory repos list
coolstory repos refs <repo-slug>
coolstory repos archive <repo-slug> [output.tar] [--ref main]
```

## Artifacts

```bash
coolstory artifacts list <repo-slug>
coolstory artifacts get <repo-slug> <artifact-slug>
coolstory artifacts get <repo-slug> <artifact-slug> --json
coolstory artifacts push <repo-slug> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
```

`coolstory prds ...` remains available as a compatibility alias for existing PRD-only workflows.

`artifacts push` creates or updates the CoolStory artifact matching the inferred or supplied slug. Use it when BMAD creates a local Markdown artifact that should appear in the web artifact library.

## Checkpoints

```bash
coolstory checkpoints list <repo-slug>
coolstory checkpoint "Title" --repo <repo-slug> [--branch <branch>] [--summary "..."] [--file path ...]
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
