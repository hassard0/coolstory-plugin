# Collaboration Workflow

CoolStory collaboration is branch-backed.

## Artifact Work

1. Read the PRD.
2. Implement on a Git branch.
3. Queue a checkpoint.
4. Open a CoolStory pull request.
5. Review comments, history, and branch comparison in the web app.

## Multiple Sessions

The web and desktop editors share the same server-backed edit stream:

- every accepted edit increments the artifact revision
- clients poll for operations after their current revision
- stale edits are transformed over newer operations before they are saved
- the editor shows live/syncing/offline state
- selected text can be anchored into review comments in the web app

Agents should avoid long-running blind edits. Before queueing a checkpoint, refresh context and cite all changed files.

## Project Access

Private projects can only add existing company team members.

Recommended flow:

1. Invite the person to the company.
2. Wait for them to accept/sign in.
3. Add them to the private project from the project members panel.

The desktop app must keep project navigation, artifact type filters, artifact lists, collaborator avatars, checkpoints, and editor state populated from the authenticated CoolStory backend. It must not ship static navigation copied from a mockup.
