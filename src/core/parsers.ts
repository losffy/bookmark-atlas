import { HTMLElement, parse } from "node-html-parser";
import type { Node } from "node-html-parser";
import type { ImportIssue, ParsedBookmarkItem, SourceBrowser, SourceFormat } from "../types";
import { cleanText, inferBrowserFromFileName, parseEpochSeconds, parseWindowsMicroseconds } from "./utils";

export interface ParsedBookmarkPayload {
  sourceBrowser: SourceBrowser;
  sourceFormat: SourceFormat;
  items: ParsedBookmarkItem[];
  issues: ImportIssue[];
}

export function parseBookmarkPayload(fileName: string, content: string): ParsedBookmarkPayload {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return parseChromeJson(fileName, trimmed);
  }
  return parseNetscapeHtml(fileName, content);
}

function parseChromeJson(fileName: string, content: string): ParsedBookmarkPayload {
  const issues: ImportIssue[] = [];
  const items: ParsedBookmarkItem[] = [];

  try {
    const parsed = JSON.parse(content) as {
      roots?: Record<string, ChromeBookmarkNode>;
    };

    if (!parsed.roots) {
      throw new Error("Missing roots field");
    }

    const roots = Object.entries(parsed.roots);
    for (const [rootName, node] of roots) {
      walkChromeNode(node, [rootName], items);
    }

    return {
      sourceBrowser: "chrome",
      sourceFormat: "chrome-json",
      items,
      issues
    };
  } catch (error) {
    issues.push({
      level: "error",
      code: "invalid-json",
      message: `无法解析 Chrome JSON 书签文件：${error instanceof Error ? error.message : String(error)}`
    });
    return {
      sourceBrowser: inferBrowserFromFileName(fileName),
      sourceFormat: "chrome-json",
      items,
      issues
    };
  }
}

interface ChromeBookmarkNode {
  children?: ChromeBookmarkNode[];
  date_added?: string;
  name?: string;
  type?: "folder" | "url";
  url?: string;
}

function walkChromeNode(node: ChromeBookmarkNode, path: string[], items: ParsedBookmarkItem[]): void {
  if (node.type === "url" && node.url) {
    items.push({
      title: cleanText(node.name) || node.url,
      url: node.url,
      folderPath: path.slice(0, -1),
      createdAt: parseWindowsMicroseconds(node.date_added)
    });
    return;
  }

  const nextPath = node.name ? [...path, node.name] : path;
  for (const child of node.children ?? []) {
    walkChromeNode(child, nextPath, items);
  }
}

function parseNetscapeHtml(fileName: string, content: string): ParsedBookmarkPayload {
  const issues: ImportIssue[] = [];
  const items: ParsedBookmarkItem[] = [];

  try {
    const root = parse(content, {
      comment: true
    });
    const rootDl = root.querySelector("dl");
    if (!rootDl) {
      throw new Error("Missing DL root");
    }
    walkDl(rootDl, [], items);
  } catch (error) {
    issues.push({
      level: "error",
      code: "invalid-html",
      message: `无法解析书签 HTML：${error instanceof Error ? error.message : String(error)}`
    });
  }

  return {
    sourceBrowser: inferBrowserFromFileName(fileName),
    sourceFormat: "netscape-html",
    items,
    issues
  };
}

function walkDl(dlElement: HTMLElement, folderPath: string[], items: ParsedBookmarkItem[]): void {
  const nodes = dlElement.childNodes;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (node.tagName === "DT") {
      const anchor = node.querySelector("a");
      if (anchor) {
        const url = cleanText(anchor.getAttribute("href"));
        if (url) {
          items.push({
            title: cleanText(anchor.text) || url,
            url,
            folderPath,
            createdAt: parseEpochSeconds(anchor.getAttribute("add_date")),
            icon: cleanText(anchor.getAttribute("icon") ?? anchor.getAttribute("icon_uri"))
          });
        }
        continue;
      }

      const folder = node.querySelector("h3");
      if (folder) {
        const name = cleanText(folder.text);
        const nextDl = findNextDl(nodes, index + 1);
        if (name && nextDl) {
          walkDl(nextDl, [...folderPath, name], items);
        }
        continue;
      }
    }

    if (node.tagName === "A") {
      const url = cleanText(node.getAttribute("href"));
      if (url) {
        items.push({
          title: cleanText(node.text) || url,
          url,
          folderPath,
          createdAt: parseEpochSeconds(node.getAttribute("add_date")),
          icon: cleanText(node.getAttribute("icon") ?? node.getAttribute("icon_uri"))
        });
      }
    }
  }
}

function findNextDl(nodes: Node[], startIndex: number): HTMLElement | null {
  for (let index = startIndex; index < nodes.length; index += 1) {
    const candidate = nodes[index];
    if (candidate instanceof HTMLElement && candidate.tagName === "DL") {
      return candidate;
    }
  }
  return null;
}
