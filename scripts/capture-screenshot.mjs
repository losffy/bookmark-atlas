import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const [, , url, outputPath, timeoutArg] = process.argv;
const timeoutMs = Number(timeoutArg) || 12000;

async function main() {
  if (!url || !outputPath) {
    throw new Error("Missing url or output path");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1100,
        height: 760
      },
      deviceScaleFactor: 1
    });

    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    await page.goto(url, {
      waitUntil: "domcontentloaded"
    });
    await page.waitForLoadState("networkidle", {
      timeout: Math.max(2000, Math.floor(timeoutMs * 0.7))
    }).catch(() => undefined);
    await page.waitForTimeout(900).catch(() => undefined);

    const pageSignal = await page.evaluate(() => {
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
      const mediaCount = document.querySelectorAll("img, svg, canvas, video, picture").length;
      const controlCount = document.querySelectorAll("button, a, input, textarea, select").length;
      return {
        textLength: text.length,
        mediaCount,
        controlCount
      };
    }).catch(() => ({
      textLength: 0,
      mediaCount: 0,
      controlCount: 0
    }));

    const isLikelyBlank = pageSignal.textLength < 20 && pageSignal.mediaCount === 0 && pageSignal.controlCount < 2;
    if (isLikelyBlank) {
      process.stdout.write(JSON.stringify({
        ok: false,
        blank: true,
        message: "blank-page",
        signal: pageSignal
      }));
      return;
    }

    const viewport = page.viewportSize() ?? { width: 1100, height: 760 };
    const clipWidth = Math.floor(viewport.width * 0.86);
    const clipHeight = Math.floor(viewport.height * 0.82);
    const clipX = Math.max(0, Math.floor((viewport.width - clipWidth) / 2));
    const clipY = Math.max(0, Math.floor((viewport.height - clipHeight) / 2));
    await page.screenshot({
      path: outputPath,
      clip: {
        x: clipX,
        y: clipY,
        width: clipWidth,
        height: clipHeight
      },
      type: "jpeg",
      quality: 68,
      animations: "disabled"
    });

    process.stdout.write(JSON.stringify({ ok: true, path: outputPath, signal: pageSignal }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
