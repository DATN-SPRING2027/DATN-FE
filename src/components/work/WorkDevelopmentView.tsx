"use client";

import { useState } from "react";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import type { CreatePreviewWorkItem, WorkItem } from "./work-types";

type DevSubtab =
  | "connections"
  | "prs"
  | "repos"
  | "vulns"
  | "deploys"
  | "suggestions";

const TOOL_GROUPS = [
  {
    title: "Source code management",
    description:
      "Link your tools to automatically map commits and pull requests to your work items.",
    tools: [
      { id: "github", name: "GitHub for Atlassian", badge: "GH" },
      { id: "bitbucket", name: "Bitbucket Cloud", badge: "BB" },
      { id: "gitlab", name: "GitLab for Jira Cloud", badge: "GL" },
    ],
  },
  {
    title: "Coding agents",
    description:
      "Add AI agents that read your repositories, generate code, and help with branches, commits, and pull requests.",
    tools: [
      { id: "copilot", name: "GitHub Copilot for Jira", badge: "CP" },
      { id: "cursor", name: "Cursor Agent", badge: "CR" },
      { id: "claude", name: "Claude Agent for Jira", badge: "CL" },
    ],
  },
  {
    title: "Security tools",
    description:
      "Connect security tools to monitor vulnerabilities in your codebase.",
    tools: [
      { id: "gh-security", name: "GitHub Advanced Security", badge: "GS" },
      { id: "snyk", name: "Snyk Security in Jira Cloud", badge: "SN" },
    ],
  },
] as const;

const PULL_REQUESTS = [
  {
    id: "pr-42",
    title: "#42 feat(retrieval): Hybrid Reranker BM25 pipeline integration",
    author: "Hoàng Nam",
    branch: "feature/rag-reranker",
    linkedKey: "KNW-142",
    status: "MERGED",
  },
  {
    id: "pr-39",
    title: "#39 fix(auth): Token refresh cookie rotation RFC-6749",
    author: "Quang Huy",
    branch: "bugfix/auth-cookie",
    linkedKey: "CSP-87",
    status: "OPEN (In Review)",
  },
  {
    id: "pr-37",
    title: "#37 feat(ui): ADS 2-column drawer with inline task editor",
    author: "Minh Anh",
    branch: "feature/task-drawer",
    linkedKey: "KNW-138",
    status: "MERGED",
  },
] as const;

const REPOSITORIES = [
  {
    id: "repo-fe",
    name: "continuum-ai / platform-frontend",
    branch: "main",
    updated: "5 minutes ago",
    stack: "Next.js 16 • TypeScript • Tailwind CSS",
  },
  {
    id: "repo-be",
    name: "continuum-ai / platform-backend",
    branch: "main",
    updated: "12 minutes ago",
    stack: "NestJS • Prisma • PostgreSQL",
  },
  {
    id: "repo-sag",
    name: "continuum-ai / sag-evidence-engine",
    branch: "main",
    updated: "1 hour ago",
    stack: "Python • FastEmbed • Qdrant",
  },
] as const;

const VULNERABILITIES = [
  {
    id: "vuln-axios",
    title: "axios < 1.7.4 SSRF vulnerability in node environments",
    pkg: "axios",
    severity: "Medium",
    remediation: "Upgrade to version >= 1.7.7",
  },
  {
    id: "vuln-tar",
    title: "tar < 6.2.1 Arbitrary File Creation",
    pkg: "tar",
    severity: "Low",
    remediation: "Run npm audit fix",
  },
] as const;

const DEPLOYMENTS = [
  {
    id: "dep-prod",
    env: "Production (Continuum AI Live)",
    release: "Release v1.2.4",
    deployedAt: "2 days ago",
    commit: "7c21f9a",
    status: "SUCCESSFUL",
  },
  {
    id: "dep-staging",
    env: "Staging (Pre-release Testing)",
    release: "Release v1.2.5-rc2",
    deployedAt: "3 hours ago",
    commit: "9b83c11",
    status: "RUNNING",
  },
] as const;

