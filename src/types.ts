export type SourceBrowser = "chrome" | "firefox" | "unknown";
export type SourceFormat = "netscape-html" | "chrome-json";
export type FetchStatus = "pending" | "skipped" | "success" | "failed" | "timeout" | "unsupported";
export type AccessHint = "unknown" | "direct" | "may-need-vpn";
export type AvailabilityHint = "unchecked" | "reachable" | "failed" | "timeout" | "unsupported";
export type AdRiskLevel = "unknown" | "low" | "medium" | "high";
export type PreviewKind = "live-screenshot" | "native-window-capture" | "local-preview-card";
export type PreviewStatus = "ready" | "fallback";

export interface BookmarkRecord {
  id: string;
  sourceBrowser: SourceBrowser;
  sourceFormat: SourceFormat;
  title: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  folderPath: string[];
  category: string;
  tags: string[];
  description: string;
  articleExcerpt?: string;
  articleMarkdown?: string;
  articleWordCount?: number;
  articleAuthor?: string;
  articlePublishedAt?: string;
  articleSite?: string;
  createdAt?: string;
  importedAt: string;
  dedupeKey: string;
  qualityFlags: string[];
  fetchStatus: FetchStatus;
  favicon?: string;
  siteName?: string;
  screenshotPath?: string;
  previewAssetPath?: string;
  previewKind?: PreviewKind;
  previewStatus?: PreviewStatus;
  accessHint?: AccessHint;
  availability?: AvailabilityHint;
  adRisk?: AdRiskLevel;
  isLikelyDead?: boolean;
  notePath?: string;
  detailNotePath?: string;
  summaryNotePath?: string;
}

export interface DuplicateGroup {
  key: string;
  kind: "strong" | "weak";
  dedupeKey: string;
  recordIds: string[];
  canonicalRecordId: string;
}

export interface ImportIssue {
  level: "warning" | "error";
  code: string;
  message: string;
  recordId?: string;
  dedupeKey?: string;
}

export interface ImportStats {
  totalParsed: number;
  uniqueRecords: number;
  strongDuplicateGroups: number;
  weakDuplicateGroups: number;
  errorCount: number;
  warningCount: number;
}

export interface ImportResult {
  sourceFileName: string;
  sourceBrowser: SourceBrowser;
  sourceFormat: SourceFormat;
  records: BookmarkRecord[];
  duplicates: DuplicateGroup[];
  errors: ImportIssue[];
  stats: ImportStats;
  preparedAt: string;
}

export interface BookmarkAtlasSettings {
  rootFolder: string;
  enableRemoteEnrichment: boolean;
  enableLocalScreenshots: boolean;
  fetchTimeoutMs: number;
  screenshotTimeoutMs: number;
  maxFetchConcurrency: number;
  atlasTitle: string;
}

export interface GeneratedNoteSummary {
  path: string;
  title: string;
  sourceFileName: string;
  sourceBrowser: SourceBrowser;
  sourceFormat: SourceFormat;
  importedAt: string;
  recordCount: number;
  categoryCount: number;
}

export interface BookmarkAtlasData {
  version: number;
  records: BookmarkRecord[];
  duplicates: DuplicateGroup[];
  noteIndex: Record<string, string>;
  generatedNotes: GeneratedNoteSummary[];
  lastImportAt?: string;
  lastImportFileName?: string;
  latestNotePath?: string;
}

export interface ParsedBookmarkItem {
  title: string;
  url: string;
  folderPath: string[];
  createdAt?: string;
  icon?: string;
}
