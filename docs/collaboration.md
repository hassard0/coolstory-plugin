# Collaboration Workflow

CoolStory collaboration is branch-backed.

## Artifact Work

1. Read the PRD.
2. Implement on a Git branch.
3. Queue a checkpoint.
4. Open a CoolStory pull request.
5. Review comments, history, and branch comparison in the web app.

## Multiple Sessions

The web editor protects against silent overwrites:

- it polls for newer artifact versions
- it blocks stale saves
- it asks the user to load the latest version when another session changed the artifact

Agents should avoid long-running blind edits. Before queueing a checkpoint, refresh context and cite all changed files.

## Project Access

Private projects can only add existing company team members.

Recommended flow:

1. Invite the person to the company.
2. Wait for them to accept/sign in.
3. Add them to the private project from the project members panel.

