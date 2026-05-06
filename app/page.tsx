"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";

import styles from "@/app/page.module.css";
import type {
  DocumentSearchResponse,
  ManualSearchResponse,
  ResearchCategory,
  SearchConfig,
  SearchResult,
  SortMode
} from "@/lib/types";

type ResultState = ManualSearchResponse | DocumentSearchResponse | null;

type DomainPreset = {
  id: string;
  label: string;
  domain: string;
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

export default function HomePage() {
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
  const [showSearchQueries, setShowSearchQueries] = useState(false);
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

  const groupedResults = useMemo(() => {
    if (!resultState) {
      return [];
    }

    if (resultState.mode === "manual") {
      return [
        {
          category: "precedent" as const,
          heading: "Manual search",
          searchQuery: resultState.query,
          results: sortResults(resultState.results, sortMode)
        }
      ].filter((group) => activeFilter === "all" || group.category === activeFilter);
    }

    return (Object.keys(CATEGORY_META) as ResearchCategory[])
      .map((category) => ({
        category,
        heading: CATEGORY_META[category].label,
        searchQuery: resultState.angles[category],
        results: sortResults(resultState.results[category], sortMode)
      }))
      .filter((group) => activeFilter === "all" || group.category === activeFilter);
  }, [activeFilter, resultState, sortMode]);

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
        throw new Error(payload.error || "Manual search failed.");
      }

      setResultState(payload as ManualSearchResponse);
      setActiveFilter("all");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Manual search failed.");
    } finally {
      setManualPending(false);
    }
  }

  async function handleDocumentSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadFile) {
      setError("Choose a text file or PDF before running document research.");
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
    setUploadFile(event.target.files?.[0] ?? null);
  }

  function togglePreset(id: string) {
    setSelectedPresetIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function onDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function onDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      setUploadFile(file);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroTopline}>Legal research demo</div>
          <h1>
            Harvey Neural Search
            <span>powered by Exa</span>
          </h1>
          <p>
            Direct neural search for focused legal questions, plus document-led parallel research
            across precedents, opposing counsel history, and industry developments.
          </p>
        </section>

        <section className={styles.grid}>
          <aside className={`${styles.panel} ${styles.controls}`}>
            <form className={styles.section} onSubmit={handleManualSearch}>
              <div className={styles.sectionHeader}>
                <h2>Mode 1</h2>
                <span className={styles.kicker}>Manual search</span>
              </div>
              <input
                className={styles.input}
                value={manualQuery}
                onChange={(event) => setManualQuery(event.target.value)}
                placeholder="Enter a legal research question"
              />
              <div className={styles.actions}>
                <button className={styles.button} type="submit" disabled={manualPending}>
                  {manualPending ? "Searching..." : "Search Exa"}
                </button>
              </div>
              <div className={styles.helper}>
                Returns the top 5-8 neural results ranked by relevance.
              </div>
            </form>

            <form className={styles.section} onSubmit={handleDocumentSearch}>
              <div className={styles.sectionHeader}>
                <h2>Mode 2</h2>
                <span className={styles.kicker}>Document upload</span>
              </div>
              <button
                className={`${styles.dropzone} ${isDraggingFile ? styles.dropzoneActive : ""}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <span className={styles.dropzoneTitle}>
                  {uploadFile ? uploadFile.name : "Drag and drop a contract or case summary"}
                </span>
                <span className={styles.dropzoneMeta}>
                  {uploadFile
                    ? `${Math.max(1, Math.round(uploadFile.size / 1024))} KB selected`
                    : "or click to upload a text file or PDF"}
                </span>
              </button>
              <input
                className={styles.fileInput}
                type="file"
                accept=".pdf,.txt,.md,.rtf,text/plain,application/pdf"
                onChange={onFileChange}
                ref={fileInputRef}
              />
              <div className={styles.actions}>
                <button className={styles.button} type="submit" disabled={uploadPending}>
                  {uploadPending ? "Analyzing..." : "Analyze document"}
                </button>
              </div>
              <div className={styles.helper}>
                OpenAI extracts angles for precedents, opposing counsel history, and industry news.
              </div>
            </form>

            <section className={styles.section}>
              <div className={styles.helper}>
                Domain filters currently applied to Exa:{" "}
                {searchConfig.includeDomains.length > 0
                  ? `${searchConfig.includeDomains.length} selected`
                  : "none"}
              </div>
            </section>
          </aside>

          <section className={`${styles.panel} ${styles.results}`}>
            <div className={styles.resultsHeader}>
              <div>
                <div className={styles.kicker}>Results</div>
                <h2>
                  {resultState?.mode === "document"
                    ? "Grouped legal research output"
                    : "Search results"}
                </h2>
              </div>
              {resultState && (
                <div className={styles.meta}>
                  Sorted by {sortMode}. {groupedResults.reduce((sum, group) => sum + group.results.length, 0)}{" "}
                  items shown.
                </div>
              )}
            </div>

            <div className={styles.resultsToolbar}>
              <div className={styles.toolbarBlock}>
                <div className={styles.meta}>Filter by category</div>
                <div className={styles.filterRow}>
                  <button
                    className={`${styles.filter} ${
                      activeFilter === "all" ? styles.filterActive : ""
                    }`}
                    type="button"
                    onClick={() => setActiveFilter("all")}
                  >
                    All
                  </button>
                  {(Object.keys(CATEGORY_META) as ResearchCategory[]).map((category) => (
                    <button
                      key={category}
                      className={`${styles.filter} ${
                        activeFilter === category ? styles.filterActive : ""
                      }`}
                      type="button"
                      onClick={() => setActiveFilter(category)}
                    >
                      {CATEGORY_META[category].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.toolbarBlock}>
                <div className={styles.meta}>Sort</div>
                <div className={styles.toggleRow}>
                  <button
                    className={`${styles.toggle} ${
                      sortMode === "relevance" ? styles.toggleActive : ""
                    }`}
                    type="button"
                    onClick={() => setSortMode("relevance")}
                  >
                    Relevance
                  </button>
                  <button
                    className={`${styles.toggle} ${
                      sortMode === "recency" ? styles.toggleActive : ""
                    }`}
                    type="button"
                    onClick={() => setSortMode("recency")}
                  >
                    Recency
                  </button>
                </div>
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {!resultState && !error && (
              <div className={styles.empty}>
                Run a manual Exa search or upload a document to generate grouped research results.
              </div>
            )}

            {resultState?.mode === "document" && (
              <div className={styles.angles}>
                <div className={styles.angle}>
                  <strong>Document:</strong> {resultState.filename}
                </div>
                <div className={styles.angle}>
                  <strong>Precedent angle:</strong> {resultState.angles.precedent}
                </div>
                <div className={styles.angle}>
                  <strong>Opposing counsel angle:</strong> {resultState.angles.opposingCounsel}
                </div>
                <div className={styles.angle}>
                  <strong>Industry news angle:</strong> {resultState.angles.industryNews}
                </div>
              </div>
            )}

            <div className={styles.resultGroups}>
              {groupedResults.map((group) => (
                <section className={styles.group} key={group.category}>
                  <div className={styles.groupHeader}>
                    <div>
                      <div className={styles.kicker}>{CATEGORY_META[group.category].description}</div>
                      <h3>{group.heading}</h3>
                    </div>
                    {showSearchQueries && <div className={styles.query}>{group.searchQuery}</div>}
                  </div>

                  {group.results.length === 0 ? (
                    <div className={styles.empty}>No results matched this category.</div>
                  ) : (
                    <div className={styles.cards}>
                      {group.results.map((result) => (
                        <article className={styles.card} key={result.id}>
                          <div className={styles.cardTop}>
                            <div>
                              <a href={result.url} target="_blank" rel="noreferrer">
                                <h4 className={styles.cardTitle}>{result.title}</h4>
                              </a>
                            </div>
                            <div className={styles.score}>
                              {result.score === null ? "No score" : result.score.toFixed(2)}
                            </div>
                          </div>
                          <a className={styles.url} href={result.url} target="_blank" rel="noreferrer">
                            {result.url}
                          </a>
                          <p className={styles.snippet}>{result.snippet}</p>
                          <div className={styles.cardMeta}>
                            <span>{CATEGORY_META[result.category].label}</span>
                            <span>{formatDate(result.publishedDate)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>

          <aside
            className={`${styles.panel} ${styles.configPanel} ${
              configExpanded ? "" : styles.configPanelCollapsed
            }`}
          >
            <div className={styles.configHeader}>
              <div>
                <div className={styles.kicker}>Configuration</div>
                {configExpanded && <h2>Research controls</h2>}
              </div>
              <button
                className={styles.iconButton}
                type="button"
                onClick={() => setConfigExpanded((current) => !current)}
              >
                {configExpanded ? "Hide" : "Show"}
              </button>
            </div>

            {configExpanded && (
              <div className={styles.configBody}>
                <section className={styles.configSection}>
                  <div className={styles.sectionHeader}>
                    <h3>Relevant legal sites</h3>
                    <span className={styles.kicker}>Exa includeDomains</span>
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
                    <span className={styles.kicker}>Optional</span>
                  </div>
                  <textarea
                    className={styles.configTextarea}
                    placeholder="law360.com, regulations.gov"
                    value={customDomains}
                    onChange={(event) => setCustomDomains(event.target.value)}
                  />
                  <div className={styles.helper}>
                    Separate domains with commas or new lines. These values are sent to Exa as
                    `includeDomains`.
                  </div>
                </section>

                <section className={styles.configSection}>
                  <div className={styles.sectionHeader}>
                    <h3>Visibility</h3>
                    <span className={styles.kicker}>Debug</span>
                  </div>
                  <label className={styles.switchRow}>
                    <span>Show actual search queries</span>
                    <input
                      checked={showSearchQueries}
                      type="checkbox"
                      onChange={(event) => setShowSearchQueries(event.target.checked)}
                    />
                  </label>
                </section>

                {showSearchQueries && resultState && (
                  <section className={styles.configSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Queries being sent</h3>
                      <span className={styles.kicker}>Live</span>
                    </div>
                    <div className={styles.queryList}>
                      {resultState.mode === "manual" ? (
                        <div className={styles.queryCard}>{resultState.query}</div>
                      ) : (
                        <>
                          <div className={styles.queryCard}>{resultState.angles.precedent}</div>
                          <div className={styles.queryCard}>{resultState.angles.opposingCounsel}</div>
                          <div className={styles.queryCard}>{resultState.angles.industryNews}</div>
                        </>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
