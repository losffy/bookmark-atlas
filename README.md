# Bookmark Atlas

Bookmark Atlas is an Obsidian community plugin for importing Chrome and Firefox bookmarks into curated notes.

中文简介：Bookmark Atlas 是一个 Obsidian 社区插件，用于把 Chrome 和 Firefox 书签导入为结构化笔记，并提供预览、搜索和正文提取能力。

## Features

- Import Chrome/Firefox exported HTML bookmarks
- Import Chrome `Bookmarks` JSON
- Normalize and deduplicate bookmark records
- Generate one summary note per import
- Generate one detail note per bookmark
- Build a searchable side panel inside Obsidian
- Save local website previews into the vault
- Fall back to local preview cards when live screenshots are not usable
- Extract article正文 from readable pages with Defuddle and write it into bookmark detail notes

## Installation

### Install from a release package

1. Download `bookmark-atlas-<version>.zip` from [GitHub Releases](https://github.com/losffy/bookmark-atlas/releases).
2. Extract the archive.
3. Copy the extracted `bookmark-atlas` folder into your vault:
   `.obsidian/plugins/bookmark-atlas/`
4. Open Obsidian.
5. Turn off Restricted mode if needed.
6. Go to `Settings -> Community plugins`.
7. Enable `Bookmark Atlas`.

The plugin folder must contain at least:

- `manifest.json`
- `main.js`
- `styles.css`

### Manual install from source

1. Build the plugin:

```bash
npm install
npm run build
```

2. Copy these files into `.obsidian/plugins/bookmark-atlas/`:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

3. Enable the plugin in Obsidian Community Plugins.

### Build a portable release package

Run:

```bash
npm run release
```

This creates:

- `release/bookmark-atlas-0.1.0/`
- `release/bookmark-atlas-0.1.0.zip`

The packaged release contains:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`
- `README.md`
- `LICENSE`

### Repository

- Source: [losffy/bookmark-atlas](https://github.com/losffy/bookmark-atlas)
- Releases: [bookmark-atlas releases](https://github.com/losffy/bookmark-atlas/releases)

## Commands

- `Import Bookmarks`
- `Open Bookmark Atlas`
- `Rebuild Bookmark Summary Indexes`
- `Resync Imported Bookmarks`
- `Open Latest Bookmark Summary`

## Data layout

By default the plugin writes to:

- `Bookmarks/Atlas.md`
- `Bookmarks/Imports/`
- `Bookmarks/Items/`
- `Bookmarks/Assets/Screenshots/`
- `Bookmarks/Assets/Previews/`

## Development

```bash
npm install
npm run build
```

Useful scripts:

- `npm run dev`
- `npm run refresh-articles`
- `npm run smoke-test`
- `npm run refresh-previews`
- `npm run release`

### Recommended repository layout

For a public GitHub repository, keep the plugin root clean:

- `src/`
- `scripts/`
- `test-fixtures/`
- `manifest.json`
- `versions.json`
- `package.json`
- `README.md`
- `LICENSE`
- `.gitignore`

Do not commit:

- `data.json`
- vault-generated bookmark content
- local test vault data
- `release/`
- `node_modules/`

## Notes

- This plugin is desktop-only.
- Local screenshots and preview generation depend on desktop file access and local browser automation.
- Defuddle-based article extraction depends on remote HTML fetch and works best on article-like pages, blog posts, docs, and readable landing pages.
- `data.json` is user data and is not part of the release package.
