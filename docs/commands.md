# Command Reference

## Headless CLI For BMAD

```bash
coolstory --help
coolstory quickstart
coolstory skills
coolstory context <repo-slug> [artifact-slug]
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
coolstory repos clone <repo-slug> [dir] [--ref main]
coolstory clone <repo-slug> [dir] [--ref main]
```

`clone` downloads the tenant-checked tar snapshot and extracts it into a local folder. It is a snapshot command for agents and BMAD workspaces, not a replacement for full Git push/fetch.

## Artifacts

```bash
coolstory artifacts list <repo-slug>
coolstory artifacts get <repo-slug> <artifact-slug>
coolstory artifacts get <repo-slug> <artifact-slug> --json
coolstory artifacts pull <repo-slug> <artifact-slug> [file.md] [--force]
coolstory artifacts kinds
coolstory artifacts push <repo-slug> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
coolstory artifacts create <repo-slug> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
coolstory artifacts update <repo-slug> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
```

`coolstory prds ...` remains available as a compatibility alias for existing PRD-only workflows.

`artifacts push` creates or updates the CoolStory artifact matching the inferred or supplied slug. Use it when BMAD creates a local Markdown artifact that should appear in the web artifact library.

`artifacts pull` writes a CoolStory artifact to a local Markdown file for editing. It refuses to overwrite an existing file unless `--force` is supplied.

`artifacts kinds` prints the supported artifact kind values for agent prompts and scripts.

`artifacts create` and `artifacts update` are explicit aliases for agent prompts that prefer intent-specific commands. The server still performs a safe upsert and reports whether the artifact was created or updated.

## Context And Skills

```bash
coolstory context <repo-slug>
coolstory context <repo-slug> <artifact-slug>
coolstory skills
```

`context` prints JSON containing repo metadata, refs, artifacts, and optionally a full artifact body.

`skills` prints `SKILLS.md`, the BMAD client contract packaged with the CLI.

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
