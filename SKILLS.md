# CoolStory BMAD Client Skill

Use this skill when an agent or BMAD client needs to read CoolStory project context, create or update artifacts, and hand work back for review.

## Core Rules

- Treat CoolStory artifacts as the source of truth for requirements, architecture, stories, QA gates, decisions, and implementation handoff.
- Never assume a local Markdown file is visible in CoolStory until it has been pushed with `coolstory artifacts push`.
- Use checkpoints for implementation milestones and changed source files. Use artifacts for durable product/design/architecture/story content.
- Preserve repo slug, artifact slug, branch name, and changed file paths in every handoff.
- Prefer small, coherent slices. Push artifact changes before queuing checkpoints.

## Startup

Authenticate:

```bash
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

For ephemeral agents, prefer environment variables:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

Load project context:

```bash
coolstory context <repo-slug>
coolstory context <repo-slug> <artifact-slug>
coolstory bmad start <repo-slug> <artifact-slug> --branch feature/<short-name> --dir ./workspace
```

Use `clone` when the BMAD client needs local project source context. It downloads a tenant-checked snapshot from CoolStory and extracts it into the target folder.

Prefer `bmad start` over hand-assembling refs, clones, and artifact pulls. It prints the next `sync` and `handoff` commands for the agent.

## Artifact Workflow

List artifacts:

```bash
coolstory artifacts list <repo-slug>
coolstory artifacts kinds
```

Read an artifact:

```bash
coolstory artifacts get <repo-slug> <artifact-slug>
```

Push a local BMAD Markdown artifact so it appears in CoolStory:

```bash
coolstory bmad sync <repo-slug> <file.md> --kind prd --branch <branch>
```

Use `bmad sync` for first-time BMAD docs and updates. It creates or updates the artifact, attaches the Markdown content to the checkpoint, and does not require a human-supplied materialization ID.

Materialize a queued checkpoint when the web app or API has not done it yet:

```bash
coolstory checkpoints materialize <repo-slug> <checkpoint-id>
```

Use `--kind` values:

```text
project_brief
prd
architecture
frontend_spec
design_doc
rfc
rfd
epic
story
qa_gate
retrospective
note
```

Use `--slug` when updating a specific existing artifact:

```bash
coolstory artifacts update <repo-slug> docs/payment-prd.md --slug payment-prd --kind prd --branch feature/payments
```

## Implementation Workflow

Work on a named Git branch:

```bash
git checkout -b feature/<short-name>
```

After a coherent slice, queue a checkpoint:

```bash
coolstory bmad handoff <repo-slug> \
  --branch feature/<short-name> \
  --title "Implemented <slice>" \
  --summary "What changed and why" \
  --file src/path-one.ts \
  --file src/path-two.ts
```

## Agent Handoff

When finishing, report:

- CoolStory repo slug.
- Artifact slug(s) read or pushed.
- Branch name.
- Files changed.
- Checkpoint title and result.
- Tests run.
- Risks, missing tests, or follow-up decisions.
