import { Notice, normalizePath, Plugin, TFile } from "obsidian";
import { DEFAULT_DATA, DEFAULT_SETTINGS, VIEW_TYPE_BOOKMARK_ATLAS } from "./core/constants";
import { enrichRecords } from "./core/enrichment";
import { BookmarkImporter } from "./core/importer";
import { BookmarkNoteWriter } from "./notes/note-writer";
import type { BookmarkAtlasData, BookmarkAtlasSettings, GeneratedNoteSummary, ImportResult, BookmarkRecord } from "./types";
import { ImportBookmarksModal } from "./ui/import-modal";
import { BookmarkAtlasSettingTab } from "./ui/settings-tab";
import { BookmarkAtlasView } from "./views/atlas-view";

interface PersistedPluginData {
  settings?: Partial<BookmarkAtlasSettings>;
  state?: Partial<BookmarkAtlasData>;
}

export default class BookmarkAtlasPlugin extends Plugin {
  settings: BookmarkAtlasSettings = { ...DEFAULT_SETTINGS };
  state: BookmarkAtlasData = { ...DEFAULT_DATA };

  async onload(): Promise<void> {
    await this.loadPluginState();

    this.registerView(VIEW_TYPE_BOOKMARK_ATLAS, (leaf) => new BookmarkAtlasView(leaf, this));
    this.addRibbonIcon("library", "Open Bookmark Atlas", () => {
      void this.openAtlasView();
    });

    this.addCommand({
      id: "import-bookmarks",
      name: "Import Bookmarks",
      callback: () => this.openImportModal()
    });

    this.addCommand({
      id: "open-bookmark-atlas",
      name: "Open Bookmark Atlas",
      callback: () => {
        void this.openAtlasView();
      }
    });

    this.addCommand({
      id: "rebuild-bookmark-indexes",
      name: "Rebuild Bookmark Summary Indexes",
      callback: () => {
        void this.rebuildIndexesCommand();
      }
    });

    this.addCommand({
      id: "resync-imported-bookmarks",
      name: "Resync Imported Bookmarks",
      callback: () => {
        void this.resyncImportedBookmarksCommand();
      }
    });

    this.addCommand({
      id: "open-latest-bookmark-summary",
      name: "Open Latest Bookmark Summary",
      callback: () => {
        void this.openLatestGeneratedNote();
      }
    });

    this.addSettingTab(new BookmarkAtlasSettingTab(this));

    if (this.state.records.length === 0) {
      const rebuilt = await this.getNoteWriter().rebuildDataFromVault();
      if (rebuilt.records.length > 0 || rebuilt.generatedNotes.length > 0) {
        this.state = rebuilt;
        await this.savePluginState();
      }
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BOOKMARK_ATLAS);
  }

  openImportModal(): void {
    new ImportBookmarksModal(this).open();
  }

  async previewBookmarkFile(file: File): Promise<ImportResult> {
    const content = await file.text();
    return this.getImporter().preview(file.name, content);
  }

  async importBookmarkFile(file: File): Promise<ImportResult> {
    new Notice(`正在导入 ${file.name}...`);
    const content = await file.text();
    const result = await this.getImporter().import(file.name, content);
    this.state = await this.getNoteWriter().applyImport(this.state, result);
    await this.savePluginState();
    this.refreshAtlasView();
    new Notice(`导入完成：已生成 1 篇汇总笔记和 ${result.stats.uniqueRecords} 篇书签详情页`);
    await this.openAtlasView();
    return result;
  }

  async rebuildIndexesCommand(): Promise<void> {
    const rebuilt = await this.getNoteWriter().rebuildDataFromVault();
    this.state = rebuilt;
    await this.getNoteWriter().rebuildIndexesFromState(this.state);
    await this.savePluginState();
    this.refreshAtlasView();
    new Notice("Bookmark Atlas 汇总索引已重建");
  }

  async resyncImportedBookmarksCommand(): Promise<void> {
    const issues: ImportResult["errors"] = [];
    const refreshedRecords = await enrichRecords(this.state.records, this.settings, issues);
    this.state = await this.getNoteWriter().resyncManagedNotes({
      ...this.state,
      records: refreshedRecords
    });
    await this.savePluginState();
    this.refreshAtlasView();
    new Notice(`已重新同步书签笔记内容${issues.length > 0 ? `，伴随 ${issues.length} 条告警` : ""}`);
  }

