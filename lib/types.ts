export type ResearchCategory = "precedent" | "opposingCounsel" | "industryNews";
export type SortMode = "relevance" | "recency";

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number | null;
  publishedDate: string | null;
  category: ResearchCategory;
  searchQuery: string;
};

export type ManualSearchResponse = {
  mode: "manual";
  query: string;
  results: SearchResult[];
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
  results: Record<ResearchCategory, SearchResult[]>;
};
