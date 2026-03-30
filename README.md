# Bookmark Atlas

Bookmark Atlas is an Obsidian community plugin for importing Chrome and Firefox bookmarks into curated notes.

中文简介：Bookmark Atlas 是一个 Obsidian 社区插件，用于把 Chrome 和 Firefox 书签导入为结构化笔记，并提供预览、搜索和正文提取能力。

## 中文说明

### 主要功能

- 导入 Chrome / Firefox 导出的 HTML 书签
- 导入 Chrome `Bookmarks` JSON
- 规范化并去重书签记录
- 每次导入生成一份汇总笔记
- 为每条书签生成单独的详情笔记
- 在 Obsidian 内构建可搜索的侧边面板
- 把网页本地预览图保存到仓库
- 当实时截图不可用时回退到本地预览卡片
- 使用 Defuddle 提取可读页面正文并写入书签详情笔记

### 安装方法

#### 从 Release 安装

1. 从 [GitHub Releases](https://github.com/losffy/bookmark-atlas/releases) 下载 `bookmark-atlas-<version>.zip`。
2. 解压压缩包。
3. 将解压后的 `bookmark-atlas` 文件夹复制到你的仓库插件目录：
   `.obsidian/plugins/bookmark-atlas/`
4. 打开 Obsidian。
5. 如果需要，关闭 Restricted mode。
6. 进入 `Settings -> Community plugins`。
7. 启用 `Bookmark Atlas`。

插件目录中至少应包含：

- `manifest.json`
- `main.js`
- `styles.css`

#### 从源码手动安装

1. 在项目目录执行：

```bash
npm install
npm run build
```

2. 将这些文件复制到 `.obsidian/plugins/bookmark-atlas/`：

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

3. 在 Obsidian 的 Community Plugins 中启用插件。

### 默认数据目录

默认情况下，插件会写入：

- `Bookmarks/Atlas.md`
- `Bookmarks/Imports/`
- `Bookmarks/Items/`
- `Bookmarks/Assets/Screenshots/`
- `Bookmarks/Assets/Previews/`

### 命令说明

- `Import Bookmarks`
  导入浏览器书签。
- `Open Bookmark Atlas`
  打开 Bookmark Atlas 侧边面板。
- `Rebuild Bookmark Summary Indexes`
  重建书签汇总索引。
- `Resync Imported Bookmarks`
  重新同步已导入的书签。
- `Open Latest Bookmark Summary`
  打开最近一次导入生成的汇总笔记。

### 开发说明

在项目目录执行：

```bash
npm install
npm run build
```

常用脚本：

- `npm run dev`
- `npm run refresh-articles`
- `npm run smoke-test`
- `npm run refresh-previews`
- `npm run release`

如果你要维护一个公开仓库，建议保留这些核心内容：

- `src/`
- `scripts/`
- `test-fixtures/`
- `manifest.json`
- `versions.json`
- `package.json`
- `README.md`
- `LICENSE`
- `.gitignore`

不建议提交：

- `data.json`
- 仓库中生成的书签数据
- 本地测试 vault 数据
- `release/`
- `node_modules/`

### 备注

- 这是一个仅桌面端可用的插件。
- 本地截图和预览生成依赖桌面文件访问与本地浏览器自动化能力。
- 基于 Defuddle 的正文提取依赖远程 HTML 获取，更适合文章页、博客、文档和可读性较高的落地页。
- `data.json` 属于用户数据，不应作为发布包的一部分。

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
