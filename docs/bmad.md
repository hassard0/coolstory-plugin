# BMAD Integration

This guide shows how to connect BMAD-style planning and implementation workflows to CoolStory.

CoolStory should be used as the durable collaboration layer:

- PRDs live in CoolStory and can be fetched by agents.
- Implementation work happens on normal Git branches.
- Agent checkpoints are queued back to CoolStory.
- Review, comments, branch history, and pull requests are handled in CoolStory.

## Setup

Install the public plugin:

```bash
npm install -g github:hassard0/coolstory-plugin
```

Authenticate with a CoolStory personal access token:

```bash
coolstory-plugin auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

Confirm the agent can see the current user and repos:

```bash
coolstory-plugin whoami
coolstory-plugin repos list
```

## Recommended BMAD Agent Loop

### 1. Discover context

```bash
coolstory-plugin repos list
coolstory-plugin prds list <repo-slug>
coolstory-plugin prds get <repo-slug> <prd-slug>
```

Use the PRD content as the primary product requirement input for the BMAD agent.

### 2. Prime the agent

Give the agent:

- the PRD fetched from CoolStory
- the relevant local source files
- the current Git branch name
- the expected checkpoint title
- any project-specific acceptance criteria

Suggested agent instruction:

```text
Use the CoolStory PRD as the source of truth. Implement the smallest coherent slice, cite changed files, and queue a CoolStory checkpoint when done.
```

### 3. Implement on a branch

Use normal Git workflow:

```bash
git checkout -b feature/<short-name>
```

### 4. Queue a checkpoint

When the BMAD agent finishes a coherent slice:

```bash
coolstory-plugin checkpoint "Implemented <feature>" \
  --repo <repo-slug> \
  --branch feature/<short-name> \
  --summary "What changed and why" \
  --file src/path-one.ts \
  --file src/path-two.ts
```

CoolStory will show this checkpoint in project history and review surfaces.

### 5. Review in CoolStory

Open CoolStory:

```text
https://coolstory.dev/app
```

Review:

- checkpoint history
- artifact comments
- PRD changes
- pull request branch comparison
- team feedback

## Environment Variable Mode

For ephemeral agent containers:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
coolstory-plugin prds get <repo-slug> <prd-slug>
```

This avoids writing `~/.coolstory/plugin.json`.

## BMAD Handoff Checklist

Before an agent marks work complete:

- PRD requirement was read from CoolStory.
- Work happened on a named Git branch.
- Changed files are listed in the checkpoint.
- Summary explains the implementation and tradeoffs.
- Follow-up risks or missing tests are noted.
- CoolStory checkpoint was queued successfully.