export default function WorkDevelopmentView({
  items,
  onCreateItem,
}: {
  items: readonly WorkItem[];
  onCreateItem: (item: CreatePreviewWorkItem) => void;
}) {
  const [subtab, setSubtab] = useState<DevSubtab>("connections");
  const [connectedTools, setConnectedTools] = useState<Set<string>>(
    () => new Set(["github"]),
  );
  const [createdFixIds, setCreatedFixIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [prSynced, setPrSynced] = useState(false);

  const completedCount = items.filter((item) => item.status === "DONE").length;
  const openBugsCount = items.filter(
    (item) => item.type === "BUG" && item.status !== "DONE",
  ).length;

  function toggleTool(toolId: string) {
    setConnectedTools((current) => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }

  function createVulnerabilityFixTask(vulnId: string, title: string) {
    if (createdFixIds.has(vulnId)) return;
    onCreateItem({
      title: `[Security Fix] ${title}`,
      type: "BUG",
      priority: "HIGH",
      assignee: PREVIEW_PEOPLE[0],
      dueDate: null,
      description: `Automated security remediation task created from Development tab: ${title}`,
    });
    setCreatedFixIds((current) => new Set(current).add(vulnId));
  }

  function copyCliCommand() {
    void navigator.clipboard?.writeText(
      "continuum-ai workspace sync --project DATN --env dev",
    );
    setCliCopied(true);
  }

  return (
    <section aria-label="Development and DevOps" className="min-w-0 space-y-5">
      {/* 1. Key Metrics Header & Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
            Key metrics
          </h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Beta
          </span>
        </div>

        {/* Row 1: 4 Primary Metric Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Work items
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white/90">
                  {completedCount}
                </span>
                <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                  +14%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Completed this week
              </p>
            </div>
            <svg
              width="88"
              height="36"
              viewBox="0 0 90 36"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 30 C 20 26, 35 28, 50 18 C 60 12, 68 8, 88 6"
                stroke="#465FFF"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Pull request cycle time
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white/90">
              4.2h
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Rolling 7-day median
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Lead time for changes
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white/90">
              1.4d
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Rolling 12-week average
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Deployment frequency
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white/90">
              2 / wk
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Weekly average
            </p>
          </div>
        </div>

        {/* Row 2: 5 Compact Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { title: "Work items", value: 0, sub: "Overdue" },
            { title: "Work items", value: 2, sub: "Reopened" },
            { title: "Bugs", value: openBugsCount, sub: "Open" },
            { title: "Pull requests", value: 1, sub: "Open" },
            { title: "Vulnerabilities", value: 0, sub: "Critical" },
          ].map((stat) => (
            <div
              key={`${stat.title}-${stat.sub}`}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
            >
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {stat.title}
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white/90">
                  {stat.value}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Sub-pill Tabs Bar */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-3 dark:border-gray-800"
        role="group"
        aria-label="Development sections"
      >
        {(
          [
            { id: "connections", label: "Connections" },
            { id: "prs", label: "Pull requests" },
            { id: "repos", label: "Repositories" },
            { id: "vulns", label: "Vulnerabilities" },
            { id: "deploys", label: "Deployments" },
            { id: "suggestions", label: "Work suggestions" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={subtab === tab.id}
            onClick={() => setSubtab(tab.id)}
            className={`h-9 cursor-pointer rounded-lg px-3.5 text-xs font-semibold transition ${
              subtab === tab.id
                ? "bg-brand-500 text-white shadow-theme-xs"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Subtab Panels */}
      {subtab === "connections" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            {TOOL_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  {group.title}
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {group.description}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {group.tools.map((tool) => {
                    const isConnected = connectedTools.has(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`flex cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border p-3.5 text-start transition ${
                          isConnected
                            ? "border-success-300 bg-success-50/50 dark:border-success-500/40 dark:bg-success-500/10"
                            : "border-gray-200 bg-gray-50/50 hover:border-brand-300 hover:bg-white dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-brand-500"
                        }`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          {tool.badge}
                        </span>
                        <div>
                          <span className="block text-xs font-semibold text-gray-900 dark:text-white/90">
                            {isConnected
                              ? `✓ Connected (${tool.name})`
                              : `Request ${tool.name}`}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                            {isConnected
                              ? "Click to disconnect"
                              : "Click to connect"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Setup & CLI Context Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Toolchain readiness
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs">
                <li className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    1. Source code management
                  </span>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                    Connected
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    2. Coding agents
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    Ready
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    3. Security tools
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    Optional
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Local developer setup
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Connect your local terminal or IDE straight to this Project
                workspace context.
              </p>
              <button
                type="button"
                onClick={copyCliCommand}
                className="mt-3 w-full cursor-pointer rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {cliCopied
                  ? "✓ Copied CLI Context Command"
                  : "Get workspace context in your IDE"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {subtab === "prs" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Related Pull Requests ({PULL_REQUESTS.length})
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Automatically mapped from branches and commits containing work
                item keys.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPrSynced(true)}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {prSynced ? "✓ Synced PRs" : "Sync PRs"}
            </button>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {PULL_REQUESTS.map((pr) => (
              <li
                key={pr.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                    {pr.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Created by <strong>{pr.author}</strong> • Branch:{" "}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                      {pr.branch}
                    </code>{" "}
                    • Linked:{" "}
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {pr.linkedKey}
                    </span>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    pr.status === "MERGED"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                      : "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                  }`}
                >
                  {pr.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subtab === "repos" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Connected Repositories ({REPOSITORIES.length})
          </h3>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {REPOSITORIES.map((repo) => (
              <li
                key={repo.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                    {repo.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Default branch: <code>{repo.branch}</code> • Updated:{" "}
                    {repo.updated} • {repo.stack}
                  </p>
                </div>
                <span className="text-xs font-semibold text-success-700 dark:text-success-400">
                  ● Synced
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subtab === "vulns" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Security & Dependency Vulnerabilities
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Automated security scans via Snyk Security & GitHub Dependabot.
              </p>
            </div>
            <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
              ✓ 0 Critical vulnerabilities
            </span>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {VULNERABILITIES.map((vuln) => {
              const created = createdFixIds.has(vuln.id);
              return (
                <li
                  key={vuln.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {vuln.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Package: <code>{vuln.pkg}</code> • Severity:{" "}
                      {vuln.severity} • Remediation: {vuln.remediation}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={created}
                    onClick={() =>
                      createVulnerabilityFixTask(vuln.id, vuln.title)
                    }
                    className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {created ? "✓ Fix task created" : "Create fix task"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {subtab === "deploys" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Deployments & Environments
          </h3>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {DEPLOYMENTS.map((dep) => (
              <li
                key={dep.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                    {dep.env}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {dep.release} • Deployed {dep.deployedAt} • Commit{" "}
                    <code>{dep.commit}</code>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    dep.status === "SUCCESSFUL"
                      ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                      : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  }`}
                >
                  {dep.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subtab === "suggestions" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            AI Copilot Work Suggestions
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Detects unlinked branches, commits, or PRs matching project work
            items.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3.5 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                Link commit <code>4e91a0</code> to work item KNW-142
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Commit message: &ldquo;fix: update BM25 citation weights&rdquo;
                matches active citation review task.
              </p>
            </div>
            <button
              type="button"
              disabled={suggestionApplied}
              onClick={() => setSuggestionApplied(true)}
              className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {suggestionApplied ? "✓ Applied" : "Apply suggestion"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
