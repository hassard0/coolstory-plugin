# CoolStory Plugin

Public CoolStory agent and CLI integration package.

This repository is intentionally separate from the private CoolStory product repository. Users, agents, customer environments, and BMAD workspaces should install this plugin instead of cloning the private app source.

## What This Does

`coolstory-plugin` lets agents and local developer workflows:

- authenticate to CoolStory with a personal access token
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
coolstory-plugin --help
```

The package also exposes a `coolstory` alias, but docs use `coolstory-plugin` so it is clear this is the public integration package.

## Standalone Binaries

Release builds publish standalone binaries for:

- Windows x64: `coolstory-plugin-win-x64.exe`
- macOS Apple Silicon: `coolstory-plugin-macos-arm64`
- macOS Intel: `coolstory-plugin-macos-x64`
- Linux x64: `coolstory-plugin-linux-x64`

Build locally from this repository:

```bash
npm install
npm run build:binary
```

The generated executable is written to `dist/`.

Windows and macOS binaries are built by GitHub Actions on native runners using Node SEA. Source installs still require Node.js 20 or newer. Run the `Release Binaries` workflow or push a `v*` tag.

## Connect

Create a personal access token in CoolStory, then store it locally:

```bash
coolstory-plugin auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

For a different environment:

```bash
coolstory-plugin auth login --api-url https://coolstory.dev --token cs_pat_xxxxxxxxxxxxxxxx
```

You can also avoid local storage and use environment variables:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

## Quickstart

```bash
coolstory-plugin quickstart
coolstory-plugin whoami
coolstory-plugin repos list
coolstory-plugin prds list <repo-slug>
coolstory-plugin prds get <repo-slug> <prd-slug>
coolstory-plugin checkpoint "Implemented PRD slice" --repo <repo-slug> --file <path>
```

## Common Workflows

Inspect branch refs:

```bash
coolstory-plugin repos refs my-project
```

Download a repository snapshot:

```bash
coolstory-plugin repos archive my-project --ref main
```

Queue a checkpoint for the current branch:

```bash
coolstory-plugin checkpoint "Agent implementation checkpoint" --repo my-project --branch feature/agent-work --file src/app.ts
```

Fetch a PRD as JSON for custom tooling:

```bash
coolstory-plugin prds get my-project launch-prd --json
```

## BMAD Integration

BMAD teams should treat CoolStory as the source of truth for product artifacts, project context, checkpoints, and review history.

Recommended agent loop:

1. Discover the repo and PRD:

   ```bash
   coolstory-plugin repos list
   coolstory-plugin prds list <repo-slug>
   coolstory-plugin prds get <repo-slug> <prd-slug>
   ```

2. Load the PRD and project files into the BMAD agent context.

3. Implement in a normal Git branch.

4. Queue a checkpoint back to CoolStory:

   ```bash
   coolstory-plugin checkpoint "BMAD dev agent checkpoint" --repo <repo-slug> --branch <branch> --file <changed-file>
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
