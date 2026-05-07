"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./page.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "judge" | "counsel" | "entity";

type IntelligenceResult = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedDate: string | null;
  highlights: string[];
  snippet: string;
  score: number | null;
};

type TabState = {
  results: IntelligenceResult[] | null;
  pending: boolean;
  error: string | null;
  executedQuery: string | null;
  executedRequest: Record<string, unknown> | null;
  executedResponse: Record<string, unknown> | null;
};

const COUNSEL_INCLUDE_DOMAINS = [
  "law360.com",
  "reuters.com",
  "courtlistener.org",
  "bloomberg.com"
];

// ─── Tab configuration ───────────────────────────────────────────────────────

const TAB_CONFIG = {
  judge: {
    label: "Judge Profile",
    description: "Behavioral pattern research",
    buildQuery: (judgeName: string) =>
      `Judge ${judgeName} ruling patterns summary judgment patent infringement federal court`,
    previewParams: {
      type: "auto",
      category: "people",
      numResults: 8,
      maxAgeHours: 720,
      highlights: true
    },
    westlawNote:
      "Westlaw does not index real-time judge behavior patterns. Coverage limited to indexed case law only.",
    rationale:
      "Behavioral pattern research. Westlaw surfaces case outcomes — not judicial decision-making tendencies, motion grant rates, or summary judgment disposition patterns for a specific judge."
  },
  counsel: {
    label: "Opposing Counsel",
    description: "Real-time firm intelligence",
    buildQuery: (firmName: string) =>
      `${firmName} patent infringement cases outcomes wins losses 2023-2025`,
    previewParams: {
      type: "fast",
      category: "news",
      numResults: 8,
      maxAgeHours: 168,
      highlights: true,
      includeDomains: COUNSEL_INCLUDE_DOMAINS
    },
    westlawNote:
      "Westlaw does not index real-time firm intelligence. Coverage limited to indexed case law only.",
    rationale:
      "Real-time firm intelligence. maxAgeHours: 168 (7 days) surfaces recent settlements, verdicts, and press coverage of opposing counsel — not available in Westlaw's indexed database."
  },
  entity: {
    label: "Entity Intelligence",
    description: "Live entity monitoring",
    buildQuery: (entityName: string) =>
      `${entityName} regulatory investigations antitrust patent disputes 2025`,
    previewParams: {
      type: "auto",
      category: "news",
      numResults: 10,
      maxAgeHours: 72,
      highlights: true,
      systemPrompt: "Prefer official sources and regulatory filings. Avoid duplicate results."
    },
    westlawNote:
      "Westlaw does not index real-time entity news. Coverage limited to indexed case law only.",
    rationale:
      "Live entity monitoring. maxAgeHours: 72 forces 72-hour freshness on regulatory filings, SEC actions, and DOJ activity — critical intelligence Westlaw cannot deliver in real time."
  }
} as const;

