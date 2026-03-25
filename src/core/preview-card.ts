import { normalizePath } from "obsidian";
import type { BookmarkRecord } from "../types";
import { hashString, slugify, truncate } from "./utils";

export function buildPreviewCardPath(rootFolder: string, record: BookmarkRecord): string {
  const shortId = hashString(record.dedupeKey).slice(0, 8);
  return normalizePath(`${rootFolder}/Assets/Previews/${slugify(record.title)}--${shortId}.svg`);
}

export function renderPreviewCardSvg(record: BookmarkRecord): string {
  const title = escapeXml(truncate(record.title || record.siteName || record.domain || "Bookmark", 72));
  const domain = escapeXml(record.domain || "unknown-site");
  const description = escapeXml(truncate(record.description || "Imported bookmark preview", 120));
  const category = escapeXml(record.category || "未分类");
  const source = escapeXml(`${record.sourceBrowser} / ${record.sourceFormat}`);
  const status = escapeXml(resolveStatusLabel(record));
  const access = escapeXml(resolveAccessLabel(record));
  const monogram = escapeXml((record.siteName || record.domain || record.title || "?").trim().slice(0, 1).toUpperCase());
  const tags = record.tags.slice(0, 3);
  const tagMarkup = tags.map((tag, index) => {
    const x = 72 + index * 148;
    return `
      <g transform="translate(${x} 520)">
        <rect width="132" height="42" rx="21" fill="rgba(20,39,49,0.08)" stroke="rgba(20,39,49,0.08)" />
        <text x="66" y="27" text-anchor="middle" font-size="18" font-weight="600" fill="#16444a">${escapeXml(truncate(tag, 10))}</text>
      </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6f1e6" />
      <stop offset="52%" stop-color="#ece8db" />
      <stop offset="100%" stop-color="#e4eced" />
    </linearGradient>
    <radialGradient id="orbA" cx="0%" cy="0%" r="100%">
      <stop offset="0%" stop-color="rgba(25, 124, 117, 0.30)" />
      <stop offset="100%" stop-color="rgba(25, 124, 117, 0)" />
    </radialGradient>
    <radialGradient id="orbB" cx="100%" cy="0%" r="100%">
      <stop offset="0%" stop-color="rgba(198, 139, 39, 0.24)" />
      <stop offset="100%" stop-color="rgba(198, 139, 39, 0)" />
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.74)" />
      <stop offset="100%" stop-color="rgba(255,248,240,0.52)" />
    </linearGradient>
    <linearGradient id="ink" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#103e43" />
      <stop offset="100%" stop-color="#b16d1b" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="rgba(45, 58, 52, 0.14)" />
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)" />
  <circle cx="140" cy="110" r="220" fill="url(#orbA)" />
  <circle cx="1130" cy="140" r="240" fill="url(#orbB)" />
  <g filter="url(#shadow)">
    <rect x="44" y="40" width="1192" height="640" rx="40" fill="url(#glass)" stroke="rgba(65,82,74,0.12)" />
  </g>
  <text x="74" y="104" font-size="22" font-weight="700" letter-spacing="7" fill="#146562">BOOKMARK ATLAS</text>
  <rect x="72" y="132" width="96" height="96" rx="28" fill="rgba(255,255,255,0.68)" stroke="rgba(18,72,76,0.12)" />
  <text x="120" y="194" text-anchor="middle" font-size="46" font-weight="700" fill="#13565c">${monogram}</text>
  <text x="196" y="168" font-size="26" font-weight="700" fill="#52615a">${domain}</text>
  <text x="196" y="212" font-size="58" font-weight="800" fill="url(#ink)">${title}</text>
  <text x="74" y="314" font-size="28" font-weight="500" fill="#2b3936">${description}</text>
  <g transform="translate(72 368)">
    <rect width="170" height="54" rx="27" fill="rgba(20,39,49,0.08)" />
    <text x="85" y="34" text-anchor="middle" font-size="22" font-weight="700" fill="#16444a">${category}</text>
  </g>
  <g transform="translate(260 368)">
    <rect width="188" height="54" rx="27" fill="rgba(20,39,49,0.08)" />
    <text x="94" y="34" text-anchor="middle" font-size="22" font-weight="700" fill="#16444a">${status}</text>
  </g>
  <g transform="translate(466 368)">
    <rect width="222" height="54" rx="27" fill="rgba(20,39,49,0.08)" />
    <text x="111" y="34" text-anchor="middle" font-size="22" font-weight="700" fill="#16444a">${access}</text>
  </g>
  <g transform="translate(72 452)">
    <rect width="1136" height="180" rx="28" fill="rgba(255,255,255,0.54)" stroke="rgba(20,39,49,0.08)" />
    <text x="42" y="56" font-size="22" font-weight="700" fill="#5f6e65">来源</text>
    <text x="42" y="96" font-size="30" font-weight="600" fill="#162a2b">${source}</text>
    <text x="42" y="142" font-size="22" font-weight="700" fill="#5f6e65">书签说明</text>
    <text x="42" y="174" font-size="24" font-weight="500" fill="#213432">${escapeXml(truncate(record.description || "Imported bookmark", 92))}</text>
  </g>
  ${tagMarkup}
</svg>`;
}

function resolveStatusLabel(record: BookmarkRecord): string {
  if (record.fetchStatus === "success" || record.availability === "reachable") {
    return "已生成预览";
  }
  if (record.fetchStatus === "failed") {
    return "受限页回退";
  }
  if (record.fetchStatus === "timeout" || record.availability === "timeout") {
    return "超时回退";
  }
  return "本地预览卡";
}

function resolveAccessLabel(record: BookmarkRecord): string {
  if (record.accessHint === "may-need-vpn") {
    return "可能需要代理";
  }
  if (record.accessHint === "direct") {
    return "通常可直连";
  }
  return "访问状态待验证";
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
