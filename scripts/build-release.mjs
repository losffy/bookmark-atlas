import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");

async function main() {
  const manifestPath = path.join(pluginRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const version = String(manifest.version || "0.0.0");
  const pluginId = String(manifest.id || "bookmark-atlas");

  const releaseRoot = path.join(pluginRoot, "release");
  const packageDir = path.join(releaseRoot, `${pluginId}-${version}`);
  const zipPath = path.join(releaseRoot, `${pluginId}-${version}.zip`);

  await fs.rm(packageDir, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });
  await fs.mkdir(packageDir, { recursive: true });

  const filesToCopy = [
    "manifest.json",
    "main.js",
    "styles.css",
    "versions.json",
    "README.md",
    "LICENSE"
  ];

  for (const file of filesToCopy) {
    await fs.copyFile(path.join(pluginRoot, file), path.join(packageDir, file));
  }

  await execFileAsync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path '${packageDir}\\*' -DestinationPath '${zipPath}' -Force`
    ],
    { cwd: pluginRoot, windowsHide: true }
  );

  process.stdout.write(JSON.stringify({
    ok: true,
    pluginId,
    version,
    packageDir,
    zipPath
  }));
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
