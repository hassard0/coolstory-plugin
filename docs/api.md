# API Examples

The plugin wraps CoolStory's public API. These examples are useful for custom tooling.

Set:

```bash
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
export COOLSTORY_API_URL=https://coolstory.dev
```

## Current User

```bash
curl "$COOLSTORY_API_URL/api/public/cli/whoami" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"
```

## Repositories

```bash
curl "$COOLSTORY_API_URL/api/public/cli/repos" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"
```

## Artifacts

The current public API route is still named `/prds` for compatibility, but the returned records are CoolStory artifacts.

```bash
curl "$COOLSTORY_API_URL/api/public/cli/repos/<repo-slug>/prds" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"

curl "$COOLSTORY_API_URL/api/public/cli/repos/<repo-slug>/prds/<artifact-slug>" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"
```

## Checkpoints

```bash
curl "$COOLSTORY_API_URL/api/public/cli/repos/<repo-slug>/checkpoints" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"

curl "$COOLSTORY_API_URL/api/public/cli/repos/<repo-slug>/checkpoints" \
  -X POST \
  -H "Authorization: Bearer $COOLSTORY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "feature/example",
    "title": "Implemented example",
    "summary": "Small coherent implementation slice.",
    "files": ["src/example.ts"]
  }'
```

## Git Snapshots

```bash
curl "$COOLSTORY_API_URL/api/public/git/repos/<repo-slug>/refs" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"

curl "$COOLSTORY_API_URL/api/public/git/repos/<repo-slug>/archive?ref=main" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN" \
  -o repo-main.tar
```

## Git Discovery

CoolStory exposes authenticated ref discovery for Git tooling:

```bash
curl "$COOLSTORY_API_URL/api/public/git/repos/<repo-slug>/info/refs?service=git-upload-pack" \
  -H "Authorization: Bearer $COOLSTORY_TOKEN"
```

This is discovery-only today. BMAD and agents should still use `coolstory clone` for tenant-checked snapshots and CoolStory PR/checkpoint APIs for handoff. Full smart Git `upload-pack` and `receive-pack` negotiation are tracked as the next Git-server milestone.
