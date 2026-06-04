# Getting Started

This guide gets a developer or agent from zero to a CoolStory checkpoint.

## 1. Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

Verify:

```bash
coolstory-plugin --help
```

## 2. Create A Token

In CoolStory:

1. Open `https://coolstory.dev/app/settings`.
2. Create a personal access token.
3. Copy the `cs_pat_...` token.

Then connect locally:

```bash
coolstory-plugin auth login --token cs_pat_xxxxxxxxxxxxxxxx
coolstory-plugin whoami
```

## 3. Find Your Work

```bash
coolstory-plugin repos list
coolstory-plugin prds list <repo-slug>
coolstory-plugin prds get <repo-slug> <prd-slug>
```

## 4. Work In Git

Use a normal branch:

```bash
git checkout -b feature/<short-name>
```

## 5. Send A Checkpoint Back

```bash
coolstory-plugin checkpoint "Implemented first slice" \
  --repo <repo-slug> \
  --branch feature/<short-name> \
  --summary "Implemented the initial behavior and added tests." \
  --file src/example.ts
```

Open CoolStory to review history, comments, and PRs:

```text
https://coolstory.dev/app
```

