# Homebrew Tap

CoolStory can be published through a Homebrew tap after each tagged release.

## Formula Template

Use [homebrew/coolstory.rb.template](../homebrew/coolstory.rb.template) as the source for `Formula/coolstory.rb` in the tap repository.

For each release:

1. Publish the npm package:

   ```bash
   npm publish --provenance --access public
   ```

2. Create or push the matching Git tag:

   ```bash
   git tag v0.1.21
   git push origin v0.1.21
   ```

3. Compute the GitHub source tarball SHA:

   ```bash
   curl -L https://github.com/hassard0/coolstory-plugin/archive/refs/tags/v0.1.21.tar.gz | shasum -a 256
   ```

4. Copy the template into the tap as `Formula/coolstory.rb`, replace `vVERSION` with the tag, and replace `SOURCE_TARBALL_SHA256` with the tarball SHA.

5. Verify the formula from the tap checkout:

   ```bash
   brew install --build-from-source ./Formula/coolstory.rb
   brew test coolstory
   ```

The formula installs from the public GitHub tag and links the npm package binaries:

- `coolstory`
- `coolstory-desktop`
- `coolstory-plugin`
- `coolstory-mcp`

## Release Assets

The `Release Binaries` workflow uploads desktop packages and matching `.sha256` files for GitHub release consumers:

- `coolstory-desktop-win-x64.exe`
- `coolstory-desktop-win-x64.exe.sha256`
- `coolstory-desktop-macos-arm64.zip`
- `coolstory-desktop-macos-arm64.zip.sha256`
- `coolstory-desktop-linux-x64.AppImage`
- `coolstory-desktop-linux-x64.AppImage.sha256`
