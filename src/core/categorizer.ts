import { CATEGORY_ORDER } from "./constants";
import { cleanText, truncate, uniqueStrings } from "./utils";
import type { BookmarkRecord } from "../types";

interface CategoryRule {
  category: (typeof CATEGORY_ORDER)[number];
  keywords: string[];
  domains: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: "开发", keywords: ["dev", "developer", "api", "frontend", "backend", "programming", "javascript", "typescript", "python", "java", "rust", "golang", "前端", "后端", "编程", "开发", "源码", "sdk"], domains: ["gitlab.com", "stackexchange.com", "stackoverflow.com", "developer.mozilla.org", "docs.github.com"] },
  { category: "设计", keywords: ["design", "figma", "dribbble", "ux", "ui", "字体", "配色", "原型", "设计", "插画", "壁纸", "美图"], domains: ["figma.com", "dribbble.com", "behance.net", "mikagogo.com"] },
  { category: "AI", keywords: ["ai", "llm", "openai", "anthropic", "prompt", "模型", "智能", "机器学习", "深度学习", "豆包", "coze", "marscode", "siliconflow", "sovits", "chatgpt", "gpt"], domains: ["openai.com", "anthropic.com", "huggingface.co", "doubao.com", "coze.cn", "siliconflow.cn", "marscode.cn", "chatmind.tech"] },
  { category: "学习", keywords: ["course", "learn", "tutorial", "guide", "study", "lesson", "学习", "教程", "课程", "图书馆", "文献", "论文", "小说", "阅读", "webvpn", "超星"], domains: ["coursera.org", "udemy.com", "edx.org", "khanacademy.org", "chaoxing.com", "sci-hub.org.cn", "fanqienovel.com", "zlibrary", "ujn.edu.cn"] },
  { category: "资讯", keywords: ["news", "blog", "article", "post", "资讯", "新闻", "博客", "头条", "知乎", "专注", "关于"], domains: ["medium.com", "news.ycombinator.com", "theverge.com", "toutiao.com", "zhihu.com", "zmingcx.com", "myql.eu.org"] },
  { category: "工具", keywords: ["tool", "app", "software", "download", "工具", "软件", "插件", "网盘", "对象存储", "文件管理", "下载器", "修改器", "脚本", "规则", "tampermonkey", "驱动", "base64", "云盘", "控制台", "dashboard"], domains: ["notion.so", "obsidian.md", "raycast.com", "52pojie.cn", "123pan.com", "vlink.cc", "qiniu.com", "tampermonkey.net", "down.52pojie.cn", "lddgo.net", "cloudflare.com", "mi.com", "google.com"] },
  { category: "文档", keywords: ["docs", "documentation", "reference", "manual", "文档", "参考"], domains: ["developer.mozilla.org", "docs.python.org", "docs.github.com"] },
  { category: "购物", keywords: ["shop", "buy", "deal", "cart", "购物", "购买"], domains: ["amazon.com", "taobao.com", "jd.com"] },
  { category: "娱乐", keywords: ["video", "music", "movie", "stream", "娱乐", "影视", "游戏", "动漫", "番剧", "acg", "mod", "资源包", "整合包", "动画", "二次元", "成人视频"], domains: ["youtube.com", "bilibili.com", "netflix.com", "spotify.com", "mikanani.me", "gamebanana.com", "modrinth.com", "anime1.me", "cycanime.com", "pornhub.com", "youporn.com", "animerep.com", "acg.rip", "agedm66.com", "zkk79.com"] },
  { category: "社交", keywords: ["social", "community", "forum", "chat", "社交", "社区", "论坛", "arca", "nga"], domains: ["reddit.com", "x.com", "twitter.com", "weibo.com", "arca.live", "nga.cn", "52pojie.cn"] },
  { category: "工作流", keywords: ["automation", "workflow", "productivity", "kanban", "任务", "流程", "效率", "幕布", "防迷路", "sway"], domains: ["zapier.com", "ifttt.com", "trello.com", "asana.com", "mubu.com", "sway.cloud.microsoft"] }
];

const DOMAIN_TAGS = new Map<string, string>([
  ["github.com", "github"],
  ["youtube.com", "video"],
  ["bilibili.com", "video"],
  ["developer.mozilla.org", "mdn"],
  ["wikipedia.org", "reference"],
  ["obsidian.md", "obsidian"],
  ["openai.com", "openai"],
  ["doubao.com", "ai"],
  ["coze.cn", "ai"],
  ["123pan.com", "网盘"],
  ["qiniu.com", "云服务"],
  ["tampermonkey.net", "脚本"],
  ["mikanani.me", "动漫"],
  ["gamebanana.com", "mod"],
  ["modrinth.com", "mod"],
  ["fanqienovel.com", "阅读"],
  ["chaoxing.com", "学习"],
  ["cloudflare.com", "云服务"],
  ["douyin.com", "视频"],
  ["anime1.me", "动漫"],
  ["acg.rip", "动漫"],
  ["toutiao.com", "资讯"],
  ["zhihu.com", "资讯"]
]);

