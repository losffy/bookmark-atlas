import type { BookmarkRecord, GeneratedNoteSummary } from "../../types";
import {
  IMPORT_DATA_BLOCK_END,
  IMPORT_DATA_BLOCK_START,
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  USER_NOTES_HEADING,
  buildDomainStats,
  buildImportFrontmatter,
  escapeHtml,
  escapeHtmlAttribute,
  groupByCategory,
  internalLinkMarkup,
  statCard
} from "./render-shared";

export function renderImportNote(note: GeneratedNoteSummary, records: BookmarkRecord[], userNotes: string): string {
  const grouped = groupByCategory(records);
  const topDomains = Array.from(buildDomainStats(records).entries()).sort((left, right) => right[1] - left[1]).slice(0, 12);
  const duplicateFlags = records.filter((record) => record.qualityFlags.includes("has-duplicates") || record.qualityFlags.includes("suspected-duplicate")).length;
  const frontmatter = buildImportFrontmatter(note);

  const managedLines: string[] = [
    MANAGED_BLOCK_START,
    "<div class=\"bookmark-atlas-note\">",
    "<section class=\"bookmark-atlas-note-hero\">",
    "<p class=\"bookmark-atlas-note-kicker\">Imported Summary</p>",
    `<h2>${escapeHtml(note.title)}</h2>`,
    `<p class="bookmark-atlas-note-hero-copy">这次导入共整理出 ${records.length} 条书签。你可以先从分类分区浏览，再进入单书签详情页继续补充、标记或沉淀备注。</p>`,
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-stats\">",
    statCard("来源文件", note.sourceFileName),
    statCard("来源浏览器", note.sourceBrowser),
    statCard("来源格式", note.sourceFormat),
    statCard("导入时间", note.importedAt.slice(0, 16).replace("T", " ")),
    statCard("唯一书签", String(records.length)),
    statCard("命中分类", String(grouped.length)),
    statCard("重复疑似项", String(duplicateFlags)),
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-panels\">",
    "<div class=\"bookmark-atlas-note-panel\">",
    "<h3>分类统计</h3>",
    "<ul>"
  ];

  for (const [category, categoryRecords] of grouped) {
    managedLines.push(`<li><strong>${escapeHtml(category)}</strong><span>${categoryRecords.length}</span></li>`);
  }

  managedLines.push(
    "</ul>",
    "</div>",
    "<div class=\"bookmark-atlas-note-panel\">",
    "<h3>常见域名</h3>",
    "<ul>"
  );

  for (const [domain, count] of topDomains) {
    managedLines.push(`<li><strong>${escapeHtml(domain)}</strong><span>${count}</span></li>`);
  }

  managedLines.push(
    "</ul>",
    "</div>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-guide\">",
    "<h3>阅读方式</h3>",
    "<ul>",
    "<li>先在这里快速扫分类，再点进单书签详情页做精读或补充。</li>",
    "<li>详情页会保留你的用户备注，不会被重新导入覆盖。</li>",
    "<li>在右侧 Bookmark Atlas 面板里可以切换只看当前汇总，或直接搜索全量书签。</li>",
    "</ul>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-categories\">"
  );

  for (const [category, categoryRecords] of grouped) {
    managedLines.push(
      "<div class=\"bookmark-atlas-note-category\">",
      `<div class="bookmark-atlas-note-category-head"><h3>${escapeHtml(category)}</h3><span>${categoryRecords.length} 条</span></div>`,
      "<div class=\"bookmark-atlas-note-entry-list\">"
    );

    for (const record of categoryRecords) {
      const tagMarkup = record.tags.length > 0
        ? `<div class="bookmark-atlas-note-tags">${record.tags.slice(0, 6).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";
      const folderMarkup = record.folderPath.length > 0
        ? `<p class="bookmark-atlas-note-folder">原始目录：${escapeHtml(record.folderPath.join(" / "))}</p>`
        : "";
      const detailLink = record.detailNotePath ? internalLinkMarkup(record.detailNotePath, "打开详情页", "bookmark-atlas-note-link") : "";
      const linkMarkup = [
        "<div class=\"bookmark-atlas-note-actions\">",
        detailLink,
        `<a href="${escapeHtmlAttribute(record.url)}" class="bookmark-atlas-note-link external-link" target="_blank" rel="noopener">打开原链接</a>`,
        `<span class="bookmark-atlas-note-chip">${escapeHtml(record.category)}</span>`,
        `<span class="bookmark-atlas-note-chip is-muted">${escapeHtml(record.sourceBrowser)}</span>`,
        "</div>"
      ].join("");

      managedLines.push(
        "<article class=\"bookmark-atlas-note-entry\">",
        "<div class=\"bookmark-atlas-note-entry-head\">",
        "<div class=\"bookmark-atlas-note-entry-title-group\">",
        `<a href="${escapeHtmlAttribute(record.url)}" class="bookmark-atlas-note-entry-link external-link" target="_blank" rel="noopener">${escapeHtml(record.title)}</a>`,
        `<span>${escapeHtml(record.domain || "未知域名")}</span>`,
        "</div>",
        linkMarkup,
        "</div>",
        `<p class="bookmark-atlas-note-entry-copy">${escapeHtml(record.description)}</p>`,
        tagMarkup,
        folderMarkup,
        "</article>"
      );
    }
    managedLines.push("</div>", "</div>");
  }

  managedLines.push(
    "</section>",
    "</div>",
    MANAGED_BLOCK_END
  );

  const payload = JSON.stringify({ note, records });

  return [
    "---",
    frontmatter,
    "---",
    "",
    `# ${note.title}`,
    "",
    ...managedLines,
    "",
    USER_NOTES_HEADING,
    "",
    userNotes || "_保留给手动补充的总览、结论和后续整理计划。_",
    "",
    IMPORT_DATA_BLOCK_START,
    payload,
    IMPORT_DATA_BLOCK_END,
    ""
  ].join("\n");
}
