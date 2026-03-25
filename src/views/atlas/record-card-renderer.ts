import type { BookmarkRecord } from "../../types";

interface RecordCardActions {
  openRecordNote: (record: BookmarkRecord) => void;
  openExternalUrl: (url: string) => void;
}

export function renderRecordCard(container: HTMLElement, record: BookmarkRecord, actions: RecordCardActions): void {
  const card = container.createDiv({ cls: "bookmark-atlas-card" });
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
  titleBlock.createEl("h3", { text: record.title });
  titleBlock.createEl("div", { cls: "bookmark-atlas-card-domain", text: `${record.domain || "未知域名"} · ${record.category || "未分类"}` });

  const cardActions = top.createDiv({ cls: "bookmark-atlas-card-actions" });
  const detailButton = cardActions.createEl("button", { text: "详情页" });
  detailButton.addEventListener("click", () => actions.openRecordNote(record));
  const linkButton = cardActions.createEl("button", { cls: "mod-cta", text: "打开链接" });
  linkButton.addEventListener("click", () => actions.openExternalUrl(record.url));

  card.createEl("p", { cls: "bookmark-atlas-card-description", text: record.description });

  const tags = card.createDiv({ cls: "bookmark-atlas-tags" });
  for (const tag of record.tags.slice(0, 8)) {
    tags.createSpan({ cls: "bookmark-atlas-tag", text: tag });
  }

  const footer = card.createDiv({ cls: "bookmark-atlas-card-footer" });
  footer.createSpan({ text: `来源 ${record.sourceBrowser} / ${record.sourceFormat}` });
  footer.createSpan({ text: `抓取状态 ${record.fetchStatus}` });
  footer.createSpan({ text: record.folderPath.length > 0 ? `目录 ${record.folderPath.join(" / ")}` : "未设置原始目录" });
}
