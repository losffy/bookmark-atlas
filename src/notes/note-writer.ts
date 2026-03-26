import { App, TFile, normalizePath, parseYaml } from "obsidian";
import { IMPORT_DATA_BLOCK_END, IMPORT_DATA_BLOCK_START, PLUGIN_DATA_VERSION, USER_NOTES_HEADING } from "../core/constants";
import { captureLocalScreenshots } from "../core/local-screenshot";
import { applyDerivedSignals } from "../core/site-signals";
import { cleanText, hashString, slugify } from "../core/utils";
import type { BookmarkAtlasData, BookmarkAtlasSettings, BookmarkRecord, GeneratedNoteSummary, ImportResult } from "../types";
import { renderAtlasNote } from "./renderers/atlas-note-renderer";
import { renderDetailNote } from "./renderers/detail-note-renderer";
import { renderImportNote } from "./renderers/import-note-renderer";
import { IMPORT_NOTE_TYPE } from "./renderers/render-shared";

export class BookmarkNoteWriter {
  constructor(
    private readonly app: App,
    private readonly settings: BookmarkAtlasSettings,
    private readonly pluginDir: string
  ) {}

  async applyImport(state: BookmarkAtlasData, result: ImportResult): Promise<BookmarkAtlasData> {
    await this.ensureFolder(this.settings.rootFolder);
    await this.ensureFolder(`${this.settings.rootFolder}/Imports`);
    await this.ensureFolder(`${this.settings.rootFolder}/Items`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Screenshots`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Previews`);

    const summaryNote = await this.createGeneratedNote(result);
    const existingByKey = new Map(state.records.map((record) => [record.dedupeKey, record]));
    const capturedRecords = await captureLocalScreenshots(
      this.app,
      this.pluginDir,
      this.settings,
      result.records.map((record) => this.mergeRecordForImport(existingByKey.get(record.dedupeKey), record, summaryNote.path))
    );
    const records = capturedRecords;

    for (const record of records) {
      await this.writeDetailNote(record, summaryNote);
    }
    await this.writeImportNote(summaryNote, records);

    const mergedRecords = new Map(state.records.map((record) => [record.dedupeKey, record]));
    const noteIndex = { ...state.noteIndex };
    for (const record of records) {
      mergedRecords.set(record.dedupeKey, record);
      if (record.detailNotePath) {
        noteIndex[record.dedupeKey] = record.detailNotePath;
      }
    }

    const generatedNotes = [...state.generatedNotes.filter((entry) => entry.path !== summaryNote.path), summaryNote]
      .sort((left, right) => right.importedAt.localeCompare(left.importedAt));

    const nextState = buildSyncedState({
      ...state,
      version: PLUGIN_DATA_VERSION,
      duplicates: mergeDuplicates(Array.from(mergedRecords.values()), state.duplicates, result),
      generatedNotes,
      noteIndex,
      lastImportAt: result.preparedAt,
      lastImportFileName: result.sourceFileName,
      latestNotePath: summaryNote.path
    }, Array.from(mergedRecords.values()));

    await this.writeAtlasNote(nextState);
    return nextState;
  }

  async rebuildIndexesFromState(state: BookmarkAtlasData): Promise<void> {
    await this.ensureFolder(this.settings.rootFolder);
    await this.ensureFolder(`${this.settings.rootFolder}/Imports`);
    await this.ensureFolder(`${this.settings.rootFolder}/Items`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Screenshots`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Previews`);

    const normalizedRecords = await captureLocalScreenshots(
      this.app,
      this.pluginDir,
      this.settings,
      state.records.map((record) => hydrateRecordPaths(record, this.settings.rootFolder))
    );
    const normalizedState = buildSyncedState(state, normalizedRecords);
    const notesByPath = new Map(normalizedState.generatedNotes.map((note) => [note.path, note]));

    for (const note of normalizedState.generatedNotes) {
      const summaryRecords = normalizedState.records.filter((record) => resolveSummaryPath(record) === note.path);
      if (summaryRecords.length === 0) {
        continue;
      }
      for (const record of summaryRecords) {
        await this.writeDetailNote(record, note);
      }
      await this.writeImportNote(note, summaryRecords);
    }

    for (const record of normalizedState.records) {
      if (!record.summaryNotePath) {
        const fallback = normalizedState.latestNotePath ? notesByPath.get(normalizedState.latestNotePath) : undefined;
        if (fallback) {
          const hydrated = hydrateRecordPaths(record, this.settings.rootFolder, fallback.path);
          await this.writeDetailNote(hydrated, fallback);
        }
      }
    }

    await this.writeAtlasNote(normalizedState);
  }

