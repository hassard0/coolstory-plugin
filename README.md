# CoolStory Plugin

Public CoolStory desktop client, agent integration, and CLI package.

This repository is intentionally separate from the private CoolStory product repository. Users, agents, customer environments, and BMAD workspaces should install this plugin instead of cloning the private app source.

## What This Does

`coolstory-desktop` lets desktop users, agents, and local developer workflows:

- authenticate to CoolStory through a browser-approved web session
- launch a local desktop-style GUI for project and artifact context
- list accessible projects and repositories
- read PRDs into an agent context
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
coolstory-desktop --help
```

The package also exposes `coolstory-plugin` and `coolstory` aliases, but docs use `coolstory-desktop` for the client command.

Launch the desktop GUI:

```bash
coolstory-desktop
```

The client opens a local GUI in your browser. Click **Connect with browser** to approve the device-code request inside your authenticated CoolStory web session. After approval, the client stores the generated CoolStory token locally.

## Standalone Binaries

Release builds publish standalone binaries for:

- Windows x64: `coolstory-desktop-win-x64.exe`
- macOS Apple Silicon: `coolstory-desktop-macos-arm64`
- Linux x64: `coolstory-desktop-linux-x64`

Build locally from this repository:

```bash
npm install
npm run build:binary
```

The generated executable is written to `dist/`.

Windows and macOS binaries are built by GitHub Actions on native runners using Node SEA. Source installs still require Node.js 20 or newer. Run the `Release Binaries` workflow or push a `v*` tag.

## Connect

Recommended desktop flow:

```bash
coolstory-plugin
```

The app opens a local GUI and starts a secure browser approval flow at `https://coolstory.dev/app/connect`.

Agent and CI fallback:

Create a personal access token in CoolStory, then store it locally:

```bash
coolstory-desktop auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

For a different environment:

```bash
coolstory-desktop auth login --api-url https://coolstory.dev --token cs_pat_xxxxxxxxxxxxxxxx
```

You can also avoid local storage and use environment variables:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

## Quickstart

```bash
coolstory-desktop quickstart
coolstory-desktop whoami
coolstory-desktop repos list
coolstory-desktop prds list <repo-slug>
coolstory-desktop prds get <repo-slug> <prd-slug>
coolstory-desktop checkpoint "Implemented PRD slice" --repo <repo-slug> --file <path>
```

## Common Workflows

Inspect branch refs:

```bash
coolstory-desktop repos refs my-project
```

Download a repository snapshot:

```bash
coolstory-desktop repos archive my-project --ref main
```

Queue a checkpoint for the current branch:

```bash
coolstory-desktop checkpoint "Agent implementation checkpoint" --repo my-project --branch feature/agent-work --file src/app.ts
```

Fetch a PRD as JSON for custom tooling:

```bash
coolstory-desktop prds get my-project launch-prd --json
```

## BMAD Integration

BMAD teams should treat CoolStory as the source of truth for product artifacts, project context, checkpoints, and review history.

Recommended agent loop:

1. Discover the repo and PRD:

   ```bash
   coolstory-desktop repos list
   coolstory-desktop prds list <repo-slug>
   coolstory-desktop prds get <repo-slug> <prd-slug>
   ```

2. Load the PRD and project files into the BMAD agent context.

3. Implement in a normal Git branch.

4. Queue a checkpoint back to CoolStory:

   ```bash
   coolstory-desktop checkpoint "BMAD dev agent checkpoint" --repo <repo-slug> --branch <branch> --file <changed-file>
   ```

5. Review the branch, comments, checkpoint history, and pull request in CoolStory.

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
