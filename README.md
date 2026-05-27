# Consistent Attachments for Obsidian

Consistent Attachments keeps your vault tidy by moving (or copying) note attachments when notes move between folders.

## Why this plugin

In many vaults, attachments drift away from their notes over time:
- notes are moved, attachments stay behind
- shared files are hard to handle safely
- folder structures become inconsistent

This plugin automates the common cases while preserving control for edge cases.

## Feature highlights

- Automatically process attachments on note folder moves.
- Support shared attachment handling with `skip`, `copy`, or `ask`.
- Choose destination behavior:
  - follow Obsidian default
  - note subfolder
  - same folder as note
  - fixed vault folder
- Avoid overwrites with automatic numeric conflict suffixes (`-1`, `-2`, ...).
- Scan for orphaned attachments with filter, sort, and cleanup actions.
- View a recent in-memory operation log.
- Run manual actions from command palette and file context menu.

## Installation

### Community plugins (recommended)

1. Open **Settings -> Community plugins**.
2. Select **Browse**.
3. Search for **Consistent Attachments**.
4. Install and enable the plugin.

### Manual installation

1. Download or build these files: `main.js`, `manifest.json`, `styles.css`.
2. Copy them into:
   - `<Vault>/.obsidian/plugins/consistent-attachments/`
3. Reload Obsidian and enable the plugin.

## Quick start

1. Enable **Auto-move** in plugin settings.
2. Select a target path mode that matches your vault layout.
3. Move a note to another folder.
4. Review moved/copied attachments and open the operation log if needed.

## Settings reference

- **Enable auto-move**: turn automatic processing on note move events on/off.
- **Shared attachment strategy**:
  - `skip`: keep shared files in place
  - `copy`: keep original, create note-local copy
  - `ask`: prompt for every shared file
- **Target path mode**:
  - `Follow Obsidian default`
  - `Subfolder of note` (configure subfolder name)
  - `Same folder as note`
  - `Fixed vault folder` (configure fixed path)
- **Delete empty attachment folders**: remove note-local attachment subfolders left empty after a move.
- **Excluded folders**: ignore note moves inside selected paths.
- **Show notices**: display operation summaries in Obsidian notices.
- **Operation log size**: max number of entries kept in memory.

## Commands

- `Move attachments for current note`
- `Find orphaned attachments`
- `Show recent operation log`
- `Toggle auto-move on/off`

Additionally, the file explorer context menu for markdown notes contains:
- `Move attachments for this note`

## Shared attachment behavior

When another note also references the same attachment, the plugin applies your configured strategy:
- **Skip**: do nothing to the shared file.
- **Copy**: create a copy at the destination path for the moved note.
- **Ask**: open a decision modal during the operation.

## Conflict handling

The plugin never overwrites existing files. If a destination filename already exists, it appends a numeric suffix:
- `image.png`
- `image-1.png`
- `image-2.png`

## Limitations and non-goals

- Link parsing is optimized for standard wiki and markdown links.
- The orphan scan uses Obsidian's link index and may miss references that are not indexed yet.
- The operation log is in-memory only and resets on reload.
- No cloud service is required; processing is local to your vault.

## Troubleshooting

- **Attachments are not moved**
  - verify **Enable auto-move** is on
  - check excluded folders
  - note-only renames in the same folder are intentionally ignored
- **Unexpected skips**
  - check shared attachment strategy
  - inspect the operation log modal
- **Conflicts occur often**
  - adjust target path mode to reduce filename collisions

## Privacy and security

- No telemetry is collected.
- No external network service is required for core functionality.
- Orphan cleanup moves files to the vault trash via Obsidian's trash API.
- File operations stay inside the Obsidian vault.

## Development

Requirements:
- Node.js 18+
- npm

Commands:

```bash
npm install
npm run build
npm run lint
npm run dev
```
