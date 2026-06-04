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

## Local Native Build

Build for the current OS:

```bash
npm install
npm run build:desktop
```

Cross-platform app packages should be produced on matching native runners through GitHub Actions.
