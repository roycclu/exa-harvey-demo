export type ResearchCategory = "precedent" | "opposingCounsel" | "industryNews";
export type SortMode = "relevance" | "recency";
export type SearchMode = "manual" | "document";
export type SearchProvider = "exa" | "google";

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number | null;
  publishedDate: string | null;
  category: ResearchCategory;
  searchQuery: string;
  provider: SearchProvider;
};

export type SearchConfig = {
  includeDomains: string[];
};

export type ExaSearchRequest = {
  query: string;
  type: "neural";
  useAutoprompt: boolean;
  numResults: number;
  includeDomains?: string[];
  contents: {
    text: {
      maxCharacters: number;
    };
    highlights: {
      query: string;
      numSentences: number;
      highlightsPerUrl: number;
    };
    summary: {
      query: string;
    };
  };
};

export type GoogleSearchRequest = {
  q: string;
  num: number;
  cx?: string;
};

export type ProviderResultGroup = Record<SearchProvider, SearchResult[]>;

export type ManualSearchResponse = {
  mode: "manual";
  query: string;
  results: ProviderResultGroup;
  requests: {
    exa: ExaSearchRequest;
    google: GoogleSearchRequest;
  };
};

export type SearchAngles = {
  precedent: string;
  opposingCounsel: string;
  industryNews: string;
};

export type DocumentSearchResponse = {
  mode: "document";
  filename: string;
  extractedTextPreview: string;
  angles: SearchAngles;
  results: Record<ResearchCategory, ProviderResultGroup>;
  requests: {
    exa: Record<ResearchCategory, ExaSearchRequest>;
    google: Record<ResearchCategory, GoogleSearchRequest>;
  };
};
