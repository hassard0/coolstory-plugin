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
coolstory clone <repo-slug> ./workspace --ref main
```

Use `clone` when the BMAD client needs local project source context. It downloads a tenant-checked snapshot from CoolStory and extracts it into the target folder.

## Artifact Workflow

List artifacts:

```bash
coolstory artifacts list <repo-slug>
```

Read an artifact:

```bash
coolstory artifacts get <repo-slug> <artifact-slug>
```

Push a local BMAD Markdown artifact so it appears in CoolStory:

```bash
coolstory artifacts push <repo-slug> <file.md> --kind prd --branch <branch>
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
coolstory checkpoint "Implemented <slice>" \
  --repo <repo-slug> \
  --branch feature/<short-name> \
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
