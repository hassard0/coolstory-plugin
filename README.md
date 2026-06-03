# CoolStory Plugin

Public CoolStory agent and CLI integration package.

This repository is intentionally separate from the private CoolStory product repository. Users, agents, and customer environments should install this plugin instead of cloning the private app source.

## Install

Requires Node.js 20 or newer.

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify:

```bash
coolstory-plugin --help
```

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
COOLSTORY_API_URL=https://coolstory.dev
COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

## Common Agent Workflows

List repositories visible to the token:

```bash
coolstory-plugin repos list
```

Inspect branch refs:

```bash
coolstory-plugin repos refs my-project
```

Fetch a PRD into an agent context:

```bash
coolstory-plugin prds get my-project launch-prd
```

Queue a checkpoint for the current branch:

```bash
coolstory-plugin checkpoint "Agent implementation checkpoint" --repo my-project --file src/app.ts
```

Download a repository snapshot:

```bash
coolstory-plugin repos archive my-project --ref main
```

Show an agent-oriented quickstart:

```bash
coolstory-plugin quickstart
```

## Auth And Security

- Tokens are read from `COOLSTORY_TOKEN` first.
- If no environment token is present, the plugin reads `~/.coolstory/plugin.json`.
- `~/.coolstory/plugin.json` is created with user-only permissions where the platform supports it.
- The plugin only calls the public CoolStory API surface. It does not need access to the private CoolStory app repository.

## Public API Surface

The plugin currently uses:

- `GET /api/public/cli/whoami`
- `GET /api/public/cli/repos`
- `GET /api/public/cli/repos/:slug/prds`
- `GET /api/public/cli/repos/:slug/prds/:prdSlug`
- `GET /api/public/cli/repos/:slug/checkpoints`
- `POST /api/public/cli/repos/:slug/checkpoints`
- `GET /api/public/git/repos/:slug/refs`
- `GET /api/public/git/repos/:slug/archive?ref=main`

