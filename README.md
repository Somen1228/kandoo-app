<p align="center">
  <img src="public/favicon.png" width="112" alt="Kandoo logo" />
</p>

<h1 align="center">Kandoo</h1>

<p align="center">
  A private, local-first Kanban board and notes workspace for macOS.
</p>

<p align="center">
  <strong>No account. No server. No internet connection required.</strong>
</p>

## Overview

Kandoo is a focused desktop workspace for organizing projects, tasks, and notes without sending your data to an online service. It combines flexible Kanban boards, rich-text notes, fast search, themes, and portable backups in a native macOS application.

The interface is built with React and Vite, packaged with Tauri, and persisted locally in SQLite. The current release supports Apple Silicon Macs.

## Features

- Multiple project boards with independent workflows.
- Custom cards with editable titles, colors, visibility, and ordering.
- Drag-and-drop cards and tasks using mouse, trackpad, touch, or keyboard.
- Rich-text tasks with bold, italic, underline, multiline content, and images.
- Completion state, duplicate, copy, move, reset, and delete actions.
- Rich-text notes with headings, lists, links, code blocks, images, colors, and alignment.
- Search across boards, tasks, card titles, and notes.
- Search filters such as `has:image` and `has:done`.
- Highlight and filter search modes with next/previous match navigation.
- Undo and redo history for board changes.
- Built-in and custom themes.
- JSON backup and restore with safe ID regeneration.
- XLSX export for Excel and Google Sheets.
- Local autosave with a recovery snapshot for abrupt app closure.
- Native macOS window controls integrated into the themed toolbar.

## Requirements

- Apple Silicon Mac (`arm64`)
- macOS 11.0 or later

Intel Macs are not included in the current build.

## Install

1. Open the [Kandoo releases page](https://github.com/Somen1228/kandoo-app/releases).
2. Download `Kandoo_1.0.0_aarch64.dmg` from the latest desktop release.
3. Open the DMG and move Kandoo into the Applications folder.
4. Launch Kandoo from Applications.

### macOS Security Notice

The current preview is ad-hoc signed and is not notarized with an Apple Developer ID. macOS may block the first launch. Open **System Settings > Privacy & Security**, locate the Kandoo warning, and choose **Open Anyway** only if the DMG came from this repository's official release page.

Future public builds should be Developer ID signed and notarized before being promoted from preview to stable.

## Getting Started

Kandoo creates an empty starter board on first launch.

1. Hover over the left edge or click the Kandoo logo to open the project sidebar.
2. Create or rename a project.
3. Add workflow cards such as To-do, In Progress, and Done.
4. Create tasks or switch to the Notes view for longer content.
5. Use the Export action regularly to create a portable JSON backup.

All changes are saved automatically on this Mac.

## Search

Search supports multiple terms and requires every term to match. It searches task text, task IDs, card titles, and note content.

| Query | Result |
| --- | --- |
| `design review` | Items containing both words |
| `has:image` | Tasks and notes with image attachments |
| `has:done` | Completed tasks |
| `review has:image` | Image-bearing items that also contain `review` |

Press `Enter` to move to the next result and `Shift + Enter` for the previous result.

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Focus search | `Cmd + K` or `/` |
| Quick-add task | `N` |
| Cycle theme | `T` |
| Undo | `Cmd + Z` |
| Redo | `Cmd + Shift + Z` |
| Bold, italic, underline | `Cmd + B`, `Cmd + I`, `Cmd + U` |
| Open Help | `Cmd + Shift + 1` |
| Close or cancel | `Esc` |

## Data and Privacy

Kandoo does not require authentication and does not connect to a Kandoo backend. The desktop workspace is stored at:

```text
~/Library/Application Support/com.kandoo.desktop/kandoo.db
```

Boards, cards, tasks, notes, and image attachments are stored as a workspace snapshot in SQLite. A short-lived local recovery snapshot protects edits made immediately before an unexpected close.

### Backups

Use **Export > JSON > All boards** for a complete, re-importable backup. XLSX exports are intended for reporting and flatten rich text and images, so they should not be treated as full backups.

Imported JSON boards are appended to the workspace. IDs are regenerated and duplicate titles receive an `(imported)` suffix, preventing imported data from overwriting existing boards.

## Development

### Prerequisites

- Node.js 18 or newer
- Rust stable toolchain
- Xcode Command Line Tools

### Install Dependencies

```bash
npm install
```

### Run the Browser Preview

```bash
npm run dev
```

The browser preview uses `localStorage`; the Tauri desktop runtime uses SQLite.

### Run the Native App

```bash
npm run desktop:dev
```

### Quality Checks

```bash
npm run build
npm run lint
```

### Build the macOS Bundle

```bash
npm run desktop:build
```

Artifacts are generated at:

```text
src-tauri/target/release/bundle/macos/Kandoo.app
src-tauri/target/release/bundle/dmg/Kandoo_1.0.0_aarch64.dmg
```

The checked-in configuration uses ad-hoc signing for local builds. Public stable distribution requires Apple Developer ID signing and notarization.

## Architecture

```text
React UI
  -> CardsContext
    -> boardStorage
      -> SQLite in Tauri
      -> localStorage in browser development
```

The application deliberately keeps UI components independent of cloud services. Optional paid cloud backup and synchronization can be added later through a separate sync coordinator without replacing local ownership of the workspace.

## Project Structure

```text
src/                     React application
  components/            Board, task, note, modal, and settings UI
  contexts/              Workspace and theme state
  services/              Local persistence boundary
  themes/                Built-in theme definitions
  utils/                 Search, import/export, editor, and task helpers
src-tauri/               Native macOS shell and SQLite migration
docs/                    Product and cloud-sync planning
public/                  Browser-facing static assets
```

## Migrating Existing Boards

Export all boards as JSON from an earlier Kandoo web installation, then select **Export > Import > Select File** in the desktop app. The imported boards are added to the existing local workspace.

## Roadmap

- Developer ID signing and notarization.
- Intel macOS build or universal binary.
- Optional paid cloud backup.
- Multi-device synchronization with explicit conflict handling.

See [Optional Cloud Sync Roadmap](docs/cloud-sync-roadmap.md) for the proposed architecture.

## Feedback and Issues

Report bugs and feature requests through [GitHub Issues](https://github.com/Somen1228/kandoo-app/issues).
