# MCP Server

CoolStory exposes a hosted PAT-backed MCP endpoint at `https://coolstory.dev/api/mcp` and also includes `coolstory-mcp`, a local stdio MCP server for clients that cannot use hosted MCP.

Use hosted MCP by default when the agent runtime can call remote tools. Use local stdio MCP when the client requires a local command. Use the `coolstory` CLI when the agent is shell-first or needs local file operations such as `bmad start`, `bmad sync`, `clone`, or `bmad handoff`.

## Hosted MCP

Create a CoolStory PAT in the web app under Settings, then configure remote-capable MCP clients with:

```json
{
  "mcpServers": {
    "coolstory": {
      "url": "https://coolstory.dev/api/mcp",
      "headers": {
        "Authorization": "Bearer cs_pat_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Hosted MCP is the preferred path for managed agents because there is no local package install, no local token file, and every tool request is authorized by the CoolStory backend.

You can inspect the hosted endpoint:

```bash
curl https://coolstory.dev/api/mcp
```

## Local Stdio MCP

Install the public integration package:

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify both binaries:

```bash
coolstory --help
coolstory-mcp --help
```

Then either save the PAT locally:

```bash
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
coolstory-mcp
```

Or pass credentials through the agent runtime environment:

```bash
COOLSTORY_API_URL=https://coolstory.dev COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx coolstory-mcp
```

## Local Agent Config

For stdio-only clients, use a config shaped like this:

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

If the local agent process already has `COOLSTORY_API_URL` and `COOLSTORY_TOKEN`, the `env` block can be omitted.

## Tools

Core tools:

- `coolstory_whoami`: confirm the PAT owner.
- `coolstory_list_repos`: list projects visible to the PAT owner.
- `coolstory_list_artifacts`: list artifacts in a project.
- `coolstory_get_artifact`: fetch artifact Markdown and metadata.
- `coolstory_create_artifact`: create an artifact from agent output.
- `coolstory_update_artifact`: update an existing artifact.
- `coolstory_search_artifacts`: find artifacts by title, slug, kind, or content.
- `coolstory_context`: load repo metadata, refs, artifact list, and optional artifact body.
- `coolstory_list_checkpoints`: list checkpoints for a project.
- `coolstory_create_checkpoint`: queue an implementation checkpoint.
- `coolstory_materialize_checkpoint`: turn a queued checkpoint into branch commits and imported artifacts.
- `coolstory_propose_change`: open a reviewable proposed change.

## BMAD Loop With MCP

1. Call `coolstory_context` for the repo and current artifact.
2. Use the returned artifact body as the source of truth.
3. When creating a new Markdown artifact, call `coolstory_create_artifact` with the correct kind and branch.
4. When updating an existing artifact, call `coolstory_update_artifact`.
5. Queue implementation milestones with `coolstory_create_checkpoint`.
6. Materialize queued checkpoints with `coolstory_materialize_checkpoint` when the handoff should be durable immediately.
7. Report artifact slugs, checkpoint ids, branch, files changed, tests, risks, and next decisions.

For local file syncing, pair MCP with CLI commands:

```bash
coolstory bmad sync <repo-slug> docs/<artifact>.md --branch feature/<short-name> --kind prd
coolstory bmad handoff <repo-slug> --branch feature/<short-name> --title "Implemented <slice>" --file src/path.ts
```

## Security

The MCP server only sees data allowed by the PAT owner. CoolStory still enforces company membership, project membership, PAT validity, and OpenFGA relationship checks on every request.

Do not put PATs in source control, prompt transcripts, or shared config files. Prefer environment injection from the agent runtime or secret manager.
