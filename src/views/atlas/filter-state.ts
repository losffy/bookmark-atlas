import type { BookmarkRecord, GeneratedNoteSummary } from "../../types";

export type AtlasLayoutMode = "wide" | "compact" | "narrow";
export type AtlasNoteScope = "all" | "latest";

export interface AtlasFilterState {
  searchTerm: string;
  selectedCategory: string;
  selectedSource: string;
  selectedNoteScope: AtlasNoteScope;
}

export interface AtlasDerivedState {
  scopedRecords: BookmarkRecord[];
  filteredRecords: BookmarkRecord[];
  categories: string[];
  sources: string[];
  categoryCards: Array<[string, number]>;
  selectedCategory: string;
  selectedSource: string;
  scopeLabel: string;
}

export function deriveAtlasState(
  records: BookmarkRecord[],
  latestNote: GeneratedNoteSummary | null,
  filterState: AtlasFilterState
): AtlasDerivedState {
  const scopedRecords = filterState.selectedNoteScope === "latest" && latestNote
    ? records.filter((record) => resolveSummaryPath(record) === latestNote.path)
    : records;
  const categories = ["全部", ...Array.from(new Set(scopedRecords.map((record) => record.category))).sort((left, right) => left.localeCompare(right, "zh-CN"))];
  const sources = ["全部", ...Array.from(new Set(scopedRecords.map((record) => record.sourceBrowser)))];
  const selectedCategory = categories.includes(filterState.selectedCategory) ? filterState.selectedCategory : "全部";
  const selectedSource = sources.includes(filterState.selectedSource) ? filterState.selectedSource : "全部";
  const filteredRecords = scopedRecords.filter((record) =>
    matchesRecord(record, filterState.searchTerm, selectedCategory, selectedSource)
  );

  return {
    scopedRecords,
    filteredRecords,
    categories,
    sources,
    categoryCards: buildCategoryCards(scopedRecords),
    selectedCategory,
    selectedSource,
    scopeLabel: filterState.selectedNoteScope === "latest" && latestNote ? `只看「${latestNote.title}」` : "查看全部汇总"
  };
}

function buildCategoryCards(records: BookmarkRecord[]): Array<[string, number]> {
  const stats = new Map<string, number>();
  for (const record of records) {
    const key = record.category || "未分类";
    stats.set(key, (stats.get(key) ?? 0) + 1);
  }
  return Array.from(stats.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 10);
}

function matchesRecord(record: BookmarkRecord, searchTerm: string, selectedCategory: string, selectedSource: string): boolean {
  if (selectedCategory !== "全部" && record.category !== selectedCategory) {
    return false;
  }
  if (selectedSource !== "全部" && record.sourceBrowser !== selectedSource) {
    return false;
  }
  if (!searchTerm.trim()) {
    return true;
  }
  const haystack = [record.title, record.url, record.domain, record.category, record.description, record.tags.join(" "), record.folderPath.join(" ")]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm.trim().toLowerCase());
}

function resolveSummaryPath(record: BookmarkRecord): string | undefined {
  return record.summaryNotePath ?? (record.notePath?.includes("/Imports/") ? record.notePath : undefined);
}
