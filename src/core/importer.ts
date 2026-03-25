import type { BookmarkAtlasSettings, BookmarkRecord, DuplicateGroup, ImportIssue, ImportResult, ParsedBookmarkItem } from "../types";
import { buildTemplateDescription, categorizeBookmark } from "./categorizer";
import { enrichRecords } from "./enrichment";
import { applyDerivedSignals } from "./site-signals";
import { parseBookmarkPayload } from "./parsers";
import { cleanText, hashString, normalizeForCompare, normalizeUrl, slugify, tokenOverlap, uniqueStrings } from "./utils";

export class BookmarkImporter {
  constructor(private readonly settings: BookmarkAtlasSettings) {}

  async preview(fileName: string, content: string): Promise<ImportResult> {
    return this.buildImportResult(fileName, content, false);
  }

  async import(fileName: string, content: string): Promise<ImportResult> {
    return this.buildImportResult(fileName, content, true);
  }

  private async buildImportResult(fileName: string, content: string, withEnrichment: boolean): Promise<ImportResult> {
    const parsed = parseBookmarkPayload(fileName, content);
    const issues = [...parsed.issues];
    const importedAt = new Date().toISOString();

    const normalizedRecords = parsed.items.map((item) => this.buildRecord(item, parsed.sourceBrowser, parsed.sourceFormat, importedAt));
    const { canonicalRecords, duplicates } = buildDuplicateState(normalizedRecords, issues);
    const records = withEnrichment ? await enrichRecords(canonicalRecords, this.settings, issues) : canonicalRecords;

    return {
      sourceFileName: fileName,
      sourceBrowser: parsed.sourceBrowser,
      sourceFormat: parsed.sourceFormat,
      records: records.sort((left, right) => left.category.localeCompare(right.category, "zh-CN") || left.title.localeCompare(right.title, "zh-CN")),
      duplicates,
      errors: issues,
      stats: {
        totalParsed: normalizedRecords.length,
        uniqueRecords: records.length,
        strongDuplicateGroups: duplicates.filter((group) => group.kind === "strong").length,
        weakDuplicateGroups: duplicates.filter((group) => group.kind === "weak").length,
        errorCount: issues.filter((issue) => issue.level === "error").length,
        warningCount: issues.filter((issue) => issue.level === "warning").length
      },
      preparedAt: importedAt
    };
  }

  private buildRecord(item: ParsedBookmarkItem, sourceBrowser: ImportResult["sourceBrowser"], sourceFormat: ImportResult["sourceFormat"], importedAt: string): BookmarkRecord {
    const rawTitle = cleanText(item.title) || cleanText(item.url) || "Untitled";
    const normalized = normalizeUrl(item.url);
    const categoryResult = categorizeBookmark({
      title: rawTitle,
      url: item.url,
      domain: normalized.domain,
      folderPath: item.folderPath
    });
    const qualityFlags = uniqueStrings([
      ...normalized.qualityFlags,
      rawTitle ? "" : "missing-title"
    ]);
    const idSource = `${normalized.normalizedUrl || item.url}|${rawTitle}|${item.folderPath.join("/")}`;
    const id = hashString(idSource);
    const dedupeKey = normalized.normalizedUrl || `invalid:${hashString(item.url || rawTitle)}`;

    const record: BookmarkRecord = {
      id,
      sourceBrowser,
      sourceFormat,
      title: rawTitle,
      url: cleanText(item.url),
      normalizedUrl: normalized.normalizedUrl,
      domain: normalized.domain,
      folderPath: item.folderPath.map((segment) => cleanText(segment)).filter(Boolean),
      category: categoryResult.category,
      tags: categoryResult.tags,
      description: "",
      createdAt: item.createdAt,
      importedAt,
      dedupeKey,
      qualityFlags,
      fetchStatus: "pending",
      favicon: item.icon || normalized.favicon
    };

    record.description = buildTemplateDescription(record);
    return applyDerivedSignals(record);
  }
}

function buildDuplicateState(records: BookmarkRecord[], issues: ImportIssue[]): { canonicalRecords: BookmarkRecord[]; duplicates: DuplicateGroup[] } {
  const duplicates: DuplicateGroup[] = [];
  const groups = new Map<string, BookmarkRecord[]>();
  for (const record of records) {
    const group = groups.get(record.dedupeKey) ?? [];
    group.push(record);
    groups.set(record.dedupeKey, group);
  }

  const canonicalRecords: BookmarkRecord[] = [];
  for (const [dedupeKey, group] of groups.entries()) {
    const sorted = [...group].sort((left, right) => right.title.length - left.title.length);
    const canonical = sorted[0];
    canonicalRecords.push(canonical);

    if (group.length > 1) {
      duplicates.push({
        key: dedupeKey,
        kind: "strong",
        dedupeKey,
        recordIds: group.map((record) => record.id),
        canonicalRecordId: canonical.id
      });
      issues.push({
        level: "warning",
        code: "strong-duplicate",
        message: `检测到 ${group.length} 条重复书签：${canonical.title}`,
        recordId: canonical.id,
        dedupeKey
      });
      canonical.qualityFlags = uniqueStrings([...canonical.qualityFlags, "has-duplicates"]);
    }
  }

  const weakGroups = new Map<string, BookmarkRecord[]>();
  for (const record of canonicalRecords) {
    if (!record.domain || !record.normalizedUrl) {
      continue;
    }
    try {
      const url = new URL(record.normalizedUrl);
      const weakKey = `${record.domain}${url.pathname.toLowerCase().replace(/\/+$/, "")}`;
      const group = weakGroups.get(weakKey) ?? [];
      group.push(record);
      weakGroups.set(weakKey, group);
    } catch {
      continue;
    }
  }

  for (const [weakKey, group] of weakGroups.entries()) {
    if (group.length < 2) {
      continue;
    }
    const similar = group.filter((candidate, index) => group.some((other, otherIndex) => index !== otherIndex && tokenOverlap(candidate.title, other.title) >= 0.45));
    if (similar.length < 2) {
      continue;
    }
    const canonical = [...similar].sort((left, right) => normalizeForCompare(left.title).length - normalizeForCompare(right.title).length)[0];
    duplicates.push({
      key: `weak:${slugify(weakKey)}`,
      kind: "weak",
      dedupeKey: canonical.dedupeKey,
      recordIds: similar.map((record) => record.id),
      canonicalRecordId: canonical.id
    });
    for (const record of similar) {
      record.qualityFlags = uniqueStrings([...record.qualityFlags, "suspected-duplicate"]);
    }
  }

  return { canonicalRecords, duplicates };
}
