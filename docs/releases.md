# Releases And Binaries

The plugin can run through Node.js or as a standalone binary.

## Node Install

```bash
npm install -g github:hassard0/coolstory-plugin
```

## Binary Builds

GitHub Actions builds:

- `coolstory-plugin-win-x64.exe`
- `coolstory-plugin-macos-arm64`
- `coolstory-plugin-macos-x64`
- `coolstory-plugin-linux-x64`

Run the `Release Binaries` workflow manually or push a `v*` tag.

## Local Native Build

Build for the current OS:

```bash
npm install
npm run build:binary -- --targets node18-linux-x64
```

Cross-platform binaries should be produced on matching native runners through GitHub Actions.
