import type { BookmarkRecord, GeneratedNoteSummary } from "../../types";
import {
  USER_NOTES_HEADING,
  buildDetailFrontmatter,
  escapeHtml,
  escapeHtmlAttribute,
  formatAccessHint,
  formatAdRisk,
  formatAvailability,
  formatPreviewSource,
  toDetailRelativeAssetPath
} from "./render-shared";

export function renderDetailNote(record: BookmarkRecord, _summaryNote: GeneratedNoteSummary, userNotes: string): string {
  const frontmatter = buildDetailFrontmatter(record);
  const previewPath = record.previewAssetPath ?? record.screenshotPath;
  const articleExcerpt = record.articleExcerpt || record.description || "暂未提取到可展示的站点摘要。";
  const heroSummary = record.description || articleExcerpt;
  const domainLabel = formatDisplayUrl(record.url, record.domain || "未知域名");
  const articleMeta = [
    record.articleAuthor ? `<span class="bookmark-atlas-note-chip">${escapeHtml(record.articleAuthor)}</span>` : "",
    record.articlePublishedAt ? `<span class="bookmark-atlas-note-chip is-muted">${escapeHtml(normalizePublishedAt(record.articlePublishedAt))}</span>` : "",
    record.articleWordCount ? `<span class="bookmark-atlas-note-chip is-muted">${escapeHtml(String(record.articleWordCount))} 字</span>` : ""
  ].filter(Boolean).join("");

  return [
    "---",
    frontmatter,
    "---",
    "",
    "<div class=\"bookmark-atlas-bookmark\">",
    "<section class=\"bookmark-atlas-bookmark-hero\">",
    "<div class=\"bookmark-atlas-bookmark-hero-grid\">",
    "<div class=\"bookmark-atlas-bookmark-hero-copy-wrap\">",
    "<p class=\"bookmark-atlas-note-kicker\">Research Card</p>",
    `<div class="bookmark-atlas-bookmark-eyebrow">${escapeHtml(record.siteName || record.domain || "Web Resource")}</div>`,
    `<h2 class="bookmark-atlas-bookmark-title">${escapeHtml(record.title)}</h2>`,
    `<a href="${escapeHtmlAttribute(record.url)}" class="bookmark-atlas-bookmark-domain-link external-link" target="_blank" rel="noopener">${escapeHtml(domainLabel)}</a>`,
    `<p class="bookmark-atlas-bookmark-copy bookmark-atlas-bookmark-summary">${escapeHtml(heroSummary)}</p>`,
    `<div class="bookmark-atlas-note-chip-row">
      <span class="bookmark-atlas-note-chip">${escapeHtml(record.domain || "未知域名")}</span>
      <span class="bookmark-atlas-note-chip">${escapeHtml(record.category || "未分类")}</span>
      <span class="bookmark-atlas-note-chip is-muted">${escapeHtml(`${record.sourceBrowser} / ${record.sourceFormat}`)}</span>
    </div>`,
    "<div class=\"bookmark-atlas-bookmark-action-row\">",
    `<a href="${escapeHtmlAttribute(record.url)}" class="bookmark-atlas-bookmark-link external-link" target="_blank" rel="noopener">打开原网站</a>`,
    "</div>",
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-hero-aside\">",
    "<div class=\"bookmark-atlas-bookmark-favicon-shell\">",
    buildFaviconMarkup(record),
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-source-card\">",
    "<span>Source</span>",
    `<strong>${escapeHtml(record.siteName || record.domain || "未知站点")}</strong>`,
    `<p>${escapeHtml(record.url)}</p>`,
    "</div>",
    "</div>",
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-status-dashboard\">",
    buildStatusMarkup("访问状态", formatAvailability(record.availability), "availability"),
    buildStatusMarkup("访问提示", formatAccessHint(record.accessHint), "access"),
    buildStatusMarkup("失效风险", record.isLikelyDead ? "可能失效" : "暂未发现失效", record.isLikelyDead ? "risk" : "healthy"),
    buildStatusMarkup("广告风险", formatAdRisk(record.adRisk), record.adRisk === "high" ? "risk" : record.adRisk === "medium" ? "watch" : "healthy"),
    "</div>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-bookmark-grid\">",
    "<div class=\"bookmark-atlas-bookmark-panel\">",
    "<div class=\"bookmark-atlas-bookmark-section-head\">",
    "<p>Site Facts</p>",
    "<h3>站点信息</h3>",
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-facts\">",
    buildFact("站点标题", record.title),
    buildFact("站点名称", record.siteName || record.domain || "未知"),
    buildFact("来源站点", record.domain || "未知域名"),
    buildFact("加入时间", record.createdAt ? record.createdAt.slice(0, 10) : "未知"),
    buildFact("导入时间", record.importedAt.slice(0, 16).replace("T", " ")),
    buildFact("预览来源", formatPreviewSource(record)),
    "</div>",
    "</div>",
    "",
    "<div class=\"bookmark-atlas-bookmark-panel bookmark-atlas-bookmark-story-panel\">",
    "<div class=\"bookmark-atlas-bookmark-section-head bookmark-atlas-bookmark-story-head\">",
    "<p>Reading Journey</p>",
    "<h3>Visual Proof · Content Brief</h3>",
    "</div>",
    buildPreviewMarkup(previewPath),
    `<div class="bookmark-atlas-bookmark-meta-strip">
      <span>${escapeHtml(formatPreviewSource(record))}</span>
      <span>${escapeHtml(record.domain || "未知域名")}</span>
      <span>${escapeHtml(record.previewStatus === "fallback" ? "回退预览" : "真实预览")}</span>
    </div>`,
    "<div class=\"bookmark-atlas-bookmark-story-copy\">",
    "<div class=\"bookmark-atlas-bookmark-section-head\">",
    "<p>Content Brief</p>",
    "<h3>正文提要</h3>",
    "</div>",
    articleMeta ? `<div class="bookmark-atlas-note-chip-row">${articleMeta}</div>` : "",
    `<div class="bookmark-atlas-bookmark-excerpt-box"><p class="bookmark-atlas-note-entry-copy">${escapeHtml(articleExcerpt)}</p></div>`,
    "</div>",
    "</div>",
    "</section>",
    "",
    "<section class=\"bookmark-atlas-note-panels\">",
    "<div class=\"bookmark-atlas-bookmark-panel\">",
    "<div class=\"bookmark-atlas-bookmark-section-head\">",
    "<p>Context</p>",
    "<h3>标签与目录</h3>",
    "</div>",
    record.tags.length > 0
      ? `<div class="bookmark-atlas-note-tags">${record.tags.map((tag) => `<span class="bookmark-atlas-note-chip">${escapeHtml(tag)}</span>`).join("")}</div>`
      : "<p class=\"bookmark-atlas-note-empty-copy\">暂无标签。</p>",
    record.folderPath.length > 0
      ? `<p class="bookmark-atlas-note-folder">原始目录：${escapeHtml(record.folderPath.join(" / "))}</p>`
      : "<p class=\"bookmark-atlas-note-empty-copy\">未设置原始目录。</p>",
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-panel bookmark-atlas-bookmark-trace-panel\">",
    "<div class=\"bookmark-atlas-bookmark-section-head\">",
    "<p>Capture Trail</p>",
    "<h3>采集轨迹</h3>",
    "</div>",
    "<div class=\"bookmark-atlas-bookmark-trace-list\">",
    buildTraceItem("收藏时间", record.createdAt ? record.createdAt.slice(0, 10) : "未知"),
    buildTraceItem("导入批次", record.importedAt.slice(0, 16).replace("T", " ")),
    buildTraceItem("来源格式", `${record.sourceBrowser} / ${record.sourceFormat}`),
    buildTraceItem("预览状态", record.previewStatus === "fallback" ? "回退预览" : "真实预览"),
    "</div>",
    "</div>",
    "</section>",
    "</div>",
    "",
    ...(record.articleMarkdown
      ? ["## 解析正文", "", record.articleMarkdown.trim(), ""]
      : []),
    USER_NOTES_HEADING,
    "",
    userNotes || "_在这里补充你的判断、用途、收藏理由和后续动作。_",
    ""
  ].join("\n");
}

