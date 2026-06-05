# Releases And Binaries

The plugin can run through Node.js for CLI workflows or as a desktop app package.

## Node Install

```bash
npm install -g coolstory-plugin
```

GitHub fallback before the npm package is published:

```bash
npm install -g github:hassard0/coolstory-plugin
```

## npm Publishing

The `Publish npm` workflow runs on `v*` tags or manually through workflow dispatch. It installs with `npm ci`, runs CLI smoke, optionally runs MCP smoke when `COOLSTORY_MCP_SMOKE_TOKEN` is configured, inspects package contents with `npm pack --dry-run`, and publishes with provenance enabled.

Required setup:

- Configure npm trusted publishing for this repository, or add an `NPM_TOKEN` repository secret.
- Push a tag that matches `package.json`, for example `v0.1.21`.
- Use manual dispatch with `dry_run` enabled before the first public publish.

## Binary Builds

GitHub Actions builds:

- `coolstory-desktop-win-x64.exe`
- `coolstory-desktop-macos-arm64.zip`
- `coolstory-desktop-linux-x64.AppImage`

Run the `Release Binaries` workflow manually or push a `v*` tag.

The workflow must pass four gates before assets are uploaded:

- CLI smoke: `npm run smoke`
- MCP protocol smoke: `npm run smoke:mcp`
- Source desktop smoke: `npm run smoke:desktop`
- Packaged desktop app smoke: `npm run smoke:desktop:packaged`

The packaged smoke launches the built app on the native runner, verifies it opens a local Electron window, checks the landscape window size, confirms the device-code sign-in action is rendered, and asserts project, artifact type, artifact, avatar, editor, and sidebar resize elements exist.

Each desktop asset is uploaded with a matching `.sha256` file for release consumers and tap maintainers.

## Homebrew Tap Publishing

Use [Homebrew tap](homebrew.md) and [homebrew/coolstory.rb.template](../homebrew/coolstory.rb.template) when updating a public tap formula.

## Latest Verified Release

`v0.1.21` passed MCP, CLI, source desktop, and packaged app smoke on:

- Windows Server 2025 runner for `coolstory-desktop-win-x64.exe`
- macOS 14 ARM runner for `coolstory-desktop-macos-arm64.zip`
- Ubuntu 24.04 runner for `coolstory-desktop-linux-x64.AppImage`

This release adds the `coolstory_materialize_checkpoint` MCP tool on top of the `coolstory checkpoints materialize` CLI command.

Release page: https://github.com/hassard0/coolstory-plugin/releases/tag/v0.1.21

## Local Native Build

Build for the current OS:

```bash
npm install
npm run build:desktop
```

Cross-platform app packages should be produced on matching native runners through GitHub Actions.
