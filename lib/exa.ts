import { ApiError } from "@/lib/errors";
import type { ResearchCategory, SearchResult } from "@/lib/types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

type ExaRawResult = {
  id?: string;
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  publishedDate?: string;
};

function getExaApiKey() {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new ApiError("Missing EXA_API_KEY environment variable.", 500);
  }

  return apiKey;
}

function normalizeSnippet(text?: string) {
  if (!text) {
    return "No snippet available.";
  }

  return text.replace(/\s+/g, " ").trim().slice(0, 280);
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
    snippet: normalizeSnippet(item.text),
    score: typeof item.score === "number" ? item.score : null,
    publishedDate: item.publishedDate ?? null,
    category,
    searchQuery
  };
}

export async function searchExa({
  query,
  numResults,
  category
}: {
  query: string;
  numResults: number;
  category: ResearchCategory;
}): Promise<SearchResult[]> {
  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getExaApiKey()
    },
    body: JSON.stringify({
      query,
      type: "neural",
      useAutoprompt: true,
      numResults,
      text: {
        maxCharacters: 400
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new ApiError(
      `Exa search failed (${response.status}). ${details || "No details returned."}`,
      response.status
    );
  }

  const data = (await response.json()) as { results?: ExaRawResult[] };
  const results = data.results ?? [];

  return results
    .filter((item) => item.url)
    .map((item) => normalizeResult(item, category, query));
}
