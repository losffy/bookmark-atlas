import { setIcon } from "obsidian";
import type { BookmarkRecord, GeneratedNoteSummary } from "../../types";
import type { AtlasDerivedState, AtlasFilterState, AtlasLayoutMode } from "./filter-state";
import { renderRecordCard } from "./record-card-renderer";

interface AtlasLayoutActions {
  openImportModal: () => void;
  openLatestGeneratedNote: () => Promise<void>;
  rebuildIndexesCommand: () => Promise<void>;
  openRecordNote: (record: BookmarkRecord) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  onSearchTermChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onScopeChange: (value: AtlasFilterState["selectedNoteScope"]) => void;
  onCategoryCardToggle: (category: string) => void;
}

interface AtlasLayoutRenderInput {
  contentEl: HTMLElement;
  layoutMode: AtlasLayoutMode;
  records: BookmarkRecord[];
  duplicatesCount: number;
  generatedNotes: GeneratedNoteSummary[];
  latestNote: GeneratedNoteSummary | null;
  filterState: AtlasFilterState;
  derivedState: AtlasDerivedState;
  lastImportAtLabel: string;
  actions: AtlasLayoutActions;
}

export function renderAtlasLayout(input: AtlasLayoutRenderInput): void {
  const {
    contentEl,
    layoutMode,
    records,
    duplicatesCount,
    generatedNotes,
    latestNote,
    filterState,
    derivedState,
    lastImportAtLabel,
    actions
  } = input;

  contentEl.empty();
  contentEl.addClass("bookmark-atlas-view");
  contentEl.toggleClass("is-compact", layoutMode === "compact");
  contentEl.toggleClass("is-narrow", layoutMode === "narrow");

  const shell = contentEl.createDiv({ cls: "bookmark-atlas-shell" });
  shell.createDiv({ cls: "bookmark-atlas-orb bookmark-atlas-orb-one" });
  shell.createDiv({ cls: "bookmark-atlas-orb bookmark-atlas-orb-two" });

  renderHero(shell, generatedNotes.length, records.length, lastImportAtLabel, latestNote, actions);
  renderStats(shell, records, generatedNotes.length, derivedState.categories.length - 1, duplicatesCount);

  if (latestNote) {
    renderLatestNoteSpotlight(shell, latestNote, actions);
  }

  renderControls(shell, filterState, derivedState, latestNote, actions);
  renderCategoryDeck(shell, derivedState, actions);
  renderResults(shell, derivedState, actions);
}

function renderHero(
  shell: HTMLElement,
  generatedNotesCount: number,
  recordCount: number,
  lastImportAtLabel: string,
  latestNote: GeneratedNoteSummary | null,
  actions: AtlasLayoutActions
): void {
  const hero = shell.createDiv({ cls: "bookmark-atlas-hero" });
  const heroMain = hero.createDiv({ cls: "bookmark-atlas-hero-main" });
  heroMain.createEl("span", { cls: "bookmark-atlas-kicker", text: "Acrylic Library" });
  heroMain.createEl("h2", { text: "Bookmark Atlas" });
  heroMain.createEl("p", {
    cls: "bookmark-atlas-hero-copy",
    text: "导入书签后，同时保留可浏览的汇总笔记和可沉淀备注的单书签详情页。"
  });

  const heroMeta = hero.createDiv({ cls: "bookmark-atlas-hero-meta" });
  createMiniMetric(heroMeta, "最新导入", lastImportAtLabel);
  createMiniMetric(heroMeta, "汇总笔记", String(generatedNotesCount));
  createMiniMetric(heroMeta, "当前记录", String(recordCount));

  const toolbar = hero.createDiv({ cls: "bookmark-atlas-toolbar" });
  const importButton = toolbar.createEl("button", { cls: "mod-cta", text: "导入书签" });
  importButton.addEventListener("click", () => actions.openImportModal());
  const openLatestButton = toolbar.createEl("button", { text: "打开最新汇总" });
  openLatestButton.disabled = !latestNote;
  openLatestButton.addEventListener("click", () => void actions.openLatestGeneratedNote());
  const rebuildButton = toolbar.createEl("button", { text: "重建索引" });
  rebuildButton.addEventListener("click", () => void actions.rebuildIndexesCommand());
}

