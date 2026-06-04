# CoolStory Plugin

Public CoolStory CLI, agent integration, and desktop client package.

This repository is intentionally separate from the private CoolStory product repository. Users, agents, customer environments, and BMAD workspaces should install this plugin instead of cloning the private app source.

## What This Does

`coolstory` lets agents, BMAD workflows, desktop users, and local developer workflows:

- authenticate to CoolStory through a browser-approved web session
- launch a local desktop-style GUI for project and artifact context
- list accessible projects and repositories
- read artifacts into an agent context
- inspect Git refs and download authenticated snapshots
- queue implementation checkpoints against a branch
- hand off work back to CoolStory for review, history, and pull requests

## Install

Requires Node.js 20 or newer.

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify:

```bash
coolstory --help
```

The package exposes:

- `coolstory`: canonical headless CLI for BMAD agents and automation.
- `coolstory-desktop`: desktop GUI launcher and CLI-compatible alias.
- `coolstory-plugin`: compatibility alias.

Launch the desktop GUI:

```bash
coolstory-desktop
```

The desktop package opens a CoolStory app window. Click **Open browser sign-in** to approve the device-code request inside your authenticated CoolStory web session. After approval, the app stores the generated CoolStory token locally.

## Standalone Binaries

Release builds publish desktop app packages for:

- Windows x64: `coolstory-desktop-win-x64.exe`
- macOS Apple Silicon: `coolstory-desktop-macos-arm64.zip`
- Linux x64: `coolstory-desktop-linux-x64.AppImage`

Build locally from this repository:

```bash
npm install
npm run build:desktop
```

The generated desktop package is written to `dist-electron/`.

Windows and macOS packages are built by GitHub Actions on native runners using Electron. Source installs still require Node.js 20 or newer. Run the `Release Binaries` workflow or push a `v*` tag.

## Connect

Recommended desktop flow:

```bash
coolstory-desktop
```

The app opens a local GUI and starts a secure browser approval flow at `https://coolstory.dev/app/connect`.

Agent and CI fallback:

Create a personal access token in CoolStory, then store it locally:

```bash
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

For a different environment:

```bash
coolstory auth login --api-url https://coolstory.dev --token cs_pat_xxxxxxxxxxxxxxxx
```

You can also avoid local storage and use environment variables:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

## Quickstart

```bash
coolstory quickstart
coolstory skills
coolstory context <repo-slug> [artifact-slug]
coolstory whoami
coolstory repos list
coolstory artifacts list <repo-slug>
coolstory artifacts get <repo-slug> <artifact-slug>
coolstory artifacts push <repo-slug> docs/my-bmad-artifact.md --kind prd --branch feature/my-work
coolstory checkpoint "Implemented artifact slice" --repo <repo-slug> --file <path>
```

## Common Workflows

Inspect branch refs:

```bash
coolstory repos refs my-project
```

Download a repository snapshot:

```bash
coolstory repos archive my-project --ref main
```

Queue a checkpoint for the current branch:

```bash
coolstory checkpoint "Agent implementation checkpoint" --repo my-project --branch feature/agent-work --file src/app.ts
```

Push a BMAD-created Markdown file back as a CoolStory artifact:

```bash
coolstory artifacts push my-project docs/payment-prd.md --kind prd --branch feature/payments
coolstory artifacts update my-project docs/payment-prd.md --slug payment-prd --kind prd --branch feature/payments
```

Fetch an artifact as JSON for custom tooling:

```bash
coolstory artifacts get my-project launch-artifact --json
```

## BMAD Integration

BMAD teams should treat CoolStory as the source of truth for product artifacts, project context, checkpoints, and review history.

Recommended agent loop:

1. Discover the project and artifact:

   ```bash
   coolstory context <repo-slug> <artifact-slug>
   coolstory repos list
   coolstory artifacts list <repo-slug>
   coolstory artifacts get <repo-slug> <artifact-slug>
   ```

2. Load the artifact and project files into the BMAD agent context.

3. Implement in a normal Git branch.

4. If the agent creates or rewrites a Markdown artifact locally, push it back to CoolStory:

   ```bash
   coolstory artifacts push <repo-slug> <artifact-file.md> --kind prd --branch <branch>
   ```

5. Queue a checkpoint back to CoolStory:

   ```bash
   coolstory checkpoint "BMAD dev agent checkpoint" --repo <repo-slug> --branch <branch> --file <changed-file>
   ```

6. Review the branch, comments, checkpoint history, and pull request in CoolStory.

Detailed guide: [docs/bmad.md](docs/bmad.md)

## Docs

- [Getting started](docs/getting-started.md)
- [BMAD integration](docs/bmad.md)
- [Agent prompts](docs/agent-prompts.md)
- [Collaboration workflow](docs/collaboration.md)
- [API examples](docs/api.md)
- [Command reference](docs/commands.md)
- [Releases and binaries](docs/releases.md)
- [Security model](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)

## Auth And Security

- Tokens are read from `COOLSTORY_TOKEN` first.
- If no environment token is present, the plugin reads `~/.coolstory/plugin.json`.
- `~/.coolstory/plugin.json` is created with user-only permissions where the platform supports it.
- The plugin only calls the public CoolStory API surface.
- The plugin does not need access to the private CoolStory app repository.

## License

MIT. See [LICENSE](LICENSE).
