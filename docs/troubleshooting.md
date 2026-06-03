# Troubleshooting

## `Missing token`

Run:

```bash
coolstory-plugin auth login --token cs_pat_xxxxxxxxxxxxxxxx
```

Or set:

```bash
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

## `401 Unauthorized`

The token is missing, expired, or does not have access to the requested company/project.

Create a new token in CoolStory and confirm:

```bash
coolstory-plugin whoami
```

## `404 Not Found`

Check the repository slug and PRD slug:

```bash
coolstory-plugin repos list
coolstory-plugin prds list <repo-slug>
```

## Cannot install from GitHub

Confirm Node.js 20 or newer:

```bash
node --version
```

Then reinstall:

```bash
npm install -g github:hassard0/coolstory-plugin
```

## Agent container should not write credentials

Use environment variables:

```bash
export COOLSTORY_API_URL=https://coolstory.dev
export COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx
```

