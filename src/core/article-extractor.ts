import { cleanText, truncate } from "./utils";

const MAX_ARTICLE_MARKDOWN_LENGTH = 8000;
const MAX_ARTICLE_EXCERPT_LENGTH = 320;

export interface ExtractedArticleContent {
  excerpt?: string;
  markdown?: string;
  wordCount?: number;
  author?: string;
  publishedAt?: string;
  site?: string;
  title?: string;
  description?: string;
}

export async function extractArticleContent(html: string, url: string): Promise<ExtractedArticleContent | null> {
  const [{ parseHTML }, { Defuddle }] = await Promise.all([
    import("linkedom"),
    import("defuddle/node")
  ]);
  const { document } = parseHTML(html);
  const view = document.defaultView as { getComputedStyle?: (element: Element) => CSSStyleDeclaration } | undefined;
  if (view && typeof view.getComputedStyle !== "function") {
    view.getComputedStyle = createComputedStyleShim as unknown as typeof view.getComputedStyle;
  }
  const result = await withSuppressedDefuddleNoise(() => Defuddle(document, url, {
    markdown: false,
    separateMarkdown: true,
    useAsync: false,
    removeImages: true,
    includeReplies: false
  }));

  const markdown = trimMarkdown(result.contentMarkdown ?? "");
  const excerptSource = cleanText(result.description || stripMarkdown(markdown));
  const excerpt = excerptSource ? truncate(stripMarkdown(excerptSource), MAX_ARTICLE_EXCERPT_LENGTH) : "";
  const clippedMarkdown = markdown ? truncate(markdown, MAX_ARTICLE_MARKDOWN_LENGTH) : "";

  if (!excerpt && !clippedMarkdown) {
    return null;
  }

  return {
    excerpt: excerpt || undefined,
    markdown: clippedMarkdown || undefined,
    wordCount: Number.isFinite(result.wordCount) ? result.wordCount : undefined,
    author: cleanText(result.author) || undefined,
    publishedAt: cleanText(result.published) || undefined,
    site: cleanText(result.site) || undefined,
    title: cleanText(result.title) || undefined,
    description: cleanText(result.description) || undefined
  };
}

function createComputedStyleShim(): CSSStyleDeclaration {
  const style = {
    display: "block",
    visibility: "visible",
    position: "static",
    float: "none",
    opacity: "1",
    overflow: "visible",
    width: "auto",
    height: "auto",
    maxWidth: "none",
    maxHeight: "none",
    getPropertyValue: () => ""
  } as Partial<CSSStyleDeclaration>;

  return new Proxy(style, {
    get(target, property) {
      if (typeof property === "string" && property in target) {
        return target[property as keyof typeof target];
      }
      return "";
    }
  }) as CSSStyleDeclaration;
}

function trimMarkdown(input: string): string {
  return input
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripMarkdown(input: string): string {
  return input
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function withSuppressedDefuddleNoise<T>(run: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    if (!shouldLogDefuddleMessage(args)) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (!shouldLogDefuddleMessage(args)) {
      return;
    }
    originalError(...args);
  };

  try {
    return await run();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

function shouldLogDefuddleMessage(args: unknown[]): boolean {
  const message = args.map((value) => String(value)).join(" ");
  return !isKnownDefuddleNoise(message);
}

function isKnownDefuddleNoise(message: string): boolean {
  return [
    "Picture element without img fallback",
    "Failed to parse URL:",
    "Unknown pseudo-class :block"
  ].some((pattern) => message.includes(pattern));
}
