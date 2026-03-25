import type { BookmarkRecord, GeneratedNoteSummary } from "../../types";
import {
  USER_NOTES_HEADING,
  buildDetailFrontmatter,
  escapeMarkdown,
  formatAccessHint,
  formatAdRisk,
  formatAvailability,
  formatPreviewSource,
  inlinePill,
  toDetailRelativeAssetPath
} from "./render-shared";

export function renderDetailNote(record: BookmarkRecord, _summaryNote: GeneratedNoteSummary, userNotes: string): string {
  const frontmatter = buildDetailFrontmatter(record);

  const heroLines = [
    "> [!bookmark-hero] 站点卡片",
    ...(record.favicon ? [`> ![56](${record.favicon})`] : []),
    `> **${escapeMarkdown(record.siteName || record.title)}**`,
    `> [打开网站](${record.url})`,
    `> ${inlinePill(record.domain || "未知域名")} ${inlinePill(record.category || "未分类")} ${inlinePill(`${record.sourceBrowser} / ${record.sourceFormat}`)}`,
    ">",
    `> ${escapeMarkdown(record.description)}`
  ];

  const previewLines = [
    "## 网站预览",
    "",
    ...((record.previewAssetPath ?? record.screenshotPath)
      ? [
        `![网站预览](<${toDetailRelativeAssetPath(record.previewAssetPath ?? record.screenshotPath ?? "")}>)`,
        "",
        `_${escapeMarkdown(formatPreviewSource(record))}_`
      ]
      : ["_本地预览尚未生成。_"])
  ];

  const infoLines = [
    "> [!bookmark-info] 网站信息",
    `> - 站点标题：${escapeMarkdown(record.title)}`,
    `> - 站点名称：${escapeMarkdown(record.siteName || record.domain || "未知")}`,
    `> - 来源站点：${escapeMarkdown(record.domain || "未知域名")}`,
    `> - 加入时间：${escapeMarkdown(record.createdAt ? record.createdAt.slice(0, 10) : "未知")}`,
    `> - 导入时间：${escapeMarkdown(record.importedAt.slice(0, 16).replace("T", " "))}`,
    `> - 预览来源：${escapeMarkdown(formatPreviewSource(record))}`
  ];

  const signalLines = [
    "> [!bookmark-signals] 访问判断",
    `> - 访问状态：${escapeMarkdown(formatAvailability(record.availability))}`,
    `> - 访问提示：${escapeMarkdown(formatAccessHint(record.accessHint))}`,
    `> - 失效风险：${escapeMarkdown(record.isLikelyDead ? "可能失效" : "暂未发现失效")}`,
    `> - 广告风险：${escapeMarkdown(formatAdRisk(record.adRisk))}`
  ];

  const tagLines = [
    "> [!bookmark-tags] 标签与目录",
    `> - 标签：${escapeMarkdown(record.tags.length > 0 ? record.tags.join("、") : "暂无")}`,
    `> - 原始目录：${escapeMarkdown(record.folderPath.length > 0 ? record.folderPath.join(" / ") : "未设置")}`
  ];

  return [
    "---",
    frontmatter,
    "---",
    "",
    `# ${record.title}`,
    "",
    ...heroLines,
    "",
    ...previewLines,
    "",
    ...infoLines,
    "",
    ...signalLines,
    "",
    ...tagLines,
    "",
    USER_NOTES_HEADING,
    "",
    userNotes || "_在这里补充你的判断、用途、收藏理由和后续动作。_",
    ""
  ].join("\n");
}
