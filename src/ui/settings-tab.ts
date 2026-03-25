import { PluginSettingTab, Setting } from "obsidian";
import type BookmarkAtlasPlugin from "../main";

export class BookmarkAtlasSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: BookmarkAtlasPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Bookmark Atlas" });

    new Setting(containerEl)
      .setName("书签根目录")
      .setDesc("生成的 Atlas、每次导入的书签汇总笔记和单书签详情页都会写入这个目录。")
      .addText((text) =>
        text.setPlaceholder("Bookmarks").setValue(this.plugin.settings.rootFolder).onChange(async (value) => {
          this.plugin.settings.rootFolder = value.trim() || "Bookmarks";
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("Atlas 标题")
      .setDesc("全局索引页标题。")
      .addText((text) =>
        text.setPlaceholder("Bookmark Atlas").setValue(this.plugin.settings.atlasTitle).onChange(async (value) => {
          this.plugin.settings.atlasTitle = value.trim() || "Bookmark Atlas";
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("联网补充描述")
      .setDesc("导入时尝试抓取网页 title 和 meta description。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableRemoteEnrichment).onChange(async (value) => {
          this.plugin.settings.enableRemoteEnrichment = value;
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("本地网站截图")
      .setDesc("导入或重同步时，尝试为网站生成本地截图并写入 vault。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableLocalScreenshots).onChange(async (value) => {
          this.plugin.settings.enableLocalScreenshots = value;
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("抓取超时（毫秒）")
      .setDesc("网页补充描述的请求超时时间。")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.fetchTimeoutMs)).onChange(async (value) => {
          const parsed = Number(value);
          this.plugin.settings.fetchTimeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("截图超时（毫秒）")
      .setDesc("本地浏览器截图的最长等待时间。")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.screenshotTimeoutMs)).onChange(async (value) => {
          const parsed = Number(value);
          this.plugin.settings.screenshotTimeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 12000;
          await this.plugin.savePluginState();
        }));

    new Setting(containerEl)
      .setName("抓取并发")
      .setDesc("同时补充网页描述的最大请求数。")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxFetchConcurrency)).onChange(async (value) => {
          const parsed = Number(value);
          this.plugin.settings.maxFetchConcurrency = Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
          await this.plugin.savePluginState();
        }));
  }
}
