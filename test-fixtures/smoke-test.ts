import { readFile } from "node:fs/promises";
import { BookmarkImporter } from "../src/core/importer";
import { DEFAULT_SETTINGS } from "../src/core/constants";

const importer = new BookmarkImporter({
  ...DEFAULT_SETTINGS,
  enableRemoteEnrichment: false
});

async function main() {
  const html = await readFile(new URL("./chrome-bookmarks.html", import.meta.url), "utf8");
  const htmlResult = await importer.preview("chrome-bookmarks.html", html);
  console.log("HTML", htmlResult.stats, htmlResult.records.map((record) => `${record.category}:${record.title}`).join(" | "));

  const json = await readFile(new URL("./chrome-bookmarks.json", import.meta.url), "utf8");
  const jsonResult = await importer.preview("chrome-bookmarks.json", json);
  console.log("JSON", jsonResult.stats, jsonResult.records.map((record) => `${record.category}:${record.title}`).join(" | "));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
