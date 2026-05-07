"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

import styles from "@/app/page.module.css";
import type {
  DocumentSearchResponse,
  ExaSearchRequest,
  ManualSearchResponse,
  ProviderResultGroup,
  ResearchCategory,
  SearchConfig,
  SearchMode,
  SearchProvider,
  SearchResult,
  SortMode
} from "@/lib/types";

type ResultState = ManualSearchResponse | DocumentSearchResponse | null;

type DomainPreset = {
  id: string;
  label: string;
  domain: string;
};

type ResultSection = {
  category: ResearchCategory;
  heading: string;
  description: string;
  searchQuery: string;
  exaRequest: ExaSearchRequest;
  results: ProviderResultGroup;
};

const DOMAIN_PRESETS: DomainPreset[] = [
  { id: "cornell", label: "Cornell LII", domain: "law.cornell.edu" },
  { id: "justice", label: "U.S. DOJ", domain: "justice.gov" },
  { id: "supreme", label: "Supreme Court", domain: "supremecourt.gov" },
  { id: "sec", label: "SEC", domain: "sec.gov" },
  { id: "reuters", label: "Reuters Legal", domain: "reuters.com" },
  { id: "lexology", label: "Lexology", domain: "lexology.com" }
];

const CATEGORY_META: Record<ResearchCategory, { label: string; description: string }> = {
  precedent: {
    label: "Precedent",
    description: "Cases, statutes, and legal analysis"
  },
  opposingCounsel: {
    label: "Opposing counsel",
    description: "Firms, prior matters, and litigation posture"
  },
  industryNews: {
    label: "Industry news",
    description: "Company and market developments"
  }
};

const PROVIDER_META: Record<SearchProvider, { label: string; subtitle: string }> = {
  exa: {
    label: "Neural search",
    subtitle: "semantic ranking"
  },
  google: {
    label: "Google search",
    subtitle: "web ranking"
  }
};

