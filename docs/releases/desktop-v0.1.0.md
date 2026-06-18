# Kandoo Desktop v0.1.0

Kandoo is now available as a private, local-first macOS desktop application. This release replaces the earlier account-based web architecture with an offline workspace backed by SQLite.

## Highlights

- Native Apple Silicon macOS application built with Tauri.
- No account, backend, or internet connection required.
- Local SQLite persistence with autosave and recovery protection.
- Multiple Kanban boards with customizable cards and drag-and-drop tasks.
- Rich-text tasks and notes with image attachments and code blocks.
- Cross-board search with `has:image` and `has:done` filters.
- Undo and redo history, themes, and keyboard shortcuts.
- Complete JSON backup and restore.
- XLSX export for Excel and Google Sheets.
- Native macOS traffic lights integrated into the Kandoo toolbar.

## Download

Download and open:

`Kandoo_0.1.0_aarch64.dmg`

This build supports Apple Silicon Macs running macOS 11.0 or later.

## Install

1. Open the DMG.
2. Move Kandoo into Applications.
3. Launch Kandoo from Applications.

## Privacy

Kandoo stores its workspace only on the Mac at:

`~/Library/Application Support/com.kandoo.desktop/kandoo.db`

No Kandoo account or online backend is used. Use the built-in JSON export for portable backups.

## Preview Limitation

This build is ad-hoc signed and is not Apple-notarized. macOS may require approval from **System Settings > Privacy & Security > Open Anyway** on first launch. Only approve a copy obtained from this repository's official release page.

Because of this signing limitation, mark this GitHub release as a **pre-release**. Promote future Developer ID signed and notarized builds to stable releases.

## Known Limitations

- Apple Silicon only; no Intel or universal build yet.
- No cloud backup or multi-device synchronization.
- The Notes experience remains a beta feature.

## Verify the Download

Generate a checksum before publishing:

```bash
shasum -a 256 Kandoo_0.1.0_aarch64.dmg
```

Publish the resulting SHA-256 value alongside the DMG.
