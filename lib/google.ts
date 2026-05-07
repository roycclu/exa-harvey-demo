import { ApiError } from "@/lib/errors";
import type { GoogleSearchRequest, ResearchCategory, SearchResult } from "@/lib/types";

const GOOGLE_SEARCH_URL = "https://customsearch.googleapis.com/customsearch/v1";

type GoogleSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
  htmlSnippet?: string;
  pagemap?: {
    metatags?: Array<Record<string, string>>;
  };
};

function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY;
}

function getGoogleCseId() {
  return process.env.GOOGLE_CSE_ID;
}

function buildGoogleQuery(query: string, includeDomains: string[]) {
  if (includeDomains.length === 0) {
    return query;
  }

  const domainClause = includeDomains.map((domain) => `site:${domain}`).join(" OR ");
  return `${query} (${domainClause})`;
}

function stripHtml(value?: string) {
  if (!value) {
    return "";
  }

  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function getPublishedDate(item: GoogleSearchItem) {
  const meta = item.pagemap?.metatags?.[0];
  return (
    meta?.["article:published_time"] ||
    meta?.["og:published_time"] ||
    meta?.["date"] ||
    meta?.["article:modified_time"] ||
    null
  );
}

function getSnippet(item: GoogleSearchItem, query: string) {
  const snippet = stripHtml(item.htmlSnippet) || item.snippet?.trim() || "";

  if (snippet) {
    return snippet;
  }

  return `Preview unavailable from Google results. This source matched the search for "${query}".`;
}

function normalizeResult(
  item: GoogleSearchItem,
  category: ResearchCategory,
  searchQuery: string
): SearchResult | null {
  if (!item.link) {
    return null;
  }

  return {
    id: `google-${item.link}`,
    title: item.title?.trim() || item.link,
    url: item.link,
    snippet: getSnippet(item, searchQuery),
    score: null,
    publishedDate: getPublishedDate(item),
    category,
    searchQuery,
    provider: "google"
  };
}

export function buildGoogleSearchRequest({
  query,
  numResults,
  includeDomains = []
}: {
  query: string;
  numResults: number;
  includeDomains?: string[];
}): GoogleSearchRequest {
  return {
    q: buildGoogleQuery(query, includeDomains),
    num: Math.max(1, Math.min(numResults, 10)),
    cx: getGoogleCseId()
  };
}

export async function searchGoogle({
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
  const apiKey = getGoogleApiKey();
  const cx = getGoogleCseId();

  if (!apiKey || !cx) {
    return [];
  }

  const requestPayload = buildGoogleSearchRequest({ query, numResults, includeDomains });
  const url = new URL(GOOGLE_SEARCH_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", requestPayload.q);
  url.searchParams.set("num", String(requestPayload.num));

  const response = await fetch(url.toString(), {
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new ApiError(
      `Google search failed (${response.status}). ${details || "No details returned."}`,
      response.status
    );
  }

  const data = (await response.json()) as { items?: GoogleSearchItem[] };

  return (data.items ?? [])
    .map((item) => normalizeResult(item, category, query))
    .filter((item): item is SearchResult => Boolean(item));
}