function formatDate(date: string | null) {
  if (!date) {
    return "Date unavailable";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sortResults(results: SearchResult[], sortMode: SortMode) {
  return [...results].sort((left, right) => {
    if (sortMode === "recency") {
      const leftDate = left.publishedDate ? new Date(left.publishedDate).getTime() : 0;
      const rightDate = right.publishedDate ? new Date(right.publishedDate).getTime() : 0;
      return rightDate - leftDate;
    }

    return (right.score ?? -1) - (left.score ?? -1);
  });
}

function parseCustomDomains(value: string) {
  return value
    .split(/[\n,]/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .map((domain) => domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
}

function buildSearchConfig(selectedPresetIds: string[], customDomains: string): SearchConfig {
  const presetDomains = DOMAIN_PRESETS.filter((preset) => selectedPresetIds.includes(preset.id)).map(
    (preset) => preset.domain
  );

  return {
    includeDomains: [...new Set([...presetDomains, ...parseCustomDomains(customDomains)])]
  };
}

function getTotalResults(sections: ResultSection[]) {
  return sections.reduce(
    (sum, section) => sum + section.results.exa.length + section.results.google.length,
    0
  );
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function HomePage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("manual");
  const [manualQuery, setManualQuery] = useState(
    "Delaware corporate veil piercing precedent in SaaS acquisition disputes"
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([
    "cornell",
    "justice",
    "supreme"
  ]);
  const [customDomains, setCustomDomains] = useState("");
  const [showSearchParams, setShowSearchParams] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [resultState, setResultState] = useState<ResultState>(null);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeFilter, setActiveFilter] = useState<ResearchCategory | "all">("all");
  const [manualPending, setManualPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const searchConfig = useMemo(
    () => buildSearchConfig(selectedPresetIds, customDomains),
    [customDomains, selectedPresetIds]
  );

  const sections = useMemo<ResultSection[]>(() => {
    if (!resultState) {
      return [];
    }

    if (resultState.mode === "manual") {
      return [
        {
          category: "precedent",
          heading: "Search results",
          description: "Query-driven legal research",
          searchQuery: resultState.query,
          exaRequest: resultState.requests.exa,
          results: {
            exa: sortResults(resultState.results.exa, sortMode),
            google: sortResults(resultState.results.google, sortMode)
          }
        }
      ];
    }

    return (Object.keys(CATEGORY_META) as ResearchCategory[])
      .filter((category) => activeFilter === "all" || category === activeFilter)
      .map((category) => ({
        category,
        heading: CATEGORY_META[category].label,
        description: CATEGORY_META[category].description,
        searchQuery: resultState.angles[category],
        exaRequest: resultState.requests.exa[category],
        results: {
          exa: sortResults(resultState.results[category].exa, sortMode),
          google: sortResults(resultState.results[category].google, sortMode)
        }
      }));
  }, [activeFilter, resultState, sortMode]);

  const totalResults = useMemo(() => getTotalResults(sections), [sections]);

  const currentSearchRequests = useMemo(() => {
    if (!resultState) {
      return [];
    }

    if (resultState.mode === "manual") {
      return [
        {
          label: "Search",
          payload: resultState.requests.exa
        }
      ];
    }

    return (Object.keys(CATEGORY_META) as ResearchCategory[])
      .filter((category) => activeFilter === "all" || category === activeFilter)
      .map((category) => ({
        label: CATEGORY_META[category].label,
        payload: resultState.requests.exa[category]
      }));
  }, [activeFilter, resultState]);

  const isPending = manualPending || uploadPending;

  function handleSelectedFile(file: File | null) {
    if (!file) {
      return;
    }

    setUploadFile(file);
    setSearchMode("document");
    setError(null);
  }

  async function handleManualSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualPending(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: manualQuery,
          numResults: 6,
          includeDomains: searchConfig.includeDomains
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Search failed.");
      }

      setResultState(payload as ManualSearchResponse);
      setActiveFilter("all");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Search failed.");
    } finally {
      setManualPending(false);
    }
  }

  async function handleDocumentSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadFile) {
      setError("Drop a contract, case summary, or brief before running document research.");
      return;
    }

    setUploadPending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("includeDomains", JSON.stringify(searchConfig.includeDomains));

      const response = await fetch("/api/document-research", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Document research failed.");
      }

      setResultState(payload as DocumentSearchResponse);
      setActiveFilter("all");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Document research failed."
      );
    } finally {
      setUploadPending(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFile(event.target.files?.[0] ?? null);
  }

  function togglePreset(id: string) {
    setSelectedPresetIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <span className={styles.brandName}>Harvey</span>
            <span className={styles.brandSep}>|</span>
            <span className={styles.brandProduct}>Neural Search</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Link
              href="/intelligence"
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--muted)",
                textDecoration: "none"
              }}
            >
              Legal Intelligence →
            </Link>
            <span className={styles.poweredBy}>Live web research</span>
          </div>
        </div>
        <div className={styles.goldRule} />
      </header>

      <main className={styles.content}>
        <div className={styles.shell}>
          <section className={styles.grid}>
            {/* ── Left panel: search input ── */}
            <aside className={`${styles.panel} ${styles.workspace}`}>
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeButton} ${
                    searchMode === "manual" ? styles.modeButtonActive : ""
                  }`}
                  type="button"
                  onClick={() => setSearchMode("manual")}
                >
                  Natural language
                </button>
                <button
                  className={`${styles.modeButton} ${
                    searchMode === "document" ? styles.modeButtonActive : ""
                  }`}
                  type="button"
                  onClick={() => setSearchMode("document")}
                >
                  Document upload
                </button>
              </div>

              {searchMode === "manual" ? (
                <form className={styles.searchForm} onSubmit={handleManualSearch}>
                  <div className={styles.sectionHeader}>
                    <h2>Describe the legal issue</h2>
                  </div>
                  <textarea
                    className={styles.queryInput}
                    value={manualQuery}
                    onChange={(event) => setManualQuery(event.target.value)}
                    placeholder="Enter a legal question, dispute context, or research objective."
                  />
                  <div className={styles.actionRow}>
                    <button className={styles.primaryButton} type="submit" disabled={isPending}>
                      {manualPending ? "Searching..." : "Run search"}
                    </button>
                    <div className={styles.microcopy}>
                      Neural and Google search run side by side against the same legal query.
                    </div>
                  </div>
                </form>
              ) : (
                <form className={styles.searchForm} onSubmit={handleDocumentSearch}>
                  <div className={styles.sectionHeader}>
                    <h2>Upload matter documents</h2>
                  </div>
                  <div
                    className={`${styles.dropzone} ${isDraggingFile ? styles.dropzoneActive : ""}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={styles.dropzoneTitle}>
                      {uploadFile ? uploadFile.name : "Drag and drop a contract, memo, or case summary"}
                    </div>
                    <div className={styles.dropzoneMeta}>
                      {uploadFile
                        ? `${Math.max(1, Math.round(uploadFile.size / 1024))} KB ready for analysis`
                        : "or click to upload — PDF, TXT, or RTF"}
                    </div>
                  </div>
                  <input
                    className={styles.fileInput}
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.rtf,text/plain,application/pdf"
                    onChange={onFileChange}
                  />
                  <div className={styles.actionRow}>
                    <button className={styles.primaryButton} type="submit" disabled={isPending}>
                      {uploadPending ? "Analyzing..." : "Analyze document"}
                    </button>
                    <div className={styles.microcopy}>
                      OpenAI extracts legal search angles, then both search systems run in parallel.
                    </div>
                  </div>
                </form>
              )}
            </aside>

            {/* ── Center panel: results ── */}
            <section className={`${styles.panel} ${styles.results}`}>
              <div className={styles.resultsHeader}>
                <div>
                  <div className={styles.label}>Search results</div>
                  <h2>{resultState?.mode === "document" ? "Matter comparison view" : "Comparison view"}</h2>
                </div>
                {resultState && (
                  <div className={styles.summaryMeta}>
                    {totalResults} results &middot; sorted by {sortMode}
                  </div>
                )}
              </div>

              <div className={styles.controlsRow}>
                <div className={styles.controlsInline}>
                  <span className={styles.controlLabel}>Filter</span>
                  <button
                    className={`${styles.chip} ${activeFilter === "all" ? styles.chipActive : ""}`}
                    type="button"
                    onClick={() => setActiveFilter("all")}
                  >
                    All
                  </button>
                  {(Object.keys(CATEGORY_META) as ResearchCategory[]).map((category) => (
                    <button
                      key={category}
                      className={`${styles.chip} ${
                        activeFilter === category ? styles.chipActive : ""
                      }`}
                      type="button"
                      onClick={() => setActiveFilter(category)}
                    >
                      {CATEGORY_META[category].label}
                    </button>
                  ))}
                </div>

                <div className={styles.controlsInline}>
                  <span className={styles.controlLabel}>Sort</span>
                  <button
                    className={`${styles.chip} ${
                      sortMode === "relevance" ? styles.chipActive : ""
                    }`}
                    type="button"
                    onClick={() => setSortMode("relevance")}
                  >
                    Relevance
                  </button>
                  <button
                    className={`${styles.chip} ${sortMode === "recency" ? styles.chipActive : ""}`}
                    type="button"
                    onClick={() => setSortMode("recency")}
                  >
                    Recency
                  </button>
                </div>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              {!resultState && !error && !isPending && (
                <div className={styles.emptyState}>
                  Choose a search mode, run the workflow, and compare neural retrieval against Google web search side by side.
                </div>
              )}

              {isPending && (
                <div className={styles.loadingState}>
                  <div className={styles.skeleton} />
                  <div className={styles.skeleton} />
                  <div className={styles.skeleton} />
                </div>
              )}

              {resultState?.mode === "document" && (
                <div className={styles.documentMeta}>
                  <div className={styles.documentMetaItem}>
                    <span>Document</span>
                    <strong>{resultState.filename}</strong>
                  </div>
                  <div className={styles.documentMetaItem}>
                    <span>Angles generated</span>
                    <strong>Precedent, opposing counsel, industry news</strong>
                  </div>
                </div>
              )}

              <div className={styles.sections}>
                {sections.map((section) => (
                  <section className={styles.sectionCard} key={section.category}>
                    <div className={styles.sectionTop}>
                      <div>
                        <div className={styles.label}>{section.description}</div>
                        <h3>{section.heading}</h3>
                      </div>
                      <div className={styles.sectionQuery}>{section.searchQuery}</div>
                    </div>

                    <div className={styles.providerGrid}>
                      {(["exa", "google"] as SearchProvider[]).map((provider) => (
                        <div className={styles.providerColumn} key={provider}>
                          <div className={styles.providerHeader}>
                            <div>
                              <div className={styles.providerTitle}>{PROVIDER_META[provider].label}</div>
                              <div className={styles.providerSubtitle}>
                                {PROVIDER_META[provider].subtitle}
                              </div>
                            </div>
                          </div>

                          <div className={styles.cards}>
                            {section.results[provider].length === 0 ? (
                              <div className={styles.emptyCard}>
                                {provider === "google"
                                  ? "No Google results returned. Check Google API configuration or broaden the query."
                                  : "No neural search results returned for this category."}
                              </div>
                            ) : (
                              section.results[provider].map((result) => (
                                <article className={styles.card} key={result.id}>
                                  <a href={result.url} target="_blank" rel="noreferrer">
                                    <h4 className={styles.cardTitle}>{result.title}</h4>
                                  </a>
                                  <div className={styles.cardCitation}>
                                    <span>{extractDomain(result.url)}</span>
                                    <span className={styles.citationDot}>&middot;</span>
                                    <span>{formatDate(result.publishedDate)}</span>
                                  </div>
                                  <p className={styles.snippet}>{result.snippet}</p>
                                  <div className={styles.cardMeta}>
                                    <span>{CATEGORY_META[result.category].label}</span>
                                  </div>
                                </article>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            {/* ── Right panel: config ── */}
            <aside
              className={`${styles.panel} ${styles.configPanel} ${
                configExpanded ? "" : styles.configPanelCollapsed
              }`}
            >
              <div className={styles.configHeader}>
                <div>
                  <div className={styles.label}>Configuration</div>
                  {configExpanded && <h2>Search controls</h2>}
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setConfigExpanded((current) => !current)}
                >
                  {configExpanded ? "Collapse" : "Open"}
                </button>
              </div>

              {configExpanded && (
                <div className={styles.configBody}>
                  <section className={styles.configSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Relevant legal sites</h3>
                    </div>
                    <div className={styles.optionList}>
                      {DOMAIN_PRESETS.map((preset) => (
                        <label className={styles.option} key={preset.id}>
                          <input
                            checked={selectedPresetIds.includes(preset.id)}
                            type="checkbox"
                            onChange={() => togglePreset(preset.id)}
                          />
                          <span>
                            <strong>{preset.label}</strong>
                            <em>{preset.domain}</em>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className={styles.configSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Additional domains</h3>
                    </div>
                    <textarea
                      className={styles.configTextarea}
                      placeholder="law360.com, regulations.gov"
                      value={customDomains}
                      onChange={(event) => setCustomDomains(event.target.value)}
                    />
                  </section>

                  <section className={styles.configSection}>
                    <label className={styles.switchRow}>
                      <span>Show neural search request payloads</span>
                      <input
                        checked={showSearchParams}
                        type="checkbox"
                        onChange={(event) => setShowSearchParams(event.target.checked)}
                      />
                    </label>
                  </section>

                  {showSearchParams && currentSearchRequests.length > 0 && (
                    <section className={styles.configSection}>
                      <div className={styles.sectionHeader}>
                        <h3>Neural search API parameters</h3>
                      </div>
                      <div className={styles.requestList}>
                        {currentSearchRequests.map((request) => (
                          <div className={styles.requestBlock} key={request.label}>
                            <div className={styles.requestLabel}>{request.label}</div>
                            <pre className={styles.requestCode}>{prettyJson(request.payload)}</pre>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