  async resyncManagedNotes(state: BookmarkAtlasData): Promise<BookmarkAtlasData> {
    const normalizedRecords = await captureLocalScreenshots(
      this.app,
      this.pluginDir,
      this.settings,
      state.records.map((record) => hydrateRecordPaths(record, this.settings.rootFolder))
    );

    const normalizedState = buildSyncedState(state, normalizedRecords);
    await this.rebuildIndexesFromState(normalizedState);
    return normalizedState;
  }

  async regenerateDetailNotes(state: BookmarkAtlasData): Promise<BookmarkAtlasData> {
    await this.ensureFolder(this.settings.rootFolder);
    await this.ensureFolder(`${this.settings.rootFolder}/Items`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Screenshots`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Previews`);

    const normalizedRecords = await captureLocalScreenshots(
      this.app,
      this.pluginDir,
      this.settings,
      state.records.map((record) => hydrateRecordPaths(record, this.settings.rootFolder))
    );
    const normalizedState = buildSyncedState(state, normalizedRecords);
    const notesByPath = new Map(normalizedState.generatedNotes.map((note) => [note.path, note]));

    for (const record of normalizedState.records) {
      const summaryNote = record.summaryNotePath
        ? notesByPath.get(record.summaryNotePath)
        : undefined;
      const fallbackNote = summaryNote ?? (normalizedState.latestNotePath ? notesByPath.get(normalizedState.latestNotePath) : undefined) ?? normalizedState.generatedNotes[0];
      if (!fallbackNote) {
        continue;
      }
      await this.writeDetailNote(record, fallbackNote);
    }

    return normalizedState;
  }

