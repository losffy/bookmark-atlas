const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_cid$/i, /^mc_eid$/i];

export function cleanText(input: string | undefined | null): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeUrl(input: string): {
  normalizedUrl: string;
  domain: string;
  scheme: string;
  qualityFlags: string[];
  favicon?: string;
} {
  const original = cleanText(input);
  const qualityFlags: string[] = [];

  if (!original) {
    qualityFlags.push("missing-url");
    return {
      normalizedUrl: "",
      domain: "",
      scheme: "",
      qualityFlags
    };
  }

  try {
    const url = new URL(original);
    const scheme = url.protocol.replace(":", "").toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
        url.searchParams.delete(key);
      }
    }

    const queryEntries = Array.from(url.searchParams.entries()).sort((left, right) => {
      if (left[0] === right[0]) {
        return left[1].localeCompare(right[1]);
      }
      return left[0].localeCompare(right[0]);
    });
    url.search = "";
    for (const [key, value] of queryEntries) {
      url.searchParams.append(key, value);
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    if (!/^https?$/.test(scheme)) {
      qualityFlags.push("non-http-url");
    }

    return {
      normalizedUrl: url.toString(),
      domain: url.hostname,
      scheme,
      qualityFlags,
      favicon: /^https?$/.test(scheme) ? `${url.origin}/favicon.ico` : undefined
    };
  } catch {
    qualityFlags.push("invalid-url");
    return {
      normalizedUrl: original,
      domain: "",
      scheme: "",
      qualityFlags
    };
  }
}

export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slugify(input: string): string {
  const value = cleanText(input)
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return value || "bookmark";
}

export function inferBrowserFromFileName(fileName: string): "chrome" | "firefox" | "unknown" {
  const lower = fileName.toLowerCase();
  if (lower.includes("firefox") || lower.includes("mozilla")) {
    return "firefox";
  }
  if (lower.includes("chrome") || lower.includes("bookmark")) {
    return "chrome";
  }
  return "unknown";
}

export function parseEpochSeconds(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const numeric = Number(input);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return new Date(numeric * 1000).toISOString();
}

export function parseWindowsMicroseconds(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const numeric = Number(input);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  const epochMicroseconds = numeric - 11644473600000000;
  return new Date(epochMicroseconds / 1000).toISOString();
}

export function normalizeForCompare(input: string): string {
  return cleanText(input).toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

export function titleTokenSet(input: string): Set<string> {
  return new Set(normalizeForCompare(input).split(" ").filter((part) => part.length > 1));
}

export function tokenOverlap(left: string, right: string): number {
  const leftSet = titleTokenSet(left);
  const rightSet = titleTokenSet(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      matches += 1;
    }
  }
  return matches / Math.max(leftSet.size, rightSet.size);
}

export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}

export function arrayFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanText(String(entry))).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[|,/]/)
      .map((entry) => cleanText(entry))
      .filter(Boolean);
  }
  return [];
}
