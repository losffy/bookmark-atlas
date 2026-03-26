import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_BOOKMARK_ATLAS } from "../core/constants";
import type BookmarkAtlasPlugin from "../main";
import { deriveAtlasState, type AtlasFilterState, type AtlasLayoutMode } from "./atlas/filter-state";
import { renderAtlasLayout } from "./atlas/layout-renderer";

export class BookmarkAtlasView extends ItemView {
  private filterState: AtlasFilterState = {
    searchTerm: "",
    selectedCategory: "全部",
    selectedSource: "全部",
    selectedNoteScope: "all"
  };
  private resizeObserver: ResizeObserver | null = null;
  private layoutMode: AtlasLayoutMode = "wide";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: BookmarkAtlasPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_BOOKMARK_ATLAS;
  }

  getDisplayText(): string {
    return "Bookmark Atlas";
  }

  getIcon(): string {
    return "library";
  }

  async onOpen(): Promise<void> {
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? this.contentEl.clientWidth;
      const nextMode: AtlasLayoutMode = width < 560 ? "narrow" : width < 980 ? "compact" : "wide";
      if (nextMode !== this.layoutMode) {
        this.layoutMode = nextMode;
        this.render();
      }
    });
    this.resizeObserver.observe(this.contentEl);
    this.render();
  }

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const records = this.plugin.getRecords();
    const latestNote = this.plugin.getLatestGeneratedNote();
    const derivedState = deriveAtlasState(records, latestNote, this.filterState);

    this.filterState = {
      ...this.filterState,
      selectedCategory: derivedState.selectedCategory,
      selectedSource: derivedState.selectedSource
    };

    renderAtlasLayout({
      contentEl: this.contentEl,
      layoutMode: this.layoutMode,
      records,
      duplicatesCount: this.plugin.getDuplicates().length,
      generatedNotes: this.plugin.getGeneratedNotes(),
      latestNote,
      filterState: this.filterState,
      derivedState,
      lastImportAtLabel: this.plugin.getLastImportAtLabel(),
      actions: {
        openImportModal: () => this.plugin.openImportModal(),
        openLatestGeneratedNote: () => this.plugin.openLatestGeneratedNote(),
        rebuildIndexesCommand: () => this.plugin.rebuildIndexesCommand(),
        openRecordNote: (record) => this.plugin.openRecordNote(record),
        openExternalUrl: (url) => this.plugin.openExternalUrl(url),
        resolveAssetUrl: (path) => this.plugin.app.vault.adapter.getResourcePath(path.replace(/\\/g, "/")),
        updateRecordCategory: (recordId, category) => this.plugin.updateRecordCategory(recordId, category),
        reorderRecords: (draggedRecordId, targetRecordId) => this.plugin.reorderRecords(draggedRecordId, targetRecordId),
        onSearchTermChange: (value) => {
          this.filterState.searchTerm = value;
          this.render();
        },
        onCategoryChange: (value) => {
          this.filterState.selectedCategory = value;
          this.render();
        },
        onSourceChange: (value) => {
          this.filterState.selectedSource = value;
          this.render();
        },
        onScopeChange: (value) => {
          this.filterState.selectedNoteScope = value;
          this.render();
        },
        onCategoryCardToggle: (category) => {
          this.filterState.selectedCategory = this.filterState.selectedCategory === category ? "全部" : category;
          this.render();
        }
      }
    });
  }
}
