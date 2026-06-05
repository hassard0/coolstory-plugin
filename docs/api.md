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

curl "$COOLSTORY_API_URL/api/public/cli/repos/<repo-slug>/checkpoints/<checkpoint-id>/materialize" \
  -X POST \
  -H "Authorization: Bearer $COOLSTORY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
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

Git clients may also POST to the authenticated smart-service endpoints:

```bash
curl "$COOLSTORY_API_URL/api/public/git/repos/<repo-slug>/git-upload-pack" \
  -X POST \
  -H "Authorization: Bearer $COOLSTORY_TOKEN" \
  -H "Content-Type: application/x-git-upload-pack-request" \
  --data-binary '0000'

curl "$COOLSTORY_API_URL/api/public/git/repos/<repo-slug>/git-receive-pack" \
  -X POST \
  -H "Authorization: Bearer $COOLSTORY_TOKEN" \
  -H "Content-Type: application/x-git-receive-pack-request" \
  --data-binary '0000'
```

These endpoints currently return authenticated, Git-shaped `501` service errors. They exist so Git tooling fails clearly while CoolStory finishes pack negotiation and audited push support.