  async rewriteManagedNotesFromState(state: BookmarkAtlasData): Promise<BookmarkAtlasData> {
    await this.ensureFolder(this.settings.rootFolder);
    await this.ensureFolder(`${this.settings.rootFolder}/Imports`);
    await this.ensureFolder(`${this.settings.rootFolder}/Items`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Screenshots`);
    await this.ensureFolder(`${this.settings.rootFolder}/Assets/Previews`);

    const normalizedRecords = state.records.map((record) => hydrateRecordPaths(record, this.settings.rootFolder));
    const normalizedState = buildSyncedState(state, normalizedRecords);
    const notesByPath = new Map(normalizedState.generatedNotes.map((note) => [note.path, note]));

    for (const note of normalizedState.generatedNotes) {
      const summaryRecords = normalizedState.records.filter((record) => resolveSummaryPath(record) === note.path);
      if (summaryRecords.length === 0) {
        continue;
      }
      for (const record of summaryRecords) {
        await this.writeDetailNote(record, note);
      }
      await this.writeImportNote(note, summaryRecords);
    }

    for (const record of normalizedState.records) {
      if (!record.summaryNotePath) {
        const fallback = normalizedState.latestNotePath ? notesByPath.get(normalizedState.latestNotePath) : undefined;
        if (fallback) {
          await this.writeDetailNote(record, fallback);
        }
      }
    }

    await this.writeAtlasNote(normalizedState);
    return normalizedState;
  }

  async rebuildDataFromVault(): Promise<BookmarkAtlasData> {
    const prefix = normalizePath(`${this.settings.rootFolder}/Imports/`);
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(prefix));

    const records: BookmarkRecord[] = [];
    const noteIndex: Record<string, string> = {};
    const generatedNotes: GeneratedNoteSummary[] = [];

    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const parsed = parseImportNote(content, file.path);
      if (!parsed) {
        continue;
      }
      generatedNotes.push(parsed.note);
      for (const record of parsed.records) {
        const hydrated = hydrateRecordPaths(record, this.settings.rootFolder, file.path);
        records.push(hydrated);
        if (hydrated.detailNotePath) {
          noteIndex[hydrated.dedupeKey] = hydrated.detailNotePath;
        }
      }
    }

    generatedNotes.sort((left, right) => right.importedAt.localeCompare(left.importedAt));

    return {
      version: PLUGIN_DATA_VERSION,
      records: sortRecords(records),
      duplicates: [],
      noteIndex,
      generatedNotes,
      lastImportAt: generatedNotes[0]?.importedAt,
      lastImportFileName: generatedNotes[0]?.sourceFileName,
      latestNotePath: generatedNotes[0]?.path
    };
  }

  private async createGeneratedNote(result: ImportResult): Promise<GeneratedNoteSummary> {
    const title = buildImportTitle(result);
    const path = await this.allocateImportNotePath(result.preparedAt, title);
    const categoryCount = new Set(result.records.map((record) => record.category)).size;

    return {
      path,
      title,
      sourceFileName: result.sourceFileName,
      sourceBrowser: result.sourceBrowser,
      sourceFormat: result.sourceFormat,
      importedAt: result.preparedAt,
      recordCount: result.records.length,
      categoryCount
    };
  }

  private async allocateImportNotePath(importedAt: string, title: string): Promise<string> {
    const stamp = importedAt.slice(0, 16).replace(/[:T]/g, "-");
    const basePath = normalizePath(`${this.settings.rootFolder}/Imports/${stamp}-${slugify(title)}.md`);
    if (!this.app.vault.getAbstractFileByPath(basePath)) {
      return basePath;
    }

    let suffix = 2;
    while (true) {
      const candidate = normalizePath(`${this.settings.rootFolder}/Imports/${stamp}-${slugify(title)}-${suffix}.md`);
      if (!this.app.vault.getAbstractFileByPath(candidate)) {
        return candidate;
      }
      suffix += 1;
    }
  }

  private mergeRecordForImport(existing: BookmarkRecord | undefined, record: BookmarkRecord, summaryNotePath: string): BookmarkRecord {
    const existingHydrated = existing ? hydrateRecordPaths(existing, this.settings.rootFolder) : undefined;
    const detailNotePath = existingHydrated?.detailNotePath ?? buildDefaultDetailNotePath(this.settings.rootFolder, record);

    return applyDerivedSignals({
      ...existingHydrated,
      ...record,
      notePath: detailNotePath,
      detailNotePath,
      summaryNotePath
    });
  }

  private async writeImportNote(note: GeneratedNoteSummary, records: BookmarkRecord[]): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(note.path);
    const existingContent = existing instanceof TFile ? await this.app.vault.cachedRead(existing) : "";
    const userNotes = extractUserNotes(existingContent);
    const content = renderImportNote(note, records, userNotes);

    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(note.path, content);
    }
  }

  private async writeDetailNote(record: BookmarkRecord, summaryNote: GeneratedNoteSummary): Promise<void> {
    const detailPath = record.detailNotePath ?? record.notePath ?? buildDefaultDetailNotePath(this.settings.rootFolder, record);
    const existing = this.app.vault.getAbstractFileByPath(detailPath);
    const existingContent = existing instanceof TFile ? await this.app.vault.cachedRead(existing) : "";
    const userNotes = extractUserNotes(existingContent);
    const content = renderDetailNote({
      ...record,
      notePath: detailPath,
      detailNotePath: detailPath,
      summaryNotePath: summaryNote.path
    }, summaryNote, userNotes);

    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(detailPath, content);
    }
  }

  private async writeAtlasNote(state: BookmarkAtlasData): Promise<void> {
    const path = normalizePath(`${this.settings.rootFolder}/Atlas.md`);
    const content = renderAtlasNote(this.settings.atlasTitle, state);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(path, content);
    }
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (normalized === ".") {
      return;
    }
    if (this.app.vault.getAbstractFileByPath(normalized)) {
      return;
    }
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}

function sortRecords(records: BookmarkRecord[]): BookmarkRecord[] {
  return normalizeManualOrder([...records].sort(compareRecords));
}

function buildImportTitle(result: ImportResult): string {
  const baseName = result.sourceFileName.replace(/\.[^.]+$/, "");
  const stamp = result.preparedAt.slice(0, 10);
  return `书签整理 ${stamp} · ${baseName}`;
}

function buildDefaultDetailNotePath(rootFolder: string, record: BookmarkRecord): string {
  const shortId = hashString(record.dedupeKey).slice(0, 8);
  return normalizePath(`${rootFolder}/Items/${slugify(record.title)}--${shortId}.md`);
}

function hydrateRecordPaths(record: BookmarkRecord, rootFolder: string, summaryFallback?: string): BookmarkRecord {
  const detailNotePath = record.detailNotePath
    ?? (record.notePath && !isImportNotePath(record.notePath) ? record.notePath : undefined)
    ?? buildDefaultDetailNotePath(rootFolder, record);
  const summaryNotePath = record.summaryNotePath
    ?? (record.notePath && isImportNotePath(record.notePath) ? record.notePath : undefined)
    ?? summaryFallback;

  return applyDerivedSignals({
    ...record,
    notePath: detailNotePath,
    detailNotePath,
    summaryNotePath
  });
}

function buildSyncedState(state: BookmarkAtlasData, records: BookmarkRecord[]): BookmarkAtlasData {
  const sortedRecords = sortRecords(records);
  return {
    ...state,
    version: PLUGIN_DATA_VERSION,
    records: sortedRecords,
    generatedNotes: syncGeneratedNotes(sortedRecords, state.generatedNotes),
    noteIndex: Object.fromEntries(sortedRecords.map((record) => [record.dedupeKey, record.detailNotePath ?? record.notePath ?? ""]).filter((entry) => entry[1]))
  };
}

function syncGeneratedNotes(records: BookmarkRecord[], generatedNotes: GeneratedNoteSummary[]): GeneratedNoteSummary[] {
  const recordsByPath = new Map<string, BookmarkRecord[]>();
  for (const record of records) {
    const summaryPath = resolveSummaryPath(record);
    if (!summaryPath) {
      continue;
    }
    const list = recordsByPath.get(summaryPath) ?? [];
    list.push(record);
    recordsByPath.set(summaryPath, list);
  }

  return [...generatedNotes]
    .map((note) => {
      const summaryRecords = recordsByPath.get(note.path);
      if (!summaryRecords || summaryRecords.length === 0) {
        return note;
      }
      return {
        ...note,
        recordCount: summaryRecords.length,
        categoryCount: new Set(summaryRecords.map((record) => record.category || "未分类")).size
      };
    })
    .sort((left, right) => right.importedAt.localeCompare(left.importedAt));
}

function normalizeManualOrder(records: BookmarkRecord[]): BookmarkRecord[] {
  return records.map((record, index) => (
    record.manualOrder === index
      ? record
      : { ...record, manualOrder: index }
  ));
}

function compareRecords(left: BookmarkRecord, right: BookmarkRecord): number {
  const leftOrder = left.manualOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.manualOrder ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder
    || left.category.localeCompare(right.category, "zh-CN")
    || left.title.localeCompare(right.title, "zh-CN");
}

function resolveSummaryPath(record: BookmarkRecord): string | undefined {
  return record.summaryNotePath ?? (record.notePath && isImportNotePath(record.notePath) ? record.notePath : undefined);
}

function isImportNotePath(path: string | undefined): boolean {
  return Boolean(path && normalizePath(path).includes("/Imports/"));
}

function extractUserNotes(content: string): string {
  const headingIndex = content.indexOf(USER_NOTES_HEADING);
  if (headingIndex === -1) {
    return "";
  }
  const afterHeading = content.slice(headingIndex + USER_NOTES_HEADING.length);
  const dataBlockIndex = afterHeading.indexOf(IMPORT_DATA_BLOCK_START);
  const userBlock = dataBlockIndex >= 0 ? afterHeading.slice(0, dataBlockIndex) : afterHeading;
  return cleanText(userBlock) ? userBlock.trim() : "";
}

function parseImportNote(content: string, notePath: string): { note: GeneratedNoteSummary; records: BookmarkRecord[] } | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }
  const frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown> | null;
  if (!frontmatter || frontmatter.bookmark_atlas_type !== IMPORT_NOTE_TYPE) {
    return null;
  }

  const payloadMatch = content.match(new RegExp(`${escapeRegExp(IMPORT_DATA_BLOCK_START)}\\n([\\s\\S]*?)\\n${escapeRegExp(IMPORT_DATA_BLOCK_END)}`));
  if (!payloadMatch) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadMatch[1]) as { note: GeneratedNoteSummary; records: BookmarkRecord[] };
    return {
      note: {
        ...payload.note,
        path: notePath
      },
      records: payload.records.map((record) => ({
        ...record,
        summaryNotePath: record.summaryNotePath ?? notePath
      }))
    };
  } catch {
    return null;
  }
}

function mergeDuplicates(records: BookmarkRecord[], existingGroups: BookmarkAtlasData["duplicates"], result: ImportResult) {
  const existing = new Map(existingGroups.map((group) => [group.key, group]));
  for (const group of result.duplicates) {
    existing.set(group.key, group);
  }

  const activeIds = new Set(records.map((record) => record.id));
  return Array.from(existing.values()).filter((group) => group.recordIds.some((id) => activeIds.has(id)));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
