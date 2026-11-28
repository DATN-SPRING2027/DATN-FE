# Langfuse Tracing baseline for Continuum

**Reference date:** 28 November 2026
**Purpose:** Reconstruct the current Langfuse Tracing feature set and UI as the benchmark for Continuum's admin RAG trace experience.

## Evidence and confidence

- Langfuse Cloud is v4-only since 16 November 2026. Its current data model is observations-first: individual operations are observation rows, and a trace is the group of observations sharing a trace ID. The Tracing table opens with root observations so the initial result is approximately one row per application request. [v4 rollout](https://langfuse.com/changelog/2026-08-17-langfuse-v4), [observations table](https://langfuse.com/faq/all/explore-observations-in-v4)
- The current trace detail was redesigned on 20 November 2026. The official description emphasizes reading the whole trace shape, zooming into the relevant operation, focusing on that observation's input/output/metadata, and keeping one layout across the full page, side peek and smaller screens. [Redesigned trace view](https://langfuse.com/changelog/2026-11-20-redesigned-trace-view)
- REA controlled browser evidence `ev_269756e79ade2abe1faca2098a86159a1fb514d52e512da4dc0f46392fb4a134` captured the current official trace-redesign page and its embedded product video. The frame visibly shows the dark trace workspace, operation hierarchy, graph region, selected-observation inspector, input/output/metadata, and review actions.
- Direct REA navigation to the example Cloud project redirected to account creation (`ev_f9185e0f4931facc74548320269c157c7e1d5843288d8e0795dd4712aadbc9a5`). A documented public trace route rendered the app shell/skeleton without hydrated trace content (`ev_495925fdb93621053d8ec03ccd5871eac9f68919d413a6ad690b0405b1aea8dc`). So the current product UI was reconstructed from first-party docs/changelogs and the official video frame; this was not an authenticated, interactive inspection of a live project.

## 1. The tracing model

Langfuse does not have a special RAG-only trace object. It records an application execution as **observations** grouped into a **trace**, with **sessions** grouping related traces such as turns in a conversation. Observations can be nested to show parent/child work. [Data model](https://langfuse.com/docs/observability/data-model)

Observation types include `event`, `span`, `generation`, `agent`, `tool`, `chain`, `retriever`, and `embedding`. A generation is where model/prompt/usage details belong; a retriever can show the query, returned documents and retrieval scores if the application sends them. Langfuse displays instrumented data; it does not automatically inspect an arbitrary vector database or infer which chunks reached the model. [Observation types](https://langfuse.com/docs/observability/features/observation-types), [Tracing guide](https://langfuse.com/docs/observability/get-started)

Observations can carry input/output, start/end timing, parentage, type/name, metadata, tags, environment, release/version, user/session, level/status, model and parameters, prompt reference/version, token usage, cost and time to first token. Data absent from the integration remains absent; Langfuse no longer estimates token counts when usage is not submitted. [Public API field groups](https://langfuse.com/docs/api-and-data-platform/features/public-api), [token and cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)

## 2. Current Tracing workspace

### Finding a run

The v4 entry point is an observations table rather than the older trace-only list. The default root-observation filter puts application entry points first; clearing it exposes individual retrievals, generations, tools and other operations. The table supports time ranges, columns, sorting, selection and facets with counts. [Observations table](https://langfuse.com/faq/all/explore-observations-in-v4)

The filter search bar and sidebar edit the same query. The bar autocompletes field names and observed values, converts applied expressions to chips, and serializes the complete query into the URL. It supports comparisons, wildcards, negation, `AND`/`OR`, dotted metadata and score paths, null checks, and input/output full-text search. The `Ask AI` helper can form or refine filters in natural language, but is beta and disabled until an organization admin enables it. [Filter search](https://langfuse.com/docs/observability/features/filter-search-bar), [full-text search](https://langfuse.com/docs/observability/features/full-text-search)

Saved views retain filters and table configuration. Selecting a row opens a peek so an operator can inspect the run without losing their place in the results; the trace can also be opened in its full page. Table and chart modes share the same query. The Pulse strip highlights time windows with unusual counts/cost/latency and can narrow the table to the selected interval. [Saved-view example](https://langfuse.com/faq/all/explore-observations-in-v4), [charting the table](https://langfuse.com/docs/observability/features/events-table-charts), [Pulse](https://langfuse.com/docs/observability/features/pulse)

### Reading one trace

The latest detail view keeps the observation hierarchy and the selected observation's content in one workspace. Its essential reading sequence is:

1. Read the trace/request identity and summary context.
2. See the run's shape in Tree, Timeline or Graph; use Log view when a chronological stream is easier to scan.
3. Select an observation and inspect its input, output and metadata without losing its place in the flow.
4. Annotate, comment, inspect scores, switch to structured JSON, or move to the related session/trace.

The redesigned view deliberately keeps the detail uncluttered around the selected observation and makes the same interaction work in the full view, peek and narrow layouts. The Timeline fits the full trace first, then supports pan/zoom, fit-to-trace, selecting a time range, and zooming directly to one operation. Observation type colors communicate the overall shape when labels no longer fit. [Trace redesign](https://langfuse.com/changelog/2026-11-20-redesigned-trace-view), [responsive Timeline](https://langfuse.com/changelog/2026-08-28-responsive-timeline)

Agent Graph has two useful modes: **Aggregated** combines repeated calls with counts and makes cycles readable; **Expanded** renders each call in execution order as a DAG. Graph appears for agentic traces inferred from observation types/timing/nesting or from a LangGraph integration. [Agent Graphs](https://langfuse.com/docs/observability/features/agent-graphs)

The detail view also surfaces status/level, model and prompt, token/cost breakdown, scores, comments, and metadata around the selected observation. Low-importance `DEBUG` observations can be hidden by minimum log level. Trace-level actions include JSON download and (where the project plan/settings permit) public sharing. [Log levels](https://langfuse.com/docs/observability/features/log-levels), [trace sharing](https://langfuse.com/docs/observability/features/url), [trace export](https://langfuse.com/faq/all/export-single-trace-or-session)

## 3. Complete feature inventory

| Area | Langfuse capability | Why it matters to RAG |
|---|---|---|
| **Instrumentation** | OpenTelemetry ingestion and SDK/framework integrations; nested observations with typed operations | Keeps retrieval, reranking, prompt assembly, generation, validation and tool calls individually inspectable |
| **Operation detail** | Input/output, metadata, timings, status/level, parent, IDs and type-specific fields | Reveals which query, context, result or step caused the response issue |
| **Model diagnostics** | Model and parameters, linked prompt/version, usage types, input/output tokens, cost, TTFT; model price definitions | Locates expensive/slow generations and relates regressions to a model or prompt change |
| **Trace explorer** | Root observations, rows/columns, sorting, facets, time range, selection/bulk actions | Triage the relevant operation or request before opening its details |
| **Search** | Filter DSL, autocomplete, chips, numeric/time operators, metadata/scores, full-text search, shareable URL, optional Ask AI | Find retrieval failures, timeouts, weak evidence and quality regressions without browsing every run |
| **Saved views** | Named table views that restore a query/configuration | One-click queues for slow retrieval, failed requests, low scores and expensive generations |
| **Trace views** | Tree, responsive Timeline, Graph (Aggregated/Expanded), Log | Different projections answer nesting, duration/order, repeated loops and chronological questions |
| **Peek and navigation** | Side peek plus full detail; table remains in context; documented keyboard navigation in the older peek flow | Compare multiple production runs quickly without losing filters |
| **Review** | Numeric/categorical/boolean/text scores, score comments, Annotate UI, Annotation Queues, queue keyboard shortcuts | Human review for retrieval relevance, faithfulness, answer relevance and citation quality |
| **Collaboration** | Comments/reactions on traces, observations and sessions; text-anchored comments on JSON | Discuss the exact bad chunk, model input or answer section |
| **Correction** | Corrected output and comparisons for reviewer-provided fixes | Capture a better answer for later evaluation or dataset curation |
| **Sessions/users** | Multi-trace session replay, message search, trace side panel, bookmarks, session/user-level scores and usage context | Investigate issues spanning several turns instead of treating every turn as unrelated |
| **Metrics** | Dashboards, same-query charts, Pulse outliers, metrics APIs, threshold alerts | Track latency, cost, volume, quality and error rates after traces are retained |
| **Topic discovery** | Public beta launched 24 Nov 2026: group traces by Intent, Sentiment, Outcome and Issues; Live maps/Snapshots with Treemap/Scatter | Finds recurring RAG failure classes not yet covered by hand-written filters |
| **Data movement** | Single-trace/session JSON download; filtered table export as CSV/JSON; public trace links subject to plan/settings | Share or analyze a reproducible run outside its detail page |
| **Adjacent products** | Prompt Management, datasets/experiments, evaluators, AI Gateway and model/pricing settings | Connects traces to improvements, but these are broader product areas—not automatic trace features |

Sources: [scores](https://langfuse.com/docs/evaluation/scores/overview), [manual scores](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-ui), [annotation queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues), [comments](https://langfuse.com/docs/observability/features/comments), [sessions](https://langfuse.com/docs/observability/features/sessions), [dashboards](https://langfuse.com/docs/metrics/features/custom-dashboards), [Topics](https://langfuse.com/docs/observability/features/topics), [exports](https://langfuse.com/docs/api-and-data-platform/features/export-from-ui).

## 4. RAG interpretation rules

- A `retriever` observation should contain the query/configuration and the returned documents/scores when that data is available to the instrumented application.
- A later generation should record the actual prompt/context it received if policy allows it. The retrieval result and model context are different facts; the trace should show both.
- Separate model invocations and tool/retrieval operations instead of wrapping a multi-step agent loop in one generation. This preserves the decision sequence and per-step cost/latency. [Trace best practices](https://langfuse.com/docs/observability/best-practices)
- Evaluators/scores are separate measurements. Tracing a document does not itself calculate retrieval relevance, faithfulness or answer relevance; those require an evaluator or a submitted score.
- Langfuse's docs recommend recording reasoning when the model/integration exposes it. For Continuum, preserve observable structured decisions and safe reason codes; do not represent hidden chain-of-thought as captured data or imply that an unlogged thought can be reconstructed.

## 5. Continuum implementation target

Adopt the Langfuse interaction model while keeping Continuum's RAG evidence lineage as the distinctive view:

1. **Explorer:** root RAG request table, time range, query/filter chips, outcome/status/duration facets, saved views and a useful empty state.
2. **Peek-to-detail:** selecting a request opens a side panel in place; expanding it keeps the same trace context and selection.
3. **Trace canvas:** Tree/Timeline/Graph/Log views over real parent-linked operations. The timeline must show recorded timings only; missing timings are explicitly unknown.
4. **Selected-operation inspector:** Preview/JSON, input/output/metadata, latency, status/reason, model/usage/cost where actually recorded, and scores/comments only when their backing workflow exists.
5. **RAG evidence lineage:** show each evidence reference across retrieved candidates → selected/ranked → packed → model context → final citations, with explicit present/removed/not observed/not recorded states. This should answer “where did this source go?” more directly than generic span inspection.
6. **Quality and operations layers:** human/automated scores, session replay, chart/Pulse, alerts and topic discovery follow after retained trace data and the required services/contracts exist.

## 6. Current Continuum/SAG boundary

The current worktree does not yet have Langfuse-level production tracing. The existing explorer reads frontend fixtures. SAG's opt-in JSON record provides run identity, total duration/first-text latency and evidence-capture lineage, but does not yet emit the complete per-operation span/timing/model-usage shape. The proposed `platform-rag-trace` OpenAPI is not approved, and the production diagnostics endpoint is for platform audit events rather than SAG RAG traces. See the existing [RAG trace feature plan](../tasks/platform-operator-complete-console-plan.md) and the backend [proposed RAG trace contract](../../runtime/SAG/docs/openapi/platform-rag-trace-draft.openapi.yaml) when wiring the next implementation slice.

Therefore, the feature inventory above is the **reference target**, not a claim that Continuum already supports these controls or that its current screen reads real traces. Keep fixture-only interactions visibly labeled until an approved API and persistence path serve real trace data.