const CONTENT_TAG_RULES: Array<{ tag: string; keywords: string[] }> = [
  { tag: "docs", keywords: ["docs", "documentation", "reference", "文档", "参考"] },
  { tag: "tutorial", keywords: ["tutorial", "guide", "learn", "教程", "学习"] },
  { tag: "blog", keywords: ["blog", "article", "post", "博客", "文章"] },
  { tag: "tool", keywords: ["tool", "app", "software", "工具", "软件"] },
  { tag: "video", keywords: ["video", "watch", "播放", "视频"] },
  { tag: "api", keywords: ["api", "sdk", "endpoint"] },
  { tag: "动漫", keywords: ["动漫", "番剧", "acg", "anime"] },
  { tag: "网盘", keywords: ["网盘", "云盘", "对象存储", "文件管理"] },
  { tag: "文献", keywords: ["文献", "论文", "sci-hub"] },
  { tag: "mod", keywords: ["mod", "资源包", "整合包"] },
  { tag: "云服务", keywords: ["cloudflare", "对象存储", "控制台", "dashboard"] },
  { tag: "社区", keywords: ["社区", "论坛", "讨论", "频道"] }
];

const SPECIAL_DOMAIN_CATEGORIES: Array<{ domains: string[]; category: string; tags?: string[] }> = [
  { domains: ["doubao.com", "coze.cn", "siliconflow.cn", "marscode.cn", "chatmind.tech"], category: "AI", tags: ["ai"] },
  { domains: ["mikanani.me", "cycanime.com", "animerep.com", "anime.b168.net", "anime1.me", "acg.rip", "agedm66.com", "zkk79.com"], category: "娱乐", tags: ["动漫"] },
  { domains: ["fanqienovel.com", "sci-hub.org.cn", "chaoxing.com", "webvpn.ujn.edu.cn", "alhs.live"], category: "学习", tags: ["学习"] },
  { domains: ["123pan.com", "vlink.cc", "qiniu.com", "tampermonkey.net", "52pojie.cn", "down.52pojie.cn", "lddgo.net", "mi.com", "cloudflare.com", "kkidc.com"], category: "工具", tags: ["工具"] },
  { domains: ["gamebanana.com", "modrinth.com", "pornhub.com", "youporn.com", "douyin.com"], category: "娱乐", tags: ["视频"] },
  { domains: ["toutiao.com", "zhihu.com"], category: "资讯", tags: ["资讯"] },
  { domains: ["weibo.com", "arca.live", "nga.cn", "2612x.xyz"], category: "社交", tags: ["社区"] },
  { domains: ["mubu.com", "sway.cloud.microsoft"], category: "工作流", tags: ["效率"] },
  { domains: ["mikagogo.com"], category: "设计", tags: ["插画"] }
];

function matchingScore(rule: CategoryRule, haystack: string, domain: string): number {
  let score = 0;
  for (const keyword of rule.keywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      score += 2;
    }
  }
  for (const candidate of rule.domains) {
    if (domain === candidate || domain.endsWith(`.${candidate}`)) {
      score += 3;
    }
  }
  return score;
}

function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

function hasKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function categorizeBookmark(record: Pick<BookmarkRecord, "title" | "url" | "domain" | "folderPath">): { category: string; tags: string[] } {
  const haystack = [record.title, record.url, record.folderPath.join(" / ")]
    .map((value) => cleanText(value).toLowerCase())
    .join(" ");

  const tags: string[] = [];

  for (const special of SPECIAL_DOMAIN_CATEGORIES) {
    if (special.domains.some((candidate) => domainMatches(record.domain, candidate))) {
      tags.push(...(special.tags ?? []), special.category);
      return { category: special.category, tags: uniqueStrings(tags) };
    }
  }

  if (domainMatches(record.domain, "github.com")) {
    if (hasKeyword(haystack, ["mod", "脚本", "规则", "downloader", "tool", "resource pack", "下载", "修改器"])) {
      tags.push("github", "tool");
      return { category: "工具", tags: uniqueStrings([...tags, "工具"]) };
    }
    tags.push("github");
  }

  let category = "未分类";
  let bestScore = 0;
  for (const rule of CATEGORY_RULES) {
    const score = matchingScore(rule, haystack, record.domain.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      category = rule.category;
    }
  }

  for (const [knownDomain, tag] of DOMAIN_TAGS) {
    if (domainMatches(record.domain, knownDomain)) {
      tags.push(tag);
    }
  }

  for (const rule of CONTENT_TAG_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      tags.push(rule.tag);
    }
  }

  for (const segment of record.folderPath) {
    const normalized = cleanText(segment).toLowerCase();
    if (normalized && normalized.length <= 24) {
      tags.push(normalized);
    }
  }

  tags.push(category);
  return { category, tags: uniqueStrings(tags) };
}

export function buildTemplateDescription(record: Pick<BookmarkRecord, "title" | "domain" | "folderPath" | "category" | "tags">): string {
  const domainPart = record.domain ? `来自 ${record.domain}` : "来自导入书签";
  const folderPart = record.folderPath.length > 0 ? `，原位于 ${record.folderPath.join(" / ")}` : "";
  const tagPart = record.tags.length > 0 ? `，可归入 ${record.tags.slice(0, 3).join("、")}` : "";
  const intro = record.category === "未分类" ? "待进一步整理的资源" : `${record.category}类资源`;
  return truncate(`${domainPart} 的 ${intro}${folderPart}${tagPart}。当前标题为“${record.title}”。`, 180);
}
