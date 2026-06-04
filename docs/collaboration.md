# Collaboration Workflow

CoolStory collaboration is branch-backed.

## Artifact Work

1. Start the branch and artifact workspace with `coolstory bmad start`.
2. Implement on the named Git branch.
3. Sync Markdown artifact changes with `coolstory bmad sync`.
4. Hand off changed files with `coolstory bmad handoff`.
5. Open or review the CoolStory pull request.
6. Review comments, history, merge preview, and branch comparison in the web app.

## Multiple Sessions

The web and desktop editors share the same server-backed edit stream:

- every accepted edit increments the artifact revision
- clients poll for operations after their current revision
- stale edits are transformed over newer operations before they are saved
- the editor shows live/syncing/offline state
- selected text can be anchored into review comments in the web app

Agents should avoid long-running blind edits. Before queueing a handoff, refresh context, sync any Markdown artifacts, and cite all changed files.

## Project Access

Private projects can only add existing company team members.

Recommended flow:

1. Invite the person to the company.
2. Wait for them to accept/sign in.
3. Add them to the private project from the project members panel.

The desktop app must keep project navigation, artifact type filters, artifact lists, collaborator avatars, checkpoints, and editor state populated from the authenticated CoolStory backend. It must not ship static navigation copied from a mockup.
