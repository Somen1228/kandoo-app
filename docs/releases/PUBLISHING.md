# Publishing Kandoo Desktop v0.1.0

This repository already contains an older `v1.0.0` tag from the web application. Use `desktop-v0.1.0` for the first desktop release.

## 1. Review the Release Metadata

Confirm these values agree:

- Release tag: `desktop-v0.1.0`
- Release title: `Kandoo Desktop v0.1.0 (Preview)`
- `package.json`: `0.1.0`
- `src-tauri/Cargo.toml`: `0.1.0`
- `src-tauri/tauri.conf.json`: `0.1.0`
- Asset: `Kandoo_0.1.0_aarch64.dmg`

## 2. Run Release Checks

From the repository root:

```bash
npm ci
npm run build
npm run desktop:build
codesign --verify --deep --strict --verbose=2 \
  src-tauri/target/release/bundle/macos/Kandoo.app
```

Launch the release build and test board creation, task editing, restart persistence, JSON export, and JSON import.

## 3. Generate a Checksum

```bash
cd src-tauri/target/release/bundle/dmg
shasum -a 256 Kandoo_0.1.0_aarch64.dmg \
  > Kandoo_0.1.0_aarch64.dmg.sha256
cd -
```

Upload both the DMG and checksum file to the release.

## 4. Commit and Push

Review the changes before committing:

```bash
git status
git diff --check
git diff --stat
```

Create the first desktop commit:

```bash
git add -A
git commit -m "feat: create local-first Kandoo macOS app"
git push origin main
```

## 5. Create and Push the Desktop Tag

Create an annotated tag on the commit that produced the tested DMG:

```bash
git tag -a desktop-v0.1.0 -m "Kandoo Desktop v0.1.0"
git push origin desktop-v0.1.0
```

Verify it points to the expected commit:

```bash
git show --no-patch desktop-v0.1.0
```

## 6. Draft the GitHub Release

1. Open `https://github.com/Somen1228/Kanban-board/releases`.
2. Select **Draft a new release**.
3. Choose the existing `desktop-v0.1.0` tag.
4. Set the title to `Kandoo Desktop v0.1.0 (Preview)`.
5. Paste the contents of `docs/releases/desktop-v0.1.0.md` into the description.
6. Attach `Kandoo_0.1.0_aarch64.dmg`.
7. Attach `Kandoo_0.1.0_aarch64.dmg.sha256`.
8. Select **Set as a pre-release** because this build is not Developer ID signed or notarized.
9. Save it as a draft and check every field and asset.
10. Select **Publish release** when the draft is complete.

GitHub automatically adds source ZIP and tar archives. Those archives are source code, not macOS installers; users should install from the DMG asset.

## 7. Verify the Published Release

1. Download the published DMG and checksum from GitHub.
2. Verify the checksum:

```bash
shasum -a 256 -c Kandoo_0.1.0_aarch64.dmg.sha256
```

3. Install the downloaded copy on a test Mac or a clean macOS user account.
4. Confirm the release page is marked as a pre-release.
5. Confirm the README installation link opens the correct release page.

Do not move the tag after publishing. Create a new version and tag for any corrected binary.
