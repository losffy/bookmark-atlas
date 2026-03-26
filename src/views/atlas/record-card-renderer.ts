import type { BookmarkRecord } from "../../types";

interface RecordCardActions {
  openRecordNote: (record: BookmarkRecord) => void;
  openExternalUrl: (url: string) => void;
  resolveAssetUrl: (path: string) => string;
  updateRecordCategory: (recordId: string, category: string) => Promise<void>;
  categoryOptions: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveUp?: () => Promise<void>;
  moveDown?: () => Promise<void>;
}

export function renderRecordCard(container: HTMLElement, record: BookmarkRecord, actions: RecordCardActions): HTMLDivElement {
  const card = container.createDiv({ cls: "bookmark-atlas-card" });
  card.setAttribute("data-record-id", record.id);
  const previewPath = record.previewAssetPath ?? record.screenshotPath;
  if (previewPath) {
    card.addClass("has-preview");
    const media = card.createDiv({ cls: "bookmark-atlas-card-media" });
    const mediaBadge = media.createDiv({ cls: "bookmark-atlas-card-media-badge" });
    mediaBadge.createSpan({ text: record.siteName || record.domain || "网页预览" });
    const image = media.createEl("img", { cls: "bookmark-atlas-card-media-image" });
    image.src = actions.resolveAssetUrl(previewPath);
    image.alt = "网站预览";
    image.loading = "lazy";
  }

  const top = card.createDiv({ cls: "bookmark-atlas-card-top" });
  const header = top.createDiv({ cls: "bookmark-atlas-card-header" });

  if (record.favicon) {
    const favicon = header.createEl("img", { cls: "bookmark-atlas-favicon" });
    favicon.src = record.favicon;
    favicon.alt = "";
  } else {
    const fallback = header.createDiv({ cls: "bookmark-atlas-favicon bookmark-atlas-favicon-fallback" });
    fallback.setText((record.domain || record.title || "?").slice(0, 1).toUpperCase());
  }

  const titleBlock = header.createDiv({ cls: "bookmark-atlas-card-title-block" });
  const eyebrow = titleBlock.createDiv({ cls: "bookmark-atlas-card-eyebrow" });
  eyebrow.createSpan({ cls: "bookmark-atlas-card-site-pill", text: record.siteName || record.domain || "未知站点" });
  eyebrow.createSpan({ cls: "bookmark-atlas-card-category-pill", text: record.category || "未分类" });
  titleBlock.createEl("h3", { text: record.title });
  titleBlock.createEl("a", {
    cls: "bookmark-atlas-card-url",
    href: record.url,
    text: formatDisplayUrl(record.url)
  });
  titleBlock.createEl("div", { cls: "bookmark-atlas-card-domain", text: `${record.domain || "未知域名"} · ${record.category || "未分类"}` });

  const cardActions = top.createDiv({ cls: "bookmark-atlas-card-actions" });
  const sortActions = cardActions.createDiv({ cls: "bookmark-atlas-card-sort-actions" });
  const moveUpButton = sortActions.createEl("button", { cls: "bookmark-atlas-icon-button", text: "↑" });
  moveUpButton.setAttribute("aria-label", "上移");
  moveUpButton.disabled = !actions.canMoveUp;
  moveUpButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actions.moveUp) {
      void actions.moveUp();
    }
  });
  const moveDownButton = sortActions.createEl("button", { cls: "bookmark-atlas-icon-button", text: "↓" });
  moveDownButton.setAttribute("aria-label", "下移");
  moveDownButton.disabled = !actions.canMoveDown;
  moveDownButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actions.moveDown) {
      void actions.moveDown();
    }
  });
  const detailButton = cardActions.createEl("button", { text: "详情页" });
  detailButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.openRecordNote(record);
  });
  const linkButton = cardActions.createEl("button", { cls: "mod-cta", text: "访问原网页" });
  linkButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.openExternalUrl(record.url);
  });

  card.createEl("p", {
    cls: "bookmark-atlas-card-description",
    text: record.articleExcerpt || record.description || "暂未抓取到可展示的站点摘要。"
  });

  const categoryEditor = card.createDiv({ cls: "bookmark-atlas-card-category-editor" });
  categoryEditor.createSpan({ cls: "bookmark-atlas-card-category-label", text: "所属分类" });
  const categoryInput = categoryEditor.createEl("input", {
    cls: "bookmark-atlas-card-category-input",
    type: "text",
    placeholder: "输入新的分类名"
  });
  const categoryListId = `bookmark-atlas-category-options-${record.id}`;
  categoryInput.setAttribute("list", categoryListId);
  categoryInput.value = record.category || "未分类";
  const categorySuggestions = categoryEditor.createEl("datalist");
  categorySuggestions.id = categoryListId;
  for (const option of actions.categoryOptions) {
    categorySuggestions.createEl("option", { value: option });
  }
  const saveCategoryButton = categoryEditor.createEl("button", { cls: "mod-cta", text: "保存分类" });
  const submitCategoryUpdate = async (): Promise<void> => {
    const nextCategory = categoryInput.value.trim() || "未分类";
    if (nextCategory === (record.category || "未分类")) {
      return;
    }
    categoryInput.disabled = true;
    saveCategoryButton.disabled = true;
    try {
      await actions.updateRecordCategory(record.id, nextCategory);
    } finally {
      categoryInput.disabled = false;
      saveCategoryButton.disabled = false;
    }
  };
  categoryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void submitCategoryUpdate();
    }
  });
  saveCategoryButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void submitCategoryUpdate();
  });

  const tags = card.createDiv({ cls: "bookmark-atlas-tags" });
  for (const tag of record.tags.slice(0, 8)) {
    tags.createSpan({ cls: "bookmark-atlas-tag", text: tag });
  }

  const footer = card.createDiv({ cls: "bookmark-atlas-card-footer" });
  createFooterFact(footer, "来源", `${record.sourceBrowser} / ${record.sourceFormat}`);
  createFooterFact(footer, "抓取状态", record.fetchStatus);
  createFooterFact(footer, "原始目录", record.folderPath.length > 0 ? record.folderPath.join(" / ") : "未设置原始目录");
  return card;
}

function createFooterFact(container: HTMLElement, label: string, value: string): void {
  const item = container.createDiv({ cls: "bookmark-atlas-card-fact" });
  item.createSpan({ cls: "bookmark-atlas-card-fact-label", text: label });
  item.createSpan({ cls: "bookmark-atlas-card-fact-value", text: value });
}

function formatDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
