# Getting Started

This guide gets a developer or agent from zero to a CoolStory checkpoint.

## 1. Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify:

```bash
coolstory-desktop --help
```

## 2. Create A Token

For desktop use, launch the GUI and approve the browser connection:

```bash
coolstory-plugin
```

The app opens a local CoolStory client in your browser. Choose **Connect with browser**, approve the matching code in the CoolStory web session, then return to the client.

For headless agent or CI use, create a token manually.

In CoolStory:

1. Open `https://coolstory.dev/app/settings`.
2. Create a personal access token.
3. Copy the `cs_pat_...` token.

Then connect locally:

```bash
coolstory-desktop auth login --token cs_pat_xxxxxxxxxxxxxxxx
coolstory-desktop whoami
```

## 3. Find Your Work

```bash
coolstory-desktop repos list
coolstory-desktop prds list <repo-slug>
coolstory-desktop prds get <repo-slug> <prd-slug>
```

## 4. Work In Git

Use a normal branch:

```bash
git checkout -b feature/<short-name>
```

## 5. Send A Checkpoint Back

```bash
coolstory-desktop checkpoint "Implemented first slice" \
  --repo <repo-slug> \
  --branch feature/<short-name> \
  --summary "Implemented the initial behavior and added tests." \
  --file src/example.ts
```

Open CoolStory to review history, comments, and PRs:

```text
https://coolstory.dev/app
```