const TABS: TabId[] = ["entity", "counsel", "judge"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | null): string {
  if (!date) return "Date unavailable";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderHighlightedText(text: string, term: string) {
  if (!text || !term.trim()) {
    return text;
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark className={styles.keywordHighlight} key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function buildPreviewPayload(
  tab: TabId,
  query: string
): Record<string, unknown> {
  const { highlights: _h, ...restParams } = TAB_CONFIG[tab].previewParams as Record<string, unknown>;
  return {
    query,
    ...restParams,
    contents: { highlights: { numSentences: 2, highlightsPerUrl: 2 } }
  };
}

function makeTabState(): TabState {
  return {
    results: null,
    pending: false,
    error: null,
    executedQuery: null,
    executedRequest: null,
    executedResponse: null
  };
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<TabId>("judge");
  const [judgeName, setJudgeName] = useState("Hon. Lucy Koh");
  const [firmName, setFirmName] = useState("Quinn Emanuel");
  const [entityName, setEntityName] = useState("Apple Inc.");
  const [tabQueries, setTabQueries] = useState<Record<TabId, string>>({
    judge: TAB_CONFIG.judge.buildQuery("Hon. Lucy Koh"),
    counsel: TAB_CONFIG.counsel.buildQuery("Quinn Emanuel"),
    entity: TAB_CONFIG.entity.buildQuery("Apple Inc.")
  });
  const [showRawResponse, setShowRawResponse] = useState(false);

  const [westlawMode, setWestlawMode] = useState<Record<TabId, boolean>>({
    judge: false,
    counsel: false,
    entity: false
  });

  const [tabStates, setTabStates] = useState<Record<TabId, TabState>>({
    judge: makeTabState(),
    counsel: makeTabState(),
    entity: makeTabState()
  });

  const cfg = TAB_CONFIG[activeTab];
  const ts = tabStates[activeTab];
  const isWestlaw = westlawMode[activeTab];
  const liveQuery = tabQueries[activeTab];

  const previewPayload = useMemo(
    () => buildPreviewPayload(activeTab, liveQuery),
    [activeTab, liveQuery]
  );

  // After a run, show the actual request returned from the API; otherwise show preview
  const inspectorPayload = ts.executedRequest ?? previewPayload;

  async function runSearch() {
    setTabStates((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], pending: true, error: null }
    }));

    try {
      const clientRequest = {
        url: "/api/intelligence",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { tab: activeTab, judgeName, firmName, entityName, query: liveQuery }
      };
      console.groupCollapsed(`[Intelligence] ${activeTab} request`);
      console.log("Request", clientRequest);
      console.log("Exa request preview", previewPayload);
      console.groupEnd();

      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientRequest.body)
      });

      const data = (await res.json()) as {
        results?: IntelligenceResult[];
        query?: string;
        request?: Record<string, unknown>;
        response?: Record<string, unknown>;
        error?: string;
        attemptedQuery?: string;
      };

      console.groupCollapsed(`[Intelligence] ${activeTab} response`);
      console.log("Status", res.status);
      console.log("Response JSON", data);
      console.groupEnd();

      if (!res.ok) {
        throw Object.assign(new Error(data.error || "Search failed."), {
          attemptedQuery: data.attemptedQuery
        });
      }

      setTabStates((prev) => ({
        ...prev,
        [activeTab]: {
          pending: false,
          error: null,
          results: data.results ?? [],
          executedQuery: data.query ?? null,
          executedRequest: data.request ?? null,
          executedResponse: data.response ?? data
        }
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed.";
      console.groupCollapsed(`[Intelligence] ${activeTab} error`);
      console.error(err);
      console.groupEnd();
      setTabStates((prev) => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          pending: false,
          error: msg,
          executedResponse: null
        }
      }));
    }
  }

  function toggleWestlaw() {
    setWestlawMode((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }));
  }

  function switchTab(tabId: TabId) {
    setActiveTab(tabId);
    // Reset Westlaw mode when switching tabs so Exa results are front and center
    setWestlawMode((prev) => ({ ...prev, [tabId]: false }));
  }

  function updateQueryForActiveTab(query: string) {
    setTabQueries((prev) => ({ ...prev, [activeTab]: query }));
  }

  function syncQuery(tabId: TabId, value: string) {
    setTabQueries((prev) => ({
      ...prev,
      [tabId]: TAB_CONFIG[tabId].buildQuery(value)
    }));
  }

  return (
    <div className={styles.page}>
      {/* ── Site header ── */}
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <span className={styles.brandName}>Harvey</span>
            <span className={styles.brandSep}>|</span>
            <span className={styles.brandProduct}>Legal Intelligence</span>
          </div>
          <div className={styles.headerRight}>
            <Link href="/" className={styles.navLink}>
              Neural Search →
            </Link>
            <span className={styles.poweredBy}>Powered by Exa</span>
          </div>
        </div>
        <div className={styles.goldRule} />
      </header>

      {/* ── Active matter banner ── */}
      <div className={styles.matterBanner}>
        <div className={styles.matterInner}>
          <div className={styles.matterLeft}>
            <div className={styles.matterLabel}>Active Matter</div>
            <div className={styles.matterTitle}>Apple Inc. v. Doe — Patent Infringement</div>
          </div>
          <div className={styles.matterFields}>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>Judge</span>
              <input
                className={styles.matterInput}
                value={judgeName}
                onChange={(e) => {
                  setJudgeName(e.target.value);
                  syncQuery("judge", e.target.value);
                }}
                placeholder="Judge name"
              />
            </label>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>Opposing Counsel</span>
              <input
                className={styles.matterInput}
                value={firmName}
                onChange={(e) => {
                  setFirmName(e.target.value);
                  syncQuery("counsel", e.target.value);
                }}
                placeholder="Firm name"
              />
            </label>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>Entity</span>
              <input
                className={styles.matterInput}
                value={entityName}
                onChange={(e) => {
                  setEntityName(e.target.value);
                  syncQuery("entity", e.target.value);
                }}
                placeholder="Entity name"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {TABS.map((tabId) => {
          const tabTs = tabStates[tabId];
          return (
            <button
              key={tabId}
              className={`${styles.tab} ${activeTab === tabId ? styles.tabActive : ""}`}
              onClick={() => switchTab(tabId)}
              type="button"
            >
              <span className={styles.tabLabel}>{TAB_CONFIG[tabId].label}</span>
              <span className={styles.tabMeta}>{TAB_CONFIG[tabId].description}</span>
              {tabTs.results !== null && !tabTs.pending && (
                <span className={styles.tabBadge}>{tabTs.results.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main workspace ── */}
      <div className={styles.workspace}>
        {/* Left: API Inspector */}
        <div className={styles.inspector}>
          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>API Call Inspector</div>
            <div className={styles.endpoint}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointUrl}>api.exa.ai/search</span>
            </div>
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Query editor</div>
            <textarea
              className={styles.queryEditor}
              value={liveQuery}
              onChange={(e) => updateQueryForActiveTab(e.target.value)}
            />
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Parameters to be sent</div>
            <pre className={styles.jsonBlock}>{prettyJson(previewPayload)}</pre>
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Why these parameters?</div>
            <p className={styles.rationaleText}>{cfg.rationale}</p>
          </div>

          <div className={styles.inspectorAction}>
            <button
              className={styles.runButton}
              onClick={runSearch}
              disabled={ts.pending}
              type="button"
            >
              {ts.pending ? "Searching..." : ts.results !== null ? "Re-run search" : "Run search"}
            </button>
          </div>
        </div>

        {/* Right: Results panel */}
        <div className={styles.resultsPanel}>
          <div className={styles.resultsPanelHeader}>
            <div className={styles.resultsPanelTitle}>
              {isWestlaw ? "Westlaw Coverage" : "Exa Results"}
              {ts.results !== null && !isWestlaw && !ts.pending && (
                <span className={styles.resultCount}>{ts.results.length} results</span>
              )}
            </div>
            <button
              className={`${styles.westlawToggle} ${isWestlaw ? styles.westlawActive : ""}`}
              onClick={toggleWestlaw}
              type="button"
            >
              {isWestlaw ? "← Back to Exa" : "vs Westlaw"}
            </button>
          </div>

          <div className={styles.resultsPanelBody}>
            {/* ── Westlaw comparison pane ── */}
            {isWestlaw && (
              <div className={styles.westlawPane}>
                <div className={styles.westlawGlyph}>⚖</div>
                <div className={styles.westlawCoverageLabel}>Coverage Analysis</div>
                <h2 className={styles.westlawHeading}>Coverage Gap</h2>
                <div className={styles.westlawDivider} />
                <p className={styles.westlawMessage}>{cfg.westlawNote}</p>
                <p className={styles.westlawSub}>
                  Traditional legal research platforms index curated case law and statutory
                  databases. They cannot access the live web intelligence that Exa retrieves
                  in real time for this class of signal.
                </p>
                <div className={styles.westlawExaNote}>
                  Exa retrieves this intelligence live from the open web
                </div>
              </div>
            )}

            {/* ── Loading skeleton ── */}
            {!isWestlaw && ts.pending && (
              <div className={styles.loadingPane}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </div>
            )}

            {/* ── Error state (shows attempted query for conversational demo) ── */}
            {!isWestlaw && !ts.pending && ts.error && (
              <div className={styles.errorPane}>
                <div className={styles.errorAttempted}>Search attempted with query</div>
                <div className={styles.errorQuery}>
                  &ldquo;{ts.executedQuery ?? String(previewPayload.query ?? "")}&rdquo;
                </div>
                <div className={styles.errorMessage}>{ts.error}</div>
                <div className={styles.errorContinue}>
                  The query above was sent to Exa. You can continue the demo conversation
                  using this query as context — the search intent and parameters are fully
                  visible in the inspector.
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!isWestlaw && !ts.pending && !ts.error && ts.results === null && (
              <div className={styles.emptyPane}>
                <div className={styles.emptyGlyph}>◈</div>
                <p className={styles.emptyText}>
                  Run the search to retrieve live intelligence from Exa&rsquo;s web index.
                  The query and parameters are visible in the inspector.
                </p>
              </div>
            )}

            {/* ── Results ── */}
            {!isWestlaw && !ts.pending && ts.results !== null && (
              <div className={styles.resultsStack}>
                <div className={styles.resultsList}>
                  {ts.results.length === 0 ? (
                    <div className={styles.emptyPane}>
                      <p className={styles.emptyText}>
                        No results returned for this query. Try adjusting the matter context
                        and re-running.
                      </p>
                    </div>
                  ) : (
                    ts.results.map((result) => (
                      <article key={result.id} className={styles.resultCard}>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.resultTitleLink}
                        >
                          <h3 className={styles.resultTitle}>{result.title}</h3>
                        </a>
                        <div className={styles.resultCitation}>
                          <span>{result.domain}</span>
                          <span className={styles.citationDot}>&middot;</span>
                          <span>{formatDate(result.publishedDate)}</span>
                        </div>
                        {result.highlights.length > 0 ? (
                          <div className={styles.highlights}>
                            {result.highlights.slice(0, 2).map((hl, i) => (
                              <div key={i} className={styles.highlight}>
                                <span className={styles.highlightLabel}>Highlight</span>
                                {activeTab === "counsel"
                                  ? renderHighlightedText(hl, firmName)
                                  : hl}
                              </div>
                            ))}
                          </div>
                        ) : result.snippet ? (
                          <p className={styles.snippet}>
                            {activeTab === "counsel"
                              ? renderHighlightedText(result.snippet, firmName)
                              : result.snippet}
                          </p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>

                <div className={styles.rawResponseSection}>
                  <button
                    className={styles.rawResponseToggle}
                    onClick={() => setShowRawResponse((current) => !current)}
                    type="button"
                  >
                    {showRawResponse ? "Hide raw API response" : "Show raw API response"}
                  </button>
                  {showRawResponse && (
                    <pre className={styles.rawResponseBlock}>
                      {prettyJson(ts.executedResponse ?? {})}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
