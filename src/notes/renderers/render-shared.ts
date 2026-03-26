import { stringifyYaml } from "obsidian";
import { IMPORT_DATA_BLOCK_END, IMPORT_DATA_BLOCK_START, MANAGED_BLOCK_END, MANAGED_BLOCK_START, USER_NOTES_HEADING } from "../../core/constants";
import { truncate } from "../../core/utils";
import type { BookmarkAtlasData, BookmarkRecord, GeneratedNoteSummary } from "../../types";

export const IMPORT_NOTE_TYPE = "import-summary";
export const DETAIL_NOTE_TYPE = "bookmark-detail";
export const ATLAS_NOTE_TYPE = "atlas-index";

export {
  IMPORT_DATA_BLOCK_END,
  IMPORT_DATA_BLOCK_START,
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  USER_NOTES_HEADING,
  stringifyYaml
};

export function groupByCategory(records: BookmarkRecord[]): Array<[string, BookmarkRecord[]]> {
  const groups = new Map<string, BookmarkRecord[]>();
  for (const record of records) {
    const key = record.category || "未分类";
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0], "zh-CN"));
}

export function buildDomainStats(records: BookmarkRecord[]): Map<string, number> {
  const stats = new Map<string, number>();
  for (const record of records) {
    const key = record.domain || "未知域名";
    stats.set(key, (stats.get(key) ?? 0) + 1);
  }
  return stats;
}

export function buildSourceStats(records: BookmarkRecord[]): Map<string, number> {
  const stats = new Map<string, number>();
  for (const record of records) {
    const key = `${record.sourceBrowser} / ${record.sourceFormat}`;
    stats.set(key, (stats.get(key) ?? 0) + 1);
  }
  return stats;
}

export function buildCategoryStats(records: BookmarkRecord[]): Array<[string, number]> {
  const stats = new Map<string, number>();
  for (const record of records) {
    const key = record.category || "未分类";
    stats.set(key, (stats.get(key) ?? 0) + 1);
  }
  return Array.from(stats.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"));
}

export function internalLinkMarkup(path: string, label: string, className = "bookmark-atlas-note-link"): string {
  return `<a href="${escapeHtmlAttribute(path)}" data-href="${escapeHtmlAttribute(path)}" class="internal-link ${className}">${escapeHtml(label)}</a>`;
}

export function statCard(label: string, value: string): string {
  return `<div class="bookmark-atlas-note-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(truncate(value, 72))}</strong></div>`;
}

export function formatAccessHint(value: BookmarkRecord["accessHint"]): string {
  switch (value) {
    case "direct":
      return "通常可直连";
    case "may-need-vpn":
      return "可能需要代理";
    default:
      return "暂未判断";
  }
}

export function formatAvailability(value: BookmarkRecord["availability"]): string {
  switch (value) {
    case "reachable":
      return "已验证可访问";
    case "failed":
      return "访问异常";
    case "timeout":
      return "访问超时";
    case "unsupported":
      return "不支持检测";
    default:
      return "未验证";
  }
}

export function formatAdRisk(value: BookmarkRecord["adRisk"]): string {
  switch (value) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    default:
      return "未知";
  }
}

export function formatPreviewSource(record: BookmarkRecord): string {
  switch (record.previewKind) {
    case "live-screenshot":
      return "真实网站截图";
    case "native-window-capture":
      return "用户配置浏览器窗口截屏";
    case "local-preview-card":
      return "本地站点预览卡";
    default:
      return "未标记";
  }
}

export function inlinePill(value: string): string {
  return `\`${escapeMarkdown(value)}\``;
}

export function toDetailRelativeAssetPath(assetPath: string): string {
  const normalized = assetPath.replace(/\\/g, "/");
  const marker = "Bookmarks/";
  const index = normalized.indexOf(marker);
  const scoped = index >= 0 ? normalized.slice(index + marker.length) : normalized;
  return `../${scoped}`;
}

export function escapeMarkdown(input: string): string {
  return input.replace(/[\\`*_{}\[\]()#+\-!|>]/g, "\\$&");
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(input: string): string {
  return escapeHtml(input);
}

export function buildAtlasFrontmatter(title: string, state: BookmarkAtlasData): string {
  return stringifyYaml({
    bookmark_atlas_type: ATLAS_NOTE_TYPE,
    title,
    generated_note_count: state.generatedNotes.length,
    record_count: state.records.length,
    latest_note_path: state.latestNotePath ?? ""
  }).trim();
}

export function buildImportFrontmatter(note: GeneratedNoteSummary): string {
  return stringifyYaml({
    bookmark_atlas_type: IMPORT_NOTE_TYPE,
    title: note.title,
    source_file_name: note.sourceFileName,
    source_browser: note.sourceBrowser,
    source_format: note.sourceFormat,
    imported_at: note.importedAt,
    record_count: note.recordCount,
    category_count: note.categoryCount
  }).trim();
}

export function buildDetailFrontmatter(record: BookmarkRecord): string {
  return stringifyYaml({
    bookmark_atlas_type: DETAIL_NOTE_TYPE,
    bookmark_id: record.id,
    title: record.title,
    url: record.url,
    domain: record.domain,
    category: record.category,
    tags: record.tags,
    created_at: record.createdAt ?? "",
    imported_at: record.importedAt
  }).trim();
}
