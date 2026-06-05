# CoolStory Plugin

Public CoolStory CLI, agent integration, and desktop client package.

This repository is intentionally separate from the private CoolStory product repository. Users, agents, customer environments, and BMAD workspaces should install this plugin instead of cloning the private app source.

## What This Does

`coolstory` lets agents, BMAD workflows, desktop users, and local developer workflows:

- authenticate to CoolStory through a browser-approved web session
- launch a local desktop-style GUI for project and artifact context
- list accessible projects and repositories
- read artifacts into an agent context
- inspect Git refs and download or extract authenticated snapshots
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
- `coolstory-mcp`: local PAT-backed MCP stdio server for clients that cannot use hosted MCP.

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
coolstory bmad start <repo-slug> <artifact-slug> --branch feature/my-work --dir ./workspace
coolstory bmad sync <repo-slug> docs/artifact.md --branch feature/my-work --kind prd
coolstory bmad handoff <repo-slug> --branch feature/my-work --title "Implemented artifact slice" --file <path>
coolstory checkpoints materialize <repo-slug> <checkpoint-id>
```

## Common Workflows

Inspect branch refs:

```bash
coolstory repos refs my-project
coolstory branches list my-project --json
coolstory branches create my-project feature/agent-work --from main
```

Download a repository snapshot:

```bash
coolstory repos archive my-project --ref main
```

Extract a repository snapshot into a local workspace:

```bash
coolstory clone my-project ./my-project --ref main
coolstory repos clone my-project ./my-project --ref main
```

Queue a checkpoint for the current branch:

```bash
coolstory checkpoint "Agent implementation checkpoint" --repo my-project --branch feature/agent-work --file src/app.ts
```

Materialize a queued checkpoint and import attached Markdown artifact payloads:

```bash
coolstory checkpoints materialize my-project <checkpoint-id>
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

Pull an artifact into a local Markdown file before editing:

```bash
coolstory artifacts pull my-project launch-artifact docs/launch-artifact.md
coolstory artifacts pull my-project launch-artifact docs/launch-artifact.md --force
```

List supported artifact kinds:

```bash
coolstory artifacts kinds
```

## MCP Server

CoolStory hosts a PAT-backed MCP Streamable HTTP endpoint at `https://coolstory.dev/api/mcp`. Use hosted MCP by default for managed agents:

```text
Server URL: https://coolstory.dev/api/mcp
Transport: MCP Streamable HTTP
Auth: Bearer token through the client's remote-MCP auth flow
Protected resource metadata: https://coolstory.dev/.well-known/oauth-protected-resource
```

Use the dependency-free local stdio server only when the agent client requires a local command:

```bash
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
coolstory-mcp
```

Or use environment variables in an agent runtime:

```bash
COOLSTORY_API_URL=https://coolstory.dev COOLSTORY_TOKEN=cs_pat_xxx coolstory-mcp
```

Available MCP tools include:

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

These tools only see repositories and artifacts allowed by the PAT.

Local stdio agent config shape:

```json
{
  "mcpServers": {
    "coolstory": {
      "command": "coolstory-mcp",
      "env": {
        "COOLSTORY_API_URL": "https://coolstory.dev",
        "COOLSTORY_TOKEN": "cs_pat_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Detailed guide: [docs/mcp.md](docs/mcp.md)

## BMAD Integration

BMAD teams should treat CoolStory as the source of truth for product artifacts, project context, checkpoints, and review history.

Recommended agent loop:

1. Start a BMAD session:

   ```bash
   coolstory bmad start <repo-slug> <artifact-slug> --branch feature/<short-name> --dir ./workspace
   ```

   This creates the working branch in CoolStory, pulls the artifact into `docs/<artifact-slug>.md`, and optionally extracts a tenant-checked repo snapshot into `./workspace`.

2. Load the artifact and extracted project files into the BMAD agent context.

3. Implement in a normal Git branch. When BMAD creates or rewrites a Markdown artifact locally, sync it back to CoolStory:

   ```bash
   coolstory bmad sync <repo-slug> docs/<artifact>.md --branch feature/<short-name> --kind prd
   ```

   `sync` creates or updates the artifact and queues a checkpoint carrying the artifact content, so first-time BMAD docs appear in the web artifact list.

4. Hand work back to CoolStory:

   ```bash
   coolstory bmad handoff <repo-slug> --branch feature/<short-name> --title "Implemented <slice>" --file <changed-file>
   ```

5. Review the branch, comments, checkpoint history, merge preview, and pull request in CoolStory.

Detailed guide: [docs/bmad.md](docs/bmad.md)

## Docs

- [Getting started](docs/getting-started.md)
- [BMAD integration](docs/bmad.md)
- [MCP server](docs/mcp.md)
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
