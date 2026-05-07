import { ApiError } from "@/lib/errors";
import type { ExaSearchRequest, ResearchCategory, SearchResult } from "@/lib/types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

type ExaRawResult = {
  id?: string;
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
  highlights?: string[];
  score?: number;
  publishedDate?: string;
};

function getExaApiKey() {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new ApiError("Missing search API environment variable: EXA_API_KEY.", 500);
  }

  return apiKey;
}

function truncate(text: string, maxLength = 320) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function getHostname(url?: string) {
  if (!url) {
    return "this source";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "this source";
  }
}

function normalizeSnippet(item: ExaRawResult, query: string) {
  const highlight = item.highlights?.find((entry) => entry.trim());

  if (highlight) {
    return truncate(highlight);
  }

  if (item.summary?.trim()) {
    return truncate(item.summary);
  }

  if (item.text?.trim()) {
    return truncate(item.text);
  }

  const hostname = getHostname(item.url);
  return `Preview unavailable from ${hostname}. This result was retrieved as a neural match for "${query}".`;
}

function normalizeResult(
  item: ExaRawResult,
  category: ResearchCategory,
  searchQuery: string
): SearchResult {
  return {
    id: item.id ?? `${category}-${item.url ?? crypto.randomUUID()}`,
    title: item.title?.trim() || item.url || "Untitled result",
    url: item.url || "",
    snippet: normalizeSnippet(item, searchQuery),
    score: typeof item.score === "number" ? item.score : null,
    publishedDate: item.publishedDate ?? null,
    category,
    searchQuery,
    provider: "exa"
  };
}

export function buildExaSearchRequest({
  query,
  numResults,
  includeDomains = []
}: {
  query: string;
  numResults: number;
  includeDomains?: string[];
}): ExaSearchRequest {
  return {
    query,
    type: "neural",
    useAutoprompt: true,
    numResults,
    ...(includeDomains.length > 0 ? { includeDomains } : {}),
    contents: {
      text: {
        maxCharacters: 900
      },
      highlights: {
        query,
        numSentences: 2,
        highlightsPerUrl: 1
      },
      summary: {
        query: `Summarize why this source is relevant to: ${query}`
      }
    }
  };
}

export async function searchExa({
  query,
  numResults,
  category,
  includeDomains = []
}: {
  query: string;
  numResults: number;
  category: ResearchCategory;
  includeDomains?: string[];
}): Promise<SearchResult[]> {
  const requestPayload = buildExaSearchRequest({ query, numResults, includeDomains });

  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getExaApiKey()
    },
    body: JSON.stringify(requestPayload),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new ApiError(
      `Search request failed (${response.status}). ${details || "No details returned."}`,
      response.status
    );
  }

  const data = (await response.json()) as { results?: ExaRawResult[] };
  const results = data.results ?? [];

  return results
    .filter((item) => item.url)
    .map((item) => normalizeResult(item, category, query));
}
