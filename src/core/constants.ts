import type { BookmarkAtlasData, BookmarkAtlasSettings } from "../types";

export const VIEW_TYPE_BOOKMARK_ATLAS = "bookmark-atlas-view";
export const MANAGED_BLOCK_START = "<!-- BOOKMARK-ATLAS:BEGIN MANAGED -->";
export const MANAGED_BLOCK_END = "<!-- BOOKMARK-ATLAS:END MANAGED -->";
export const IMPORT_DATA_BLOCK_START = "<!-- BOOKMARK-ATLAS:IMPORT-DATA:BEGIN";
export const IMPORT_DATA_BLOCK_END = "BOOKMARK-ATLAS:IMPORT-DATA:END -->";
export const USER_NOTES_HEADING = "## 用户备注";
export const PLUGIN_DATA_VERSION = 5;

export const DEFAULT_SETTINGS: BookmarkAtlasSettings = {
  rootFolder: "Bookmarks",
  enableRemoteEnrichment: true,
  enableLocalScreenshots: true,
  fetchTimeoutMs: 5000,
  screenshotTimeoutMs: 12000,
  maxFetchConcurrency: 4,
  atlasTitle: "Bookmark Atlas"
};

export const DEFAULT_DATA: BookmarkAtlasData = {
  version: PLUGIN_DATA_VERSION,
  records: [],
  duplicates: [],
  noteIndex: {},
  generatedNotes: []
};

export const CATEGORY_ORDER = [
  "开发",
  "设计",
  "AI",
  "学习",
  "资讯",
  "工具",
  "文档",
  "购物",
  "娱乐",
  "社交",
  "工作流",
  "未分类"
] as const;