function renderStats(shell: HTMLElement, records: BookmarkRecord[], generatedNotesCount: number, categoryCount: number, duplicatesCount: number): void {
  const stats = shell.createDiv({ cls: "bookmark-atlas-stats" });
  createStatCard(stats, "书签详情页", String(records.filter((record) => Boolean(record.detailNotePath ?? record.notePath)).length), "file-text");
  createStatCard(stats, "汇总笔记", String(generatedNotesCount), "files");
  createStatCard(stats, "分类数", String(categoryCount), "folders");
  createStatCard(stats, "重复组", String(duplicatesCount), "copy");
}

function renderLatestNoteSpotlight(shell: HTMLElement, note: GeneratedNoteSummary, actions: AtlasLayoutActions): void {
  const panel = shell.createDiv({ cls: "bookmark-atlas-featured-note" });
  const copy = panel.createDiv({ cls: "bookmark-atlas-featured-copy" });
  copy.createEl("span", { cls: "bookmark-atlas-kicker", text: "Latest Summary" });
  copy.createEl("h3", { text: note.title });
  copy.createEl("p", {
    text: `${note.recordCount} 条书签，${note.categoryCount} 个分类，来源 ${note.sourceBrowser} / ${note.sourceFormat}`
  });

  const meta = panel.createDiv({ cls: "bookmark-atlas-featured-meta" });
  meta.createSpan({ cls: "bookmark-atlas-featured-pill", text: `导入 ${note.importedAt.slice(0, 16).replace("T", " ")}` });
  meta.createSpan({ cls: "bookmark-atlas-featured-pill", text: `${note.recordCount} 条书签` });
  meta.createSpan({ cls: "bookmark-atlas-featured-pill", text: `${note.categoryCount} 个分类` });

  const button = panel.createDiv({ cls: "bookmark-atlas-featured-actions" }).createEl("button", { cls: "mod-cta", text: "直接打开这篇汇总" });
  button.addEventListener("click", () => void actions.openLatestGeneratedNote());
}

function renderControls(
  shell: HTMLElement,
  filterState: AtlasFilterState,
  derivedState: AtlasDerivedState,
  latestNote: GeneratedNoteSummary | null,
  actions: AtlasLayoutActions
): void {
  const controls = shell.createDiv({ cls: "bookmark-atlas-controls" });
  const searchCard = controls.createDiv({ cls: "bookmark-atlas-control-card bookmark-atlas-control-card-wide" });
  searchCard.createEl("label", { cls: "bookmark-atlas-control-label", text: "搜索条目" });
  const searchInput = searchCard.createEl("input", {
    type: "search",
    placeholder: "搜索标题、URL、域名、标签、描述"
  });
  searchInput.value = filterState.searchTerm;
  searchInput.addEventListener("input", () => actions.onSearchTermChange(searchInput.value));

  const categoryCard = controls.createDiv({ cls: "bookmark-atlas-control-card" });
  categoryCard.createEl("label", { cls: "bookmark-atlas-control-label", text: "分类筛选" });
  const categorySelect = categoryCard.createEl("select");
  for (const category of derivedState.categories) {
    const option = categorySelect.createEl("option", { text: category });
    option.value = category;
  }
  categorySelect.value = derivedState.selectedCategory;
  categorySelect.addEventListener("change", () => actions.onCategoryChange(categorySelect.value));

  const sourceCard = controls.createDiv({ cls: "bookmark-atlas-control-card" });
  sourceCard.createEl("label", { cls: "bookmark-atlas-control-label", text: "来源筛选" });
  const sourceSelect = sourceCard.createEl("select");
  for (const source of derivedState.sources) {
    const option = sourceSelect.createEl("option", { text: source });
    option.value = source;
  }
  sourceSelect.value = derivedState.selectedSource;
  sourceSelect.addEventListener("change", () => actions.onSourceChange(sourceSelect.value));

  const scopeCard = controls.createDiv({ cls: "bookmark-atlas-control-card" });
  scopeCard.createEl("label", { cls: "bookmark-atlas-control-label", text: "记录范围" });
  const scopeSwitch = scopeCard.createDiv({ cls: "bookmark-atlas-scope-switch" });
  const allButton = scopeSwitch.createEl("button", { text: "全部记录" });
  const latestButton = scopeSwitch.createEl("button", { text: "只看最新汇总" });
  if (filterState.selectedNoteScope === "all") {
    allButton.addClass("is-active");
  } else {
    latestButton.addClass("is-active");
  }
  allButton.addEventListener("click", () => actions.onScopeChange("all"));
  latestButton.disabled = !latestNote;
  latestButton.addEventListener("click", () => {
    if (latestNote) {
      actions.onScopeChange("latest");
    }
  });
}

