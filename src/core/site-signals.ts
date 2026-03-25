import type { AccessHint, AdRiskLevel, AvailabilityHint, BookmarkRecord, FetchStatus } from "../types";

const VPN_DOMAINS = [
  "google.com",
  "youtube.com",
  "github.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "openai.com",
  "anthropic.com",
  "wikipedia.org",
  "facebook.com",
  "instagram.com",
  "pornhub.com",
  "youporn.com",
  "huggingface.co",
  "discord.com",
  "telegram.org"
];

const DIRECT_DOMAINS = [
  "bilibili.com",
  "zhihu.com",
  "obsidian.md",
  "mi.com",
  "123pan.com",
  "qiniu.com",
  "52pojie.cn",
  "chaoxing.com"
];

const LOW_AD_DOMAINS = [
  "developer.mozilla.org",
  "docs.github.com",
  "obsidian.md",
  "openai.com",
  "anthropic.com",
  "wikipedia.org",
  "coursera.org",
  "edx.org",
  "support.google.com"
];

const HIGH_AD_DOMAINS = [
  "pornhub.com",
  "youporn.com",
  "52pojie.cn",
  "down.52pojie.cn",
  "gamebanana.com",
  "modrinth.com"
];

const HIGH_AD_KEYWORDS = [
  "破解",
  "广告",
  "弹窗",
  "成人视频",
  "porn",
  "download",
  "资源包",
  "整合包",
  "脚本",
  "网盘"
];

const MEDIUM_AD_KEYWORDS = [
  "download",
  "software",
  "tool",
  "mod",
  "stream",
  "video",
  "资源",
  "下载",
  "工具"
];

function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

export function inferAccessHint(domain: string): AccessHint {
  if (!domain) {
    return "unknown";
  }
  if (VPN_DOMAINS.some((candidate) => domainMatches(domain, candidate))) {
    return "may-need-vpn";
  }
  if (DIRECT_DOMAINS.some((candidate) => domainMatches(domain, candidate)) || domain.endsWith(".cn")) {
    return "direct";
  }
  return "unknown";
}

export function inferAccessHintFromRecord(record: Pick<BookmarkRecord, "domain" | "fetchStatus">): AccessHint {
  const byDomain = inferAccessHint(record.domain);
  if (byDomain !== "unknown") {
    return byDomain;
  }
  if (record.fetchStatus === "success") {
    return "direct";
  }
  return "unknown";
}

export function inferAvailability(fetchStatus: FetchStatus): AvailabilityHint {
  switch (fetchStatus) {
    case "success":
      return "reachable";
    case "failed":
      return "failed";
    case "timeout":
      return "timeout";
    case "unsupported":
      return "unsupported";
    default:
      return "unchecked";
  }
}

export function inferAdRisk(record: Pick<BookmarkRecord, "domain" | "title" | "description" | "category" | "url">): AdRiskLevel {
  if (!record.domain) {
    return "unknown";
  }
  if (LOW_AD_DOMAINS.some((candidate) => domainMatches(record.domain, candidate))) {
    return "low";
  }
  if (HIGH_AD_DOMAINS.some((candidate) => domainMatches(record.domain, candidate))) {
    return "high";
  }

  const haystack = [record.title, record.description, record.url, record.category].join(" ").toLowerCase();
  const highMatches = HIGH_AD_KEYWORDS.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  if (highMatches >= 2) {
    return "high";
  }
  const mediumMatches = MEDIUM_AD_KEYWORDS.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  if (highMatches >= 1 || mediumMatches >= 2) {
    return "medium";
  }
  return "unknown";
}

export function inferLikelyDead(record: Pick<BookmarkRecord, "fetchStatus" | "qualityFlags">): boolean {
  return record.fetchStatus === "failed"
    || record.fetchStatus === "timeout"
    || record.qualityFlags.includes("invalid-url");
}

export function applyDerivedSignals(record: BookmarkRecord): BookmarkRecord {
  return {
    ...record,
    accessHint: record.accessHint ?? inferAccessHintFromRecord(record),
    availability: record.availability ?? inferAvailability(record.fetchStatus),
    adRisk: record.adRisk ?? inferAdRisk(record),
    isLikelyDead: record.isLikelyDead ?? inferLikelyDead(record)
  };
}
