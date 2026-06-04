# Releases And Binaries

The plugin can run through Node.js or as a standalone binary.

## Node Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

## Binary Builds

GitHub Actions builds:

- `coolstory-desktop-win-x64.exe`
- `coolstory-desktop-macos-arm64`
- `coolstory-desktop-linux-x64`

Run the `Release Binaries` workflow manually or push a `v*` tag.

## Local Native Build

Build for the current OS:

```bash
npm install
npm run build:binary
```

Cross-platform binaries should be produced on matching native runners through GitHub Actions.