function renderCategoryDeck(shell: HTMLElement, derivedState: AtlasDerivedState, actions: AtlasLayoutActions): void {
  const categoryStrip = shell.createDiv({ cls: "bookmark-atlas-category-deck" });
  const allCategoryCard = createCategoryCard(categoryStrip, "全部", derivedState.scopedRecords.length, derivedState.selectedCategory === "全部");
  allCategoryCard.addEventListener("click", () => actions.onCategoryCardToggle("全部"));

  for (const [category, count] of derivedState.categoryCards) {
    const card = createCategoryCard(categoryStrip, category, count, derivedState.selectedCategory === category);
    card.addEventListener("click", () => actions.onCategoryCardToggle(category));
  }
}

function renderResults(shell: HTMLElement, derivedState: AtlasDerivedState, actions: AtlasLayoutActions): void {
  const resultMeta = shell.createDiv({ cls: "bookmark-atlas-result-meta" });
  resultMeta.setText(`显示 ${derivedState.filteredRecords.length} / ${derivedState.scopedRecords.length} 条记录 · ${derivedState.scopeLabel}`);

  const list = shell.createDiv({ cls: "bookmark-atlas-list" });
  if (derivedState.filteredRecords.length === 0) {
    list.createDiv({ cls: "bookmark-atlas-empty", text: "暂无匹配结果。可以先导入一份浏览器书签文件，或放宽当前筛选条件。" });
    return;
  }

  for (const record of derivedState.filteredRecords.slice(0, 250)) {
    renderRecordCard(list, record, {
      openRecordNote: (selectedRecord) => void actions.openRecordNote(selectedRecord),
      openExternalUrl: (url) => void actions.openExternalUrl(url)
    });
  }
}

function createStatCard(container: HTMLElement, label: string, value: string, icon: string): void {
  const card = container.createDiv({ cls: "bookmark-atlas-stat-card" });
  const iconEl = card.createDiv({ cls: "bookmark-atlas-stat-icon" });
  setIcon(iconEl, icon);
  card.createDiv({ cls: "bookmark-atlas-stat-label", text: label });
  card.createDiv({ cls: "bookmark-atlas-stat-value", text: value });
}

function createMiniMetric(container: HTMLElement, label: string, value: string): void {
  const item = container.createDiv({ cls: "bookmark-atlas-mini-metric" });
  item.createSpan({ cls: "bookmark-atlas-mini-label", text: label });
  item.createEl("strong", { text: value });
}

function createCategoryCard(container: HTMLElement, label: string, count: number, active: boolean): HTMLButtonElement {
  const button = container.createEl("button", { cls: "bookmark-atlas-category-card" });
  if (active) {
    button.addClass("is-active");
  }
  const row = button.createDiv({ cls: "bookmark-atlas-category-card-row" });
  row.createSpan({ cls: "bookmark-atlas-category-card-label", text: label });
  row.createSpan({ cls: "bookmark-atlas-category-card-count", text: String(count) });
  return button;
}
