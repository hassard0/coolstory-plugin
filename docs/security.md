# Security Model

The public plugin uses CoolStory's public API surface and bearer-token authentication.

## Token Order

The plugin resolves credentials in this order:

1. `COOLSTORY_TOKEN`
2. `~/.coolstory/plugin.json`

The API URL resolves in this order:

1. `COOLSTORY_API_URL`
2. `~/.coolstory/plugin.json`
3. `https://coolstory.dev`

## Local Storage

`coolstory-desktop auth login` writes:

```text
~/.coolstory/plugin.json
```

The file is created with user-only permissions where supported by the platform.

For CI, containers, and short-lived agents, prefer environment variables instead of writing a token to disk.

## Repository Access

The plugin does not clone or require the private CoolStory product repository.

All access is scoped by the token and enforced by CoolStory server-side authorization.

