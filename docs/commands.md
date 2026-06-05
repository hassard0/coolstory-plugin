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
coolstory branches list <repo-slug> [--json]
coolstory branches create <repo-slug> <branch> [--from main] [--json]
```

`clone` downloads the tenant-checked tar snapshot and extracts it into a local folder. It is a snapshot command for agents and BMAD workspaces, not a replacement for full Git push/fetch.

`branches list` is the agent-friendly wrapper for branch refs. Use `--json` when feeding branch metadata into BMAD or other automation.

`branches create` creates a new branch from another branch or commit SHA through the tenant-checked Git ref API.

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

## BMAD Session Commands

```bash
coolstory bmad start <repo-slug> [artifact-slug] [--branch feature/name] [--from main] [--dir ./workspace] [--pull docs/artifact.md] [--no-pull] [--force] [--json]
coolstory bmad sync <repo-slug> <file.md> [--branch feature/name] [--kind prd] [--slug slug] [--title "..."] [--checkpoint "..."] [--summary "..."] [--json]
coolstory bmad handoff <repo-slug> --branch feature/name --title "..." [--summary "..."] [--file path ...] [--artifact slug] [--pr-title "..."] [--target main] [--json]
coolstory checkpoints materialize <repo-slug> <checkpoint-id> [--json]
```

`bmad start` creates or reuses a branch, optionally pulls an artifact to a local Markdown file, and optionally extracts a repo snapshot into a workspace.

`bmad sync` is the preferred way for BMAD clients to materialize or update Markdown artifacts. It pushes the artifact content and queues a checkpoint carrying the same content so the web app can show it immediately.

`bmad handoff` queues the implementation checkpoint for changed files. When `--artifact` and `--pr-title` are supplied, it also opens a CoolStory pull request for the artifact branch comparison.

`checkpoints materialize` turns a queued checkpoint into a branch commit and imports attached Markdown artifact payloads into the CoolStory artifact library.

## Context And Skills

```bash
coolstory context <repo-slug>
coolstory context <repo-slug> <artifact-slug>
coolstory skills
```

`context` prints JSON containing repo metadata, refs, artifacts, and optionally a full artifact body.

`skills` prints `SKILLS.md`, the BMAD client contract packaged with the CLI.

## MCP Server

```bash
coolstory-mcp
coolstory mcp
```

Runs a local stdio MCP server using `COOLSTORY_TOKEN` or the token saved by `coolstory auth login`.

Prefer hosted MCP for managed agents:

```text
Server URL: https://coolstory.dev/api/mcp
Transport: MCP Streamable HTTP, protocol 2025-11-25
Auth: Auth0 OAuth/OIDC through the client's remote-MCP auth flow
Protected resource metadata: https://coolstory.dev/.well-known/oauth-protected-resource
Scopes: coolstory:mcp:read and coolstory:mcp:write
```

Use [MCP Server](mcp.md) for hosted transport details, Auth0 scopes, local stdio fallback, PAT setup, tool behavior, and the recommended BMAD loop.

Tools:

- `coolstory_whoami`
- `coolstory_list_repos`
- `coolstory_list_artifacts`
- `coolstory_get_artifact`
- `coolstory_create_artifact`
- `coolstory_update_artifact`
- `coolstory_search_artifacts`
- `coolstory_context`
- `coolstory_list_checkpoints`
- `coolstory_create_checkpoint`
- `coolstory_materialize_checkpoint`
- `coolstory_propose_change`

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
