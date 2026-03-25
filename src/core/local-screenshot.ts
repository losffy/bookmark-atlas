import { App, normalizePath } from "obsidian";
import type { BookmarkAtlasSettings, BookmarkRecord } from "../types";
import { applyDerivedSignals } from "./site-signals";
import { buildPreviewCardPath, renderPreviewCardSvg } from "./preview-card";
import { hashString, slugify } from "./utils";

interface NodeRuntime {
  childProcess: {
    execFile: (
      file: string,
      args: string[],
      options: { cwd?: string; windowsHide?: boolean },
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => void;
  };
  fs: {
    existsSync: (path: string) => boolean;
    mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
    writeFileSync: (path: string, content: string, encoding: string) => void;
    statSync: (path: string) => { size: number };
  };
  path: {
    isAbsolute: (path: string) => boolean;
    join: (...parts: string[]) => string;
    normalize: (path: string) => string;
    dirname: (path: string) => string;
  };
}

interface CaptureResult {
  ok: boolean;
  blank?: boolean;
  message?: string;
}

const MIN_VALID_SCREENSHOT_BYTES = 6_000;

export async function captureLocalScreenshots(
  app: App,
  pluginDir: string,
  settings: BookmarkAtlasSettings,
  records: BookmarkRecord[]
): Promise<BookmarkRecord[]> {
  if (!settings.enableLocalScreenshots) {
    return records.map((record) => ensurePreviewCardForDisabledScreenshots(app, settings, record));
  }

  const runtime = getNodeRuntime();
  const basePath = getVaultBasePath(app);
  if (!runtime || !basePath) {
    return records;
  }
  const activeRuntime = runtime;
  const activeBasePath = basePath;

  const queue = [...records];
  const updated = new Map<string, BookmarkRecord>();
  const concurrency = Math.max(1, Math.min(2, settings.maxFetchConcurrency));

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        return;
      }
      updated.set(current.id, await captureSingle(activeRuntime, pluginDir, activeBasePath, settings, current));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return records.map((record) => updated.get(record.id) ?? record);
}

function ensurePreviewCardForDisabledScreenshots(
  app: App,
  settings: BookmarkAtlasSettings,
  record: BookmarkRecord
): BookmarkRecord {
  const adapter = app.vault.adapter as { getBasePath?: () => string; basePath?: string };
  const basePath = typeof adapter.getBasePath === "function" ? adapter.getBasePath() : adapter.basePath;
  const runtime = getNodeRuntime();
  if (!basePath || !runtime) {
    return record;
  }
  return finalizeWithPreviewCard(runtime, basePath, settings, record, record.fetchStatus ?? "skipped");
}

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter as { getBasePath?: () => string; basePath?: string };
  if (typeof adapter.getBasePath === "function") {
    return adapter.getBasePath();
  }
  return adapter.basePath ?? null;
}

function getNodeRuntime(): NodeRuntime | null {
  const dynamicRequire = (globalThis as { require?: (id: string) => any }).require;
  if (!dynamicRequire) {
    return null;
  }
  try {
    return {
      childProcess: dynamicRequire("node:child_process"),
      fs: dynamicRequire("node:fs"),
      path: dynamicRequire("node:path")
    };
  } catch {
    try {
      return {
        childProcess: dynamicRequire("child_process"),
        fs: dynamicRequire("fs"),
        path: dynamicRequire("path")
      };
    } catch {
      return null;
    }
  }
}

async function captureSingle(
  runtime: NodeRuntime,
  pluginDir: string,
  basePath: string,
  settings: BookmarkAtlasSettings,
  record: BookmarkRecord
): Promise<BookmarkRecord> {
  const screenshotPath = getPreferredScreenshotPath(record, settings);
  const absoluteScreenshotPath = runtime.path.join(basePath, ...screenshotPath.split("/"));
  if (isUsableScreenshot(runtime, absoluteScreenshotPath)) {
    return finalizePreviewRecord(record, {
      screenshotPath,
      previewAssetPath: screenshotPath,
      previewKind: "live-screenshot",
      previewStatus: "ready",
      fetchStatus: "success",
      availability: "reachable"
    });
  }

  if (!/^https?:\/\//i.test(record.url)) {
    return finalizeWithPreviewCard(runtime, basePath, settings, record, "unsupported");
  }

  const pluginRoot = resolvePluginRoot(runtime, basePath, pluginDir);
  const scriptPath = runtime.path.join(pluginRoot, "scripts", "capture-screenshot.mjs");
  const result = await runCapture(runtime, pluginRoot, scriptPath, record.url, absoluteScreenshotPath, settings.screenshotTimeoutMs);

  if (result.ok && isUsableScreenshot(runtime, absoluteScreenshotPath)) {
    return finalizePreviewRecord(record, {
      screenshotPath,
      previewAssetPath: screenshotPath,
      previewKind: "live-screenshot",
      previewStatus: "ready",
      fetchStatus: "success",
      availability: "reachable"
    });
  }

  const nextStatus: BookmarkRecord["fetchStatus"] =
    result.message === "blank-page" || result.blank
      ? "failed"
      : result.message === "timeout"
        ? "timeout"
        : "failed";

  return finalizeWithPreviewCard(runtime, basePath, settings, record, nextStatus);
}

