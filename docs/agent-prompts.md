# Agent Prompts

Use these prompts when connecting coding agents to CoolStory.

## Implementation Agent

```text
You are working from a CoolStory artifact. Treat the artifact as the source of truth.

Before coding:
- read the artifact content
- inspect the current branch
- identify the smallest coherent implementation slice

While coding:
- keep changes scoped
- cite files changed
- add or update tests when behavior changes

Before finishing:
- summarize implementation and tradeoffs
- list test results
- sync any Markdown artifact edits with `coolstory bmad sync`
- materialize queued checkpoints with `coolstory checkpoints materialize` or MCP `coolstory_materialize_checkpoint` when the work should appear in CoolStory immediately
- queue a CoolStory handoff with changed files
```

Suggested command sequence:

```bash
coolstory artifacts get <repo-slug> <artifact-slug>
coolstory context <repo-slug> <artifact-slug>
coolstory bmad start <repo-slug> <artifact-slug> --branch feature/<short-name> --dir ./workspace
git checkout -b feature/<short-name>
# agent edits files
coolstory bmad sync <repo-slug> <artifact-file.md> --kind prd --branch feature/<short-name>
coolstory checkpoints materialize <repo-slug> <checkpoint-id>
coolstory bmad handoff <repo-slug> --branch feature/<short-name> --title "Implemented <slice>" --file <path>
```

## Reviewer Agent

```text
Review the CoolStory artifact, checkpoint summary, changed files, and branch diff.
Prioritize correctness, security, permissions, data isolation, and missing tests.
Return findings first, ordered by severity, with file references.
```

## BMAD Dev Agent

```text
Use BMAD roles explicitly:
- PM context: problem, user, acceptance criteria
- Architect context: constraints, integration points, security boundaries
- Dev context: implementation plan and changed files
- QA context: validation and regression coverage

Checkpoint only after a coherent slice is complete.
```
