import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichRecords } from "../src/core/enrichment";
import type { BookmarkAtlasData, BookmarkAtlasSettings } from "../src/types";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const vaultRoot = path.resolve(pluginRoot, "..", "..", "..");
const dataPath = path.join(pluginRoot, "data.json");

async function main() {
  const raw = await fs.readFile(dataPath, "utf8");
  const persisted = JSON.parse(raw) as {
    settings: BookmarkAtlasSettings;
    state: BookmarkAtlasData;
  };

  const issues: Parameters<typeof enrichRecords>[2] = [];
  const records = await enrichRecords(persisted.state.records, persisted.settings, issues);

  for (const record of records) {
    const detailPath = record.detailNotePath ?? record.notePath;
    if (!detailPath) {
      continue;
    }
    const absolutePath = path.join(vaultRoot, ...detailPath.split("/"));
    if (!(await exists(absolutePath))) {
      continue;
    }
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const rendered = replaceArticleSection(existingContent, record);
    if (rendered !== existingContent) {
      await fs.writeFile(absolutePath, rendered, "utf8");
    }
  }

  persisted.state.records = records;
  await fs.writeFile(dataPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

  process.stdout.write(JSON.stringify({
    ok: true,
    records: records.length,
    issues: issues.length
  }));
}

function replaceArticleSection(content: string, record: BookmarkAtlasData["records"][number]): string {
  const articleBlock = buildArticleBlock(record);
  if (content.includes("> [!bookmark-content] 正文提要")) {
    return content.replace(
      /> \[!bookmark-content\] 正文提要[\s\S]*?(?=\n\n> \[!bookmark-tags\])/m,
      articleBlock
    );
  }

  if (content.includes("> [!bookmark-signals] 访问判断")) {
    return content.replace(
      /(\> \[!bookmark-signals\] 访问判断[\s\S]*?)(?=\n\n> \[!bookmark-tags\])/m,
      `$1\n\n${articleBlock}`
    );
  }

  return content;
}

function buildArticleBlock(record: BookmarkAtlasData["records"][number]): string {
  if (!record.articleExcerpt && !record.articleMarkdown) {
    return [
      "> [!bookmark-content] 正文提要",
      "> - 暂未提取到可用正文。"
    ].join("\n");
  }

  const lines = [
    "> [!bookmark-content] 正文提要",
    ...(record.articleAuthor ? [`> - 作者：${escapeMarkdown(record.articleAuthor)}`] : []),
    ...(record.articlePublishedAt ? [`> - 发布时间：${escapeMarkdown(normalizePublishedAt(record.articlePublishedAt))}`] : []),
    ...(record.articleWordCount ? [`> - 正文字数：${String(record.articleWordCount)}`] : []),
    ...(record.articleExcerpt ? [">", `> ${escapeMarkdown(record.articleExcerpt)}`] : [])
  ];

  if (record.articleMarkdown) {
    lines.push("", "## 解析正文", "", record.articleMarkdown.trim());
  }

  return lines.join("\n");
}

function normalizePublishedAt(value: string): string {
  return value.includes("T") ? value.slice(0, 16).replace("T", " ") : value;
}

function escapeMarkdown(input: string): string {
  return input.replace(/[\\`*_{}\[\]()#+\-!|>]/g, "\\$&");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