function getPreferredScreenshotPath(
  record: BookmarkRecord,
  settings: BookmarkAtlasSettings
): string {
  const defaultPath = normalizePath(
    `${settings.rootFolder}/Assets/Screenshots/${slugify(record.title)}--${hashString(record.dedupeKey).slice(0, 8)}.jpg`
  );
  if (!record.screenshotPath) {
    return defaultPath;
  }
  if (/\.png$/i.test(record.screenshotPath)) {
    return normalizePath(record.screenshotPath.replace(/\.png$/i, ".jpg"));
  }
  if (!/\.(jpe?g|webp)$/i.test(record.screenshotPath)) {
    return defaultPath;
  }
  return normalizePath(record.screenshotPath);
}

function runCapture(
  runtime: NodeRuntime,
  pluginRoot: string,
  scriptPath: string,
  url: string,
  outputPath: string,
  timeoutMs: number
): Promise<CaptureResult> {
  return new Promise((resolve) => {
    runtime.childProcess.execFile(
      "node",
      [scriptPath, url, outputPath, String(timeoutMs)],
      {
        cwd: pluginRoot,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, message: "exec-error" });
          return;
        }
        const merged = `${stdout}\n${stderr}`.trim();
        try {
          const payload = JSON.parse(merged) as CaptureResult;
          resolve({
            ok: payload.ok === true,
            blank: payload.blank === true,
            message: payload.message
          });
        } catch {
          resolve({
            ok: merged.includes("\"ok\":true"),
            message: merged.includes("blank-page") ? "blank-page" : "parse-error"
          });
        }
      }
    );
  });
}

function resolvePluginRoot(runtime: NodeRuntime, basePath: string, pluginDir: string): string {
  const candidates = [
    pluginDir,
    runtime.path.join(basePath, pluginDir),
    runtime.path.join(basePath, ".obsidian", "plugins", pluginDir)
  ]
    .filter((value) => Boolean(value))
    .map((value) => runtime.path.normalize(value));

  for (const candidate of candidates) {
    if (runtime.fs.existsSync(runtime.path.join(candidate, "scripts", "capture-screenshot.mjs"))) {
      return candidate;
    }
  }

  if (pluginDir && runtime.path.isAbsolute(pluginDir)) {
    return runtime.path.normalize(pluginDir);
  }
  return runtime.path.normalize(runtime.path.join(basePath, ".obsidian", "plugins", pluginDir || "bookmark-atlas"));
}

function finalizeWithPreviewCard(
  runtime: NodeRuntime,
  basePath: string,
  settings: BookmarkAtlasSettings,
  record: BookmarkRecord,
  fetchStatus: BookmarkRecord["fetchStatus"]
): BookmarkRecord {
  const previewAssetPath = buildPreviewCardPath(settings.rootFolder, record);
  const absolutePreviewPath = runtime.path.join(basePath, ...previewAssetPath.split("/"));
  ensureParentFolder(runtime, absolutePreviewPath);
  runtime.fs.writeFileSync(absolutePreviewPath, renderPreviewCardSvg(record), "utf8");

  const availability =
    fetchStatus === "timeout"
      ? "timeout"
      : fetchStatus === "unsupported"
        ? "unsupported"
        : fetchStatus === "success"
          ? "reachable"
          : "failed";

  return finalizePreviewRecord(record, {
    previewAssetPath,
    previewKind: "local-preview-card",
    previewStatus: "fallback",
    fetchStatus,
    availability
  });
}

function finalizePreviewRecord(record: BookmarkRecord, updates: Partial<BookmarkRecord>): BookmarkRecord {
  return applyDerivedSignals({
    ...record,
    ...updates
  });
}

function ensureParentFolder(runtime: NodeRuntime, targetPath: string): void {
  runtime.fs.mkdirSync(runtime.path.dirname(targetPath), { recursive: true });
}

function isUsableScreenshot(runtime: NodeRuntime, absolutePath: string): boolean {
  if (!runtime.fs.existsSync(absolutePath)) {
    return false;
  }
  try {
    return runtime.fs.statSync(absolutePath).size >= MIN_VALID_SCREENSHOT_BYTES;
  } catch {
    return false;
  }
}
