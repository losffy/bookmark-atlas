import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";
import type { BookmarkAtlasSettings, BookmarkRecord, ImportIssue } from "../types";
import { extractArticleContent } from "./article-extractor";
import { applyDerivedSignals } from "./site-signals";
import { cleanText, truncate } from "./utils";

export async function enrichRecords(records: BookmarkRecord[], settings: BookmarkAtlasSettings, issues: ImportIssue[]): Promise<BookmarkRecord[]> {
  if (!settings.enableRemoteEnrichment) {
    return records.map((record) => applyDerivedSignals({
      ...record,
      fetchStatus: "skipped"
    }));
  }

  const queue = [...records];
  const enriched = new Map<string, BookmarkRecord>();
  const concurrency = Math.max(1, settings.maxFetchConcurrency);

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        return;
      }
      enriched.set(current.id, await enrichSingleRecord(current, settings, issues));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return records.map((record) => enriched.get(record.id) ?? record);
}

async function enrichSingleRecord(record: BookmarkRecord, settings: BookmarkAtlasSettings, issues: ImportIssue[]): Promise<BookmarkRecord> {
  if (!/^https?:\/\//i.test(record.url)) {
    return applyDerivedSignals({
      ...record,
      fetchStatus: "unsupported"
    });
  }

  const controller = new AbortController();
  const timeoutHandle = globalThis.setTimeout(() => controller.abort(), settings.fetchTimeoutMs);
  try {
    const response = await fetch(record.url, {
      signal: controller.signal
    });

    if (!response.ok) {
      issues.push({
        level: "warning",
        code: "fetch-failed",
        message: `抓取 ${record.url} 失败，状态码 ${response.status}`,
        recordId: record.id,
        dedupeKey: record.dedupeKey
      });
      return applyDerivedSignals({
        ...record,
        fetchStatus: "failed"
      });
    }

    const html = truncate(await response.text(), 300_000);
    const parsed = parse(html);
    const fetchedTitle = cleanText(parsed.querySelector("title")?.text ?? "");
    const metaDescription = extractMetaValue(parsed, ["description", "og:description", "twitter:description"]);
    const siteName = extractMetaValue(parsed, ["og:site_name", "application-name"]) || record.siteName || record.domain;
    const iconHref = resolveUrl(response.url, extractIconHref(parsed));
    const article = await safelyExtractArticleContent(html, response.url, record, issues);

    return applyDerivedSignals({
      ...record,
      title: shouldReplaceTitle(record.title, article?.title || fetchedTitle) ? (article?.title || fetchedTitle) : record.title,
      description: article?.description || metaDescription || record.description,
      siteName: article?.site || siteName,
      articleExcerpt: article?.excerpt || record.articleExcerpt,
      articleMarkdown: article?.markdown || record.articleMarkdown,
      articleWordCount: article?.wordCount || record.articleWordCount,
      articleAuthor: article?.author || record.articleAuthor,
      articlePublishedAt: article?.publishedAt || record.articlePublishedAt,
      articleSite: article?.site || record.articleSite,
      favicon: iconHref || record.favicon,
      fetchStatus: article || metaDescription || fetchedTitle || siteName ? "success" : "failed"
    });
  } catch (error) {
    const timeoutLike = error instanceof Error && error.name === "AbortError";
    issues.push({
      level: "warning",
      code: timeoutLike ? "fetch-timeout" : "fetch-error",
      message: timeoutLike ? `抓取 ${record.url} 超时` : `抓取 ${record.url} 出错：${error instanceof Error ? error.message : String(error)}`,
      recordId: record.id,
      dedupeKey: record.dedupeKey
    });
    return applyDerivedSignals({
      ...record,
      fetchStatus: timeoutLike ? "timeout" : "failed"
    });
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

async function safelyExtractArticleContent(
  html: string,
  url: string,
  record: BookmarkRecord,
  issues: ImportIssue[]
) {
  try {
    return await extractArticleContent(html, url);
  } catch (error) {
    issues.push({
      level: "warning",
      code: "article-extract-failed",
      message: `解析正文失败：${error instanceof Error ? error.message : String(error)}`,
      recordId: record.id,
      dedupeKey: record.dedupeKey
    });
    return null;
  }
}

function extractMetaValue(root: HTMLElement, names: string[]): string {
  const lowered = names.map((name) => name.toLowerCase());
  for (const meta of root.querySelectorAll("meta")) {
    const name = cleanText(meta.getAttribute("name") ?? meta.getAttribute("property")).toLowerCase();
    if (!lowered.includes(name)) {
      continue;
    }
    const content = cleanText(meta.getAttribute("content"));
    if (content) {
      return truncate(content, 240);
    }
  }
  return "";
}

function extractIconHref(root: HTMLElement): string {
  for (const link of root.querySelectorAll("link")) {
    const rel = cleanText(link.getAttribute("rel")).toLowerCase();
    if (!rel.includes("icon")) {
      continue;
    }
    const href = cleanText(link.getAttribute("href"));
    if (href) {
      return href;
    }
  }
  return "";
}

function resolveUrl(baseUrl: string, candidate: string): string {
  if (!candidate) {
    return "";
  }
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

function shouldReplaceTitle(currentTitle: string, fetchedTitle: string): boolean {
  if (!fetchedTitle) {
    return false;
  }
  return !currentTitle || currentTitle === "Untitled" || currentTitle.startsWith("http");
}