function buildFaviconMarkup(record: BookmarkRecord): string {
  if (record.favicon) {
    return `<img class="bookmark-atlas-bookmark-favicon" src="${escapeHtmlAttribute(record.favicon)}" alt="">`;
  }
  return `<div class="bookmark-atlas-bookmark-favicon bookmark-atlas-bookmark-favicon-fallback">${escapeHtml((record.domain || record.title || "?").slice(0, 1).toUpperCase())}</div>`;
}

function buildStatusMarkup(label: string, value: string, tone: string): string {
  return `<div class="bookmark-atlas-bookmark-status-card is-${escapeHtmlAttribute(tone)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildFact(label: string, value: string): string {
  return `<div class="bookmark-atlas-bookmark-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildTraceItem(label: string, value: string): string {
  return `<div class="bookmark-atlas-bookmark-trace-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildPreviewMarkup(previewPath: string | undefined): string {
  if (!previewPath) {
    return [
      "<div class=\"bookmark-atlas-bookmark-preview-fallback\">",
      "<span>BA</span>",
      "<p>本地预览尚未生成。后续重同步时会重新尝试截图或生成站点预览卡。</p>",
      "</div>"
    ].join("");
  }

  return [
    "<div class=\"bookmark-atlas-bookmark-preview-media\">",
    `<img src="${escapeHtmlAttribute(toDetailRelativeAssetPath(previewPath))}" alt="网站预览">`,
    "</div>"
  ].join("");
}

function normalizePublishedAt(value: string): string {
  return value.includes("T") ? value.slice(0, 16).replace("T", " ") : value;
}

function formatDisplayUrl(url: string, fallback: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "") || fallback;
}
