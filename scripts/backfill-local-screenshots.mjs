import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const vaultRoot = path.resolve(pluginRoot, "..", "..", "..");
const dataPath = path.join(pluginRoot, "data.json");
const captureScriptPath = path.join(scriptDir, "capture-screenshot.mjs");
const screenshotsRoot = path.join(vaultRoot, "Bookmarks", "Assets", "Screenshots");
const previewsRoot = path.join(vaultRoot, "Bookmarks", "Assets", "Previews");
const importDataStart = "<!-- BOOKMARK-ATLAS:IMPORT-DATA:BEGIN";
const importDataEnd = "BOOKMARK-ATLAS:IMPORT-DATA:END -->";
const existingOnly = process.argv.includes("--existing-only");
const concurrency = 2;
const minValidScreenshotBytes = 6000;

async function main() {
  await fs.mkdir(screenshotsRoot, { recursive: true });
  await fs.mkdir(previewsRoot, { recursive: true });

  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const records = data?.state?.records ?? [];
  const timeoutMs = Number(data?.settings?.screenshotTimeoutMs) || 12000;

  let updatedCount = 0;
  let capturedCount = 0;
  let screenshotCount = 0;
  let previewCardCount = 0;

  const queue = [...records];

  async function worker() {
    while (queue.length > 0) {
      const record = queue.shift();
      if (!record) {
        return;
      }
      const result = await processRecord(record, timeoutMs);
      if (!result.changed) {
        continue;
      }
      updatedCount += 1;
      if (result.mode === "captured") {
        capturedCount += 1;
      }
      if (result.mode === "screenshot") {
        screenshotCount += 1;
      }
      if (result.mode === "preview-card") {
        previewCardCount += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await updateImportPayloads(data);

  process.stdout.write(JSON.stringify({
    ok: true,
    records: records.length,
    updated: updatedCount,
    captured: capturedCount,
    screenshots: screenshotCount,
    previewCards: previewCardCount
  }));
}

async function processRecord(record, timeoutMs) {
  const screenshotPath = preferredScreenshotPath(record);
  const screenshotAbsolutePath = path.join(vaultRoot, ...screenshotPath.split("/"));

  if (await isUsableScreenshot(screenshotAbsolutePath)) {
    const changed = applyScreenshotState(record, screenshotPath);
    await updateDetailNote(record);
    return { changed, mode: "screenshot" };
  }

  if (/^https?:\/\//i.test(record?.url || "") && !existingOnly) {
    try {
      const { stdout, stderr } = await execFileAsync(
        "node",
        [captureScriptPath, record.url, screenshotAbsolutePath, String(timeoutMs)],
        {
          cwd: pluginRoot,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );
      const payload = tryParseJson(`${stdout}\n${stderr}`);
      if (payload?.ok && await isUsableScreenshot(screenshotAbsolutePath)) {
        const changed = applyScreenshotState(record, screenshotPath);
        await updateDetailNote(record);
        return { changed, mode: "captured" };
      }
      const changed = await applyPreviewCardState(record, payload?.message === "blank-page" ? "failed" : "timeout");
      await updateDetailNote(record);
      return { changed, mode: "preview-card" };
    } catch {
      const changed = await applyPreviewCardState(record, "failed");
      await updateDetailNote(record);
      return { changed, mode: "preview-card" };
    }
  }

  const changed = await applyPreviewCardState(record, /^https?:\/\//i.test(record?.url || "") ? "failed" : "unsupported");
  await updateDetailNote(record);
  return { changed, mode: "preview-card" };
}

function applyScreenshotState(record, screenshotPath) {
  let changed = false;
  changed = assign(record, "screenshotPath", screenshotPath) || changed;
  changed = assign(record, "previewAssetPath", screenshotPath) || changed;
  changed = assign(record, "previewKind", "live-screenshot") || changed;
  changed = assign(record, "previewStatus", "ready") || changed;
  changed = assign(record, "fetchStatus", "success") || changed;
  changed = assign(record, "availability", "reachable") || changed;
  return changed;
}

async function applyPreviewCardState(record, fetchStatus) {
  const previewAssetPath = preferredPreviewPath(record);
  const absolutePreviewPath = path.join(vaultRoot, ...previewAssetPath.split("/"));
  await fs.mkdir(path.dirname(absolutePreviewPath), { recursive: true });
  await fs.writeFile(absolutePreviewPath, renderPreviewCardSvg(record), "utf8");

  let changed = false;
  changed = assign(record, "previewAssetPath", previewAssetPath) || changed;
  changed = assign(record, "previewKind", "local-preview-card") || changed;
  changed = assign(record, "previewStatus", "fallback") || changed;
  changed = assign(record, "fetchStatus", fetchStatus) || changed;
  changed = assign(record, "availability", fetchStatus === "timeout" ? "timeout" : fetchStatus === "unsupported" ? "unsupported" : "failed") || changed;
  return changed;
}

async function updateDetailNote(record) {
  const notePath = record.detailNotePath || record.notePath;
  if (!notePath) {
    return;
  }

  const absoluteNotePath = path.join(vaultRoot, ...notePath.split("/"));
  if (!(await exists(absoluteNotePath))) {
    return;
  }

  const original = await fs.readFile(absoluteNotePath, "utf8");
  const previewPath = record.previewAssetPath || record.screenshotPath;
  if (!previewPath) {
    return;
  }
  const previewLabel = record.previewKind === "live-screenshot" ? "真实网站截图" : "本地站点预览卡";
  const previewBlock = [
    "## 网站预览",
    "",
    `![网站预览](<${toDetailRelativeAssetPath(previewPath)}>)`,
    "",
    `_${previewLabel}_`
  ].join("\n");

  let next = original.replace(
    /## 网站预览[\s\S]*?(?=\n> \[!bookmark-info\])/m,
    previewBlock
  );

  next = next.replace(/^> - 预览来源：.*$/m, `> - 预览来源：${previewLabel}`);

  if (next !== original) {
    await fs.writeFile(absoluteNotePath, next, "utf8");
  }
}

async function updateImportPayloads(data) {
  const generatedNotes = data?.state?.generatedNotes ?? [];
  const recordsByPath = new Map();

  for (const record of data?.state?.records ?? []) {
    const summaryPath = record.summaryNotePath;
    if (!summaryPath) {
      continue;
    }
    const list = recordsByPath.get(summaryPath) ?? [];
    list.push(record);
    recordsByPath.set(summaryPath, list);
  }

  for (const note of generatedNotes) {
    const absoluteNotePath = path.join(vaultRoot, ...String(note.path).split("/"));
    if (!(await exists(absoluteNotePath))) {
      continue;
    }
    const current = await fs.readFile(absoluteNotePath, "utf8");
    const records = recordsByPath.get(note.path) ?? [];
    const payload = JSON.stringify({ note, records });
    const next = current.replace(
      new RegExp(`${escapeRegExp(importDataStart)}\\n[\\s\\S]*?\\n${escapeRegExp(importDataEnd)}`),
      `${importDataStart}\n${payload}\n${importDataEnd}`
    );
    if (next !== current) {
      await fs.writeFile(absoluteNotePath, next, "utf8");
    }
  }
}

function preferredScreenshotPath(record) {
  if (record?.screenshotPath && /\.(jpe?g|webp)$/i.test(record.screenshotPath)) {
    return normalizeSlashes(record.screenshotPath);
  }
  if (record?.screenshotPath && /\.png$/i.test(record.screenshotPath)) {
    return normalizeSlashes(record.screenshotPath.replace(/\.png$/i, ".jpg"));
  }
  const title = slugify(record?.title || "bookmark");
  const shortId = hashString(record?.dedupeKey || record?.url || title).slice(0, 8);
  return normalizeSlashes(`Bookmarks/Assets/Screenshots/${title}--${shortId}.jpg`);
}

function preferredPreviewPath(record) {
  if (record?.previewAssetPath) {
    return normalizeSlashes(record.previewAssetPath);
  }
  const title = slugify(record?.title || "bookmark");
  const shortId = hashString(record?.dedupeKey || record?.url || title).slice(0, 8);
  return normalizeSlashes(`Bookmarks/Assets/Previews/${title}--${shortId}.svg`);
}

function toDetailRelativeAssetPath(assetPath) {
  const normalized = normalizeSlashes(assetPath);
  const marker = "Bookmarks/";
  const index = normalized.indexOf(marker);
  const scoped = index >= 0 ? normalized.slice(index + marker.length) : normalized;
  return `../${scoped}`;
}

async function isUsableScreenshot(targetPath) {
  if (!(await exists(targetPath))) {
    return false;
  }
  const stat = await fs.stat(targetPath);
  return stat.size >= minValidScreenshotBytes;
}

function assign(object, key, value) {
  if (object[key] === value) {
    return false;
  }
  object[key] = value;
  return true;
}

function renderPreviewCardSvg(record) {
  const title = escapeXml(truncate(record.title || record.siteName || record.domain || "Bookmark", 72));
  const domain = escapeXml(record.domain || "unknown-site");
  const description = escapeXml(truncate(record.description || "Imported bookmark preview", 120));
  const category = escapeXml(record.category || "未分类");
  const source = escapeXml(`${record.sourceBrowser} / ${record.sourceFormat}`);
  const status = escapeXml(resolveStatusLabel(record));
  const access = escapeXml(resolveAccessLabel(record));
  const monogram = escapeXml((record.siteName || record.domain || record.title || "?").trim().slice(0, 1).toUpperCase());
  const tags = Array.isArray(record.tags) ? record.tags.slice(0, 3) : [];
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

function resolveStatusLabel(record) {
  if (record.fetchStatus === "success" || record.availability === "reachable") {
    return "已生成预览";
  }
  if (record.fetchStatus === "timeout" || record.availability === "timeout") {
    return "超时回退";
  }
  if (record.fetchStatus === "unsupported") {
    return "非网页回退";
  }
  return "受限页回退";
}

function resolveAccessLabel(record) {
  if (record.accessHint === "may-need-vpn") {
    return "可能需要代理";
  }
  if (record.accessHint === "direct") {
    return "通常可直连";
  }
  return "访问状态待验证";
}

function escapeXml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashString(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function slugify(input) {
  const clean = String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "bookmark";
}

function truncate(input, maxLength) {
  if (String(input).length <= maxLength) {
    return String(input);
  }
  return `${String(input).slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryParseJson(input) {
  try {
    return JSON.parse(String(input || "").trim());
  } catch {
    return null;
  }
}

async function exists(targetPath) {
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
