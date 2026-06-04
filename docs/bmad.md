# BMAD Integration

This guide shows how to connect BMAD-style planning and implementation workflows to CoolStory.

CoolStory should be used as the durable collaboration layer:

- Product artifacts live in CoolStory and can be fetched by agents.
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
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

Confirm the agent can see the current user and repos:

```bash
coolstory whoami
coolstory repos list
```

## Recommended BMAD Agent Loop

### 1. Start the session

```bash
coolstory repos list
coolstory context <repo-slug>
coolstory artifacts list <repo-slug>
coolstory bmad start <repo-slug> <artifact-slug> --branch feature/<short-name> --dir ./workspace
```

`bmad start` creates the CoolStory branch if needed, pulls the selected artifact to `docs/<artifact-slug>.md`, and extracts a tenant-checked repo snapshot when `--dir` is supplied. Use the CoolStory artifact content as the primary product requirement input for the BMAD agent. Use the extracted snapshot as read-only project source context unless the workflow also has a normal Git remote configured.

### 2. Prime the agent

Give the agent:

- the artifact fetched from CoolStory
- the relevant local source files from `coolstory clone` or a normal Git checkout
- the current Git branch name
- the expected checkpoint title
- any project-specific acceptance criteria

Suggested agent instruction:

```text
Use the CoolStory artifact as the source of truth. Implement the smallest coherent slice, sync any Markdown artifact changes with `coolstory bmad sync`, cite changed files, and queue a CoolStory handoff when done.
```

### 3. Implement on a branch

Use normal Git workflow:

```bash
git checkout -b feature/<short-name>
```

If the branch should exist in CoolStory before artifact pushes or checkpoints and `bmad start` was not used, create it first:

```bash
coolstory branches create <repo-slug> feature/<short-name> --from main
```

### 4. Sync artifact changes

If the BMAD agent creates or substantially rewrites a Markdown artifact locally, sync it back so it appears in CoolStory:

```bash
coolstory bmad sync <repo-slug> docs/payment-prd.md --kind prd --branch feature/<short-name>
```

`bmad sync` creates or updates the artifact, writes the Markdown content into the checkpoint payload, and avoids asking humans to invent IDs. Use `coolstory artifacts kinds` when an agent needs to choose a kind for a new artifact.

### 5. Hand off a coherent slice

When the BMAD agent finishes a coherent slice:

```bash
coolstory bmad handoff <repo-slug> \
  --branch feature/<short-name> \
  --title "Implemented <feature>" \
  --summary "What changed and why" \
  --file src/path-one.ts \
  --file src/path-two.ts
```

CoolStory will show this checkpoint in project history and review surfaces.

When the handoff should also open a CoolStory pull request for an artifact, include the artifact slug and PR title:

```bash
coolstory bmad handoff <repo-slug> \
  --branch feature/<short-name> \
  --title "Ready for review" \
  --artifact payment-prd \
  --pr-title "Review payment PRD updates" \
  --file docs/payment-prd.md
```

### 6. Review in CoolStory

Open CoolStory:

```text
https://coolstory.dev/app
```

Review:

- checkpoint history
- artifact comments
- artifact changes
- pull request branch comparison
- team feedback

## Environment Variable Mode

For ephemeral agent containers:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
coolstory artifacts get <repo-slug> <artifact-slug>
```

This avoids writing `~/.coolstory/plugin.json`.

## BMAD Handoff Checklist

Before an agent marks work complete:

- Artifact requirement was read from CoolStory.
- Work happened on a named Git branch.
- Local Markdown artifacts were synced with `coolstory bmad sync`.
- Changed source files are listed in the handoff checkpoint.
- Summary explains the implementation and tradeoffs.
- Follow-up risks or missing tests are noted.
- CoolStory handoff was queued successfully.