  getRecords(): BookmarkRecord[] {
    return this.state.records;
  }

  getDuplicates() {
    return this.state.duplicates;
  }

  getLastImportAtLabel(): string {
    if (!this.state.lastImportAt) {
      return "尚未导入";
    }
    return this.state.lastImportAt.slice(0, 16).replace("T", " ");
  }

  async openRecordNote(record: BookmarkRecord): Promise<void> {
    const file = this.resolveRecordNoteFile(record);
    if (!(file instanceof TFile)) {
      new Notice("该书签尚未生成详情笔记");
      return;
    }
    await this.app.workspace.getLeaf(true).openFile(file);
  }

  getGeneratedNotes(): GeneratedNoteSummary[] {
    return this.state.generatedNotes;
  }

  getLatestGeneratedNote(): GeneratedNoteSummary | null {
    if (this.state.latestNotePath) {
      return this.state.generatedNotes.find((note) => note.path === this.state.latestNotePath) ?? this.state.generatedNotes[0] ?? null;
    }
    return this.state.generatedNotes[0] ?? null;
  }

  async openLatestGeneratedNote(): Promise<void> {
    const note = this.getLatestGeneratedNote();
    if (!note) {
      new Notice("还没有生成任何书签汇总笔记");
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (!(file instanceof TFile)) {
      new Notice("找不到最新的书签汇总笔记");
      return;
    }
    await this.app.workspace.getLeaf(true).openFile(file);
  }

  async openExternalUrl(url: string): Promise<void> {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      new Notice("无法打开外部链接");
    }
  }

  async openAtlasView(): Promise<void> {
    const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_BOOKMARK_ATLAS)[0];
    if (existingLeaf) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_BOOKMARK_ATLAS);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);

    await leaf.setViewState({
      type: VIEW_TYPE_BOOKMARK_ATLAS,
      active: true
    });
    this.app.workspace.revealLeaf(leaf);
    this.refreshAtlasView();
  }

  async savePluginState(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      state: this.state
    } satisfies PersistedPluginData);
  }

  private async loadPluginState(): Promise<void> {
    const persisted = ((await this.loadData()) as PersistedPluginData | null) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(persisted.settings ?? {})
    };
    this.state = {
      ...DEFAULT_DATA,
      ...(persisted.state ?? {}),
      records: persisted.state?.records ?? DEFAULT_DATA.records,
      duplicates: persisted.state?.duplicates ?? DEFAULT_DATA.duplicates,
      noteIndex: persisted.state?.noteIndex ?? DEFAULT_DATA.noteIndex,
      generatedNotes: persisted.state?.generatedNotes ?? DEFAULT_DATA.generatedNotes,
      latestNotePath: persisted.state?.latestNotePath,
      version: persisted.state?.version ?? DEFAULT_DATA.version
    };
  }

  private getImporter(): BookmarkImporter {
    return new BookmarkImporter(this.settings);
  }

  private getNoteWriter(): BookmarkNoteWriter {
    return new BookmarkNoteWriter(this.app, this.settings, this.manifest.dir ?? "");
  }

  private refreshAtlasView(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_BOOKMARK_ATLAS)) {
      const view = leaf.view;
      if (view instanceof BookmarkAtlasView) {
        view.refresh();
      }
    }
  }

  private resolveRecordNoteFile(record: BookmarkRecord): TFile | null {
    const candidates = [
      record.detailNotePath,
      record.notePath,
      this.state.noteIndex[record.dedupeKey]
    ]
      .filter(Boolean)
      .map((value) => normalizePath(String(value)));

    for (const candidate of candidates) {
      const file = this.app.vault.getAbstractFileByPath(candidate);
      if (file instanceof TFile) {
        return file;
      }
    }

    const slugMatch = candidates
      .map((candidate) => candidate.split("/").pop())
      .find(Boolean);
    if (slugMatch) {
      const fallback = this.app.vault.getMarkdownFiles().find((file) => file.path.endsWith(`/${slugMatch}`) || file.name === slugMatch);
      if (fallback) {
        return fallback;
      }
    }

    return null;
  }
}
