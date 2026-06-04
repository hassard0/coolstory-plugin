# Getting Started

This guide gets a developer or agent from zero to a CoolStory checkpoint.

## 1. Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify:

```bash
coolstory --help
```

## 2. Create A Token

For desktop use, launch the GUI and approve the browser connection:

```bash
coolstory-plugin
```

The app opens a local CoolStory desktop window. Choose **Open browser sign-in**, approve the matching code in the CoolStory web session, then return to the local app.

The desktop window is an Electron app shell backed by a loopback server at `127.0.0.1`. It opens your system browser only for device-code approval.

For headless agent or CI use, create a token manually.

In CoolStory:

1. Open `https://coolstory.dev/app/settings`.
2. Create a personal access token.
3. Copy the `cs_pat_...` token.

Then connect locally:

```bash
coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx
coolstory whoami
```

## 3. Find Your Work

```bash
coolstory repos list
coolstory artifacts list <repo-slug>
coolstory artifacts get <repo-slug> <artifact-slug>
```

## 4. Push New BMAD Artifacts

If your agent creates a local Markdown artifact, push it into CoolStory before checkpointing:

```bash
coolstory artifacts push <repo-slug> docs/my-artifact.md --kind prd --branch feature/<short-name>
```

## 5. Work In Git

Use a normal branch:

```bash
git checkout -b feature/<short-name>
```

## 6. Send A Checkpoint Back

```bash
coolstory checkpoint "Implemented first slice" \
  --repo <repo-slug> \
  --branch feature/<short-name> \
  --summary "Implemented the initial behavior and added tests." \
  --file src/example.ts
```

Open CoolStory to review history, comments, and PRs:

```text
https://coolstory.dev/app
```
