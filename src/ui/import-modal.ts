import { Modal, Notice } from "obsidian";
import type { ImportResult } from "../types";
import type BookmarkAtlasPlugin from "../main";

export class ImportBookmarksModal extends Modal {
  private selectedFile: File | null = null;
  private fileLabelEl!: HTMLDivElement;
  private previewEl!: HTMLDivElement;
  private importButtonEl!: HTMLButtonElement;

  constructor(private readonly plugin: BookmarkAtlasPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("bookmark-atlas-modal");

    contentEl.createEl("h2", { text: "导入浏览器书签" });
    contentEl.createEl("p", {
      text: "支持 Chrome / Firefox 导出的 HTML，以及 Chrome Bookmarks JSON。每次导入会生成一篇新的书签汇总笔记，并为每条书签补出独立详情页。"
    });

    const chooserSection = contentEl.createDiv({ cls: "bookmark-atlas-modal-section" });
    this.fileLabelEl = chooserSection.createDiv({ cls: "bookmark-atlas-file-label", text: "尚未选择文件" });
    const chooseButton = chooserSection.createEl("button", { cls: "mod-cta", text: "选择书签文件" });
    const inputEl = chooserSection.createEl("input");
    inputEl.type = "file";
    inputEl.accept = ".html,.htm,.json";
    inputEl.style.display = "none";
    chooseButton.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", () => {
      const file = inputEl.files?.[0] ?? null;
      void this.handleFileSelected(file);
    });

    const policy = contentEl.createDiv({ cls: "bookmark-atlas-policy" });
    policy.createEl("strong", { text: "当前策略" });
    policy.createEl("p", { text: "每次导入生成一篇新的汇总笔记，同时为每条书签生成详情页。重导入时会重建机器内容，但保留“用户备注”段落。" });

    this.previewEl = contentEl.createDiv({ cls: "bookmark-atlas-preview" });
    this.previewEl.setText("选择文件后会显示预览统计。");

    const actionRow = contentEl.createDiv({ cls: "bookmark-atlas-inline-actions" });
    this.importButtonEl = actionRow.createEl("button", { cls: "mod-cta", text: "开始导入" });
    this.importButtonEl.disabled = true;
    this.importButtonEl.addEventListener("click", () => void this.handleImport());
    const cancelButton = actionRow.createEl("button", { text: "取消" });
    cancelButton.addEventListener("click", () => this.close());
  }

  private async handleFileSelected(file: File | null): Promise<void> {
    this.selectedFile = file;
    this.importButtonEl.disabled = true;

    if (!file) {
      this.fileLabelEl.setText("尚未选择文件");
      this.previewEl.setText("选择文件后会显示预览统计。");
      return;
    }

    this.fileLabelEl.setText(`已选择：${file.name}`);
    this.previewEl.setText("正在分析书签结构...");

    try {
      const preview = await this.plugin.previewBookmarkFile(file);
      this.importButtonEl.disabled = preview.stats.uniqueRecords === 0;
      this.renderPreview(preview);
    } catch (error) {
      this.previewEl.setText(error instanceof Error ? error.message : String(error));
      new Notice("预览书签文件失败");
    }
  }

  private renderPreview(preview: ImportResult): void {
    this.previewEl.empty();
    this.previewEl.createEl("h3", { text: "预览统计" });
    const list = this.previewEl.createEl("ul");
    list.createEl("li", { text: `解析条目：${preview.stats.totalParsed}` });
    list.createEl("li", { text: `唯一记录：${preview.stats.uniqueRecords}` });
    list.createEl("li", { text: `强重复组：${preview.stats.strongDuplicateGroups}` });
    list.createEl("li", { text: `弱重复组：${preview.stats.weakDuplicateGroups}` });
    list.createEl("li", { text: `问题数：${preview.errors.length}` });
    list.createEl("li", { text: `导入后将生成 1 篇汇总笔记和 ${preview.stats.uniqueRecords} 篇详情页` });

    const sample = this.previewEl.createDiv({ cls: "bookmark-atlas-preview-sample" });
    sample.createEl("strong", { text: "样例条目" });
    const sampleList = sample.createEl("ul");
    for (const record of preview.records.slice(0, 5)) {
      sampleList.createEl("li", { text: `${record.category} · ${record.title}` });
    }

    if (preview.errors.length > 0) {
      const issues = this.previewEl.createDiv({ cls: "bookmark-atlas-preview-issues" });
      issues.createEl("strong", { text: "预览告警" });
      const issueList = issues.createEl("ul");
      for (const issue of preview.errors.slice(0, 5)) {
        issueList.createEl("li", { text: `${issue.level} · ${issue.message}` });
      }
    }
  }

  private async handleImport(): Promise<void> {
    if (!this.selectedFile) {
      return;
    }

    this.importButtonEl.disabled = true;
    try {
      await this.plugin.importBookmarkFile(this.selectedFile);
      this.close();
    } finally {
      this.importButtonEl.disabled = false;
    }
  }
}
