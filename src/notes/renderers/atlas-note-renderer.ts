import type { BookmarkAtlasData } from "../../types";
import { MANAGED_BLOCK_END, MANAGED_BLOCK_START, buildAtlasFrontmatter, buildCategoryStats, buildSourceStats, escapeHtml, internalLinkMarkup, statCard } from "./render-shared";

export function renderAtlasNote(title: string, state: BookmarkAtlasData): string {
  const recentNotes = state.generatedNotes.slice(0, 12);
  const categoryStats = buildCategoryStats(state.records).slice(0, 10);
  const sourceStats = Array.from(buildSourceStats(state.records).entries()).sort((left, right) => right[1] - left[1]);
  const frontmatter = buildAtlasFrontmatter(title, state);

  const lines: string[] = [
    MANAGED_BLOCK_START,
    "<div class=\"bookmark-atlas-note bookmark-atlas-note-atlas\">",
    "<section class=\"bookmark-atlas-note-hero\">",
    "<p class=\"bookmark-atlas-note-kicker\">Atlas Index</p>",
    `<h2>${escapeHtml(title)}</h2>`,
    "<p class=\"bookmark-atlas-note-hero-copy\">所有导入批次、分类趋势和最近整理结果都会集中显示在这里。</p>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-stats\">",
    statCard("汇总笔记", String(state.generatedNotes.length)),
    statCard("当前书签", String(state.records.length)),
    statCard("分类数", String(categoryStats.length)),
    statCard("最近导入", state.lastImportAt ? state.lastImportAt.slice(0, 16).replace("T", " ") : "尚未导入"),
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-panels\">",
    "<div class=\"bookmark-atlas-note-panel\">",
    "<h3>最近汇总</h3>",
    recentNotes.length > 0 ? "<ul>" : "<p>暂无汇总笔记。</p>"
  ];

  if (recentNotes.length > 0) {
    for (const note of recentNotes) {
      lines.push(`<li>${internalLinkMarkup(note.path, note.title)}<span>${note.recordCount} 条</span></li>`);
    }
    lines.push("</ul>");
  }

  lines.push(
    "</div>",
    "<div class=\"bookmark-atlas-note-panel\">",
    "<h3>来源分布</h3>",
    sourceStats.length > 0 ? "<ul>" : "<p>暂无来源分布。</p>"
  );

  if (sourceStats.length > 0) {
    for (const [source, count] of sourceStats) {
      lines.push(`<li><strong>${escapeHtml(source)}</strong><span>${count}</span></li>`);
    }
    lines.push("</ul>");
  }

  lines.push(
    "</div>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-category\">",
    "<div class=\"bookmark-atlas-note-category-head\"><h3>分类速览</h3><span>Top 10</span></div>",
    "<div class=\"bookmark-atlas-note-chip-row\">"
  );

  for (const [category, count] of categoryStats) {
    lines.push(`<span class="bookmark-atlas-note-chip">${escapeHtml(category)} · ${count}</span>`);
  }

  lines.push(
    "</div>",
    "</section>",
    "</div>",
    MANAGED_BLOCK_END
  );

  return [
    "---",
    frontmatter,
    "---",
    "",
    `# ${title}`,
    "",
    ...lines,
    ""
  ].join("\n");
}
