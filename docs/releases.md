# Releases And Binaries

The plugin can run through Node.js for CLI workflows or as a desktop app package.

## Node Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

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

## Latest Verified Release

`v0.1.17` passed MCP, CLI, source desktop, and packaged app smoke on:

- Windows Server 2025 runner for `coolstory-desktop-win-x64.exe`
- macOS 14 ARM runner for `coolstory-desktop-macos-arm64.zip`
- Ubuntu 24.04 runner for `coolstory-desktop-linux-x64.AppImage`

This release verifies the `coolstory-mcp` PAT-backed MCP stdio server in CI before publishing binaries.

Release page: https://github.com/hassard0/coolstory-plugin/releases/tag/v0.1.17

## Local Native Build

Build for the current OS:

```bash
npm install
npm run build:desktop
```

Cross-platform app packages should be produced on matching native runners through GitHub Actions.
