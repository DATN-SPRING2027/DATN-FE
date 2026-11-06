import type { UniverseKnowledgeUnit } from "@/lib/queries/knowledge-universe/knowledge-universe.types";

const CONNECTOR_HASH_RE =
  /(?:^(?:confluence|gdrive|notion|sharepoint|slack|jira|github)[_ -]+(?:dsid[_ -]*)?|\b(?:dsid[_ -]?)?[0-9a-f]{16,64}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)/i;

const METADATA_LINE_RE =
  /^(?:---|(?:document[_ ]id|project[_ ]id|organization[_ ]id|owner[_ ]id|file[_ ]path|access[_ ]groups|created[_ ]at|updated[_ ]at|version|classification|scope|status|source[_ ]type|release|benchmark)\s*[:·|])/i;

const NOISY_LABEL_RE =
  /^(?:---|document[_ ]?id|project[_ ]?id|organization[_ ]?id|source[_ ]?type|release|benchmark|version|status|owners?|purpose|summary|notes?|overview|table of contents|change ?log|all|doc|grp|org|nsc|staff|prj|adr-\d+|a100|h100|accessdenied)$/i;

const TECHNICAL_TOKEN_RE =
  /^(?:--?[a-z0-9_.-]+|\/[a-z0-9_/{}:.-]+|[a-z0-9_]+:[a-z0-9_:*.-]+|[a-z0-9_]+\{[a-z0-9_,]+\}|dsid[_ -]?[0-9a-f]+|[0-9a-f]{16,64})$/i;

/**
 * Repairs replacement characters (\uFFFD), strips structural outline prefixes
 * such as "H) ", "K) ", "1) ", and normalizes common technical acronyms.
 */
export function humanizeHeadingSegment(raw: string): string {
  if (!raw) return "";
  let text = raw
    // Repair common UTF-8 apostrophe mojibake: Don\uFFFDt -> Don't
    .replace(/([A-Za-z])\uFFFD([A-Za-z])/g, "$1'$2")
    // Repair paired replacement characters around quoted questions
    .replace(/\uFFFD([^\uFFFD]+)\uFFFD/g, "“$1”")
    .replace(/\uFFFD/g, "")
    .trim();

  // Strip structural list prefixes like "H) ", "K) ", "1) ", "2.1) "
  text = text
    .replace(/^(?:[A-Z]|\d{1,2}(?:\.\d{1,2})?)\)\s+/i, "")
    .replace(/^(?:Section|Part|Chapter)\s+\d+[:.)\s-]+/i, "")
    .trim();

  // Normalize Title-Case acronyms and contractions often produced by slug-to-title parsers
  text = text
    .replace(/\bFaq\b/g, "FAQ")
    .replace(/\bCi\b/g, "CI")
    .replace(/\bCd\b/g, "CD")
    .replace(/\bKms\b/g, "KMS")
    .replace(/\bSoc\b/g, "SOC")
    .replace(/\bApi\b/g, "API")
    .replace(/\bSiem\b/g, "SIEM")
    .replace(/\bRng\b/g, "RNG")
    .replace(/\bRbac\b/g, "RBAC")
    .replace(/\bSso\b/g, "SSO")
    .replace(/\bHsm\b/g, "HSM")
    .replace(/\bGcp\b/g, "GCP")
    .replace(/\bAws\b/g, "AWS")
    .replace(/\bDont\b/g, "Don't")
    .replace(/\bCant\b/g, "Can't")
    .replace(/\bWont\b/g, "Won't")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOr\b/g, "or");

  // Polish known compound document headings into natural editorial titles
  text = text
    .replace(/^Security FAQ What We Do/i, "Security FAQ: What We Do")
    .replace(/^Runbook Rollout/i, "Runbook: Rollout")
    .replace(
      /^Key Management Standard KMS Integrations$/i,
      "Key Management Standard (KMS) Integrations",
    );

  return text.trim();
}

export function isNoisyTechnicalLabel(raw: string): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;
  if (
    NOISY_LABEL_RE.test(trimmed) ||
    METADATA_LINE_RE.test(trimmed) ||
    TECHNICAL_TOKEN_RE.test(trimmed) ||
    CONNECTOR_HASH_RE.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function knowledgeDocumentTitle(
  filename: string,
  headingHint?: string,
): string {
  const rootHeading = headingHint?.includes(">")
    ? headingHint.split(">")[0]?.trim()
    : headingHint?.trim();

  const cleanHeading = rootHeading ? humanizeHeadingSegment(rootHeading) : "";
  const rawName = (filename ?? "").trim();

  // If the filename contains a connector prefix / hex dsid hash and we have a semantic heading, use the heading
  if (
    cleanHeading.length >= 4 &&
    !isNoisyTechnicalLabel(cleanHeading) &&
    (!rawName || CONNECTOR_HASH_RE.test(rawName))
  ) {
    return cleanHeading;
  }

  const stripped = rawName
    .replace(/\.(?:docx?|pdf|md|txt|html?)$/i, "")
    .replace(/_v\d+(?:_SUPERSEDED)?$/i, "")
    .replace(
      /^(?:confluence|gdrive|notion|sharepoint|slack|jira|github)[_ -]+(?:dsid[_ -]*)?/i,
      "",
    )
    .replace(/\b(?:dsid[_ -]?)?[0-9a-f]{16,64}\b/gi, "")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "",
    )
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length >= 3 && !isNoisyTechnicalLabel(stripped)) {
    return humanizeHeadingSegment(stripped);
  }

  if (cleanHeading.length >= 3) {
    return cleanHeading;
  }

  return "Project Document";
}

export function knowledgePassage(content: string): {
  text: string;
  offset: number;
} {
  const frontMatter = content.match(
    /^\s*---\s*\r?\n[\s\S]*?\r?\n---(?:\s*\r?\n|$)/,
  );
  let offset = frontMatter?.[0].length ?? 0;

  // Also strip leading key-value metadata header blocks (e.g. Source type / Document ID / Release / Benchmark)
  const remaining = content.slice(offset);
  const kvHeaderMatch = remaining.match(
    /^(?:\s*(?:Source type|Document ID|Project ID|Release|Benchmark|Version|Classification|Status)\s*:[^\r\n]*\r?\n)+/i,
  );
  if (kvHeaderMatch) {
    offset += kvHeaderMatch[0].length;
  }

  const leadingSpace = content.slice(offset).match(/^\s*/)?.[0].length ?? 0;
  const cleanedText = content
    .slice(offset + leadingSpace)
    .replace(/([A-Za-z])\uFFFD([A-Za-z])/g, "$1'$2")
    .replace(/\uFFFD([^\uFFFD]+)\uFFFD/g, "“$1”")
    .replace(/\uFFFD/g, "")
    .trimEnd();

  return {
    text: cleanedText,
    offset: offset + leadingSpace,
  };
}

export function knowledgeText(raw: string): string {
  return humanizeHeadingSegment(
    raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^[\s#>*-]+/gm, "")
      .replace(/[*`_]/g, "")
      .replace(/\|/g, " · ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function knowledgeUnitTitle(
  unit: Pick<
    UniverseKnowledgeUnit,
    "label" | "preview" | "heading" | "document_name"
  >,
): string {
  const headingParts = (unit.heading ?? "")
    .split(">")
    .map((part) => humanizeHeadingSegment(part))
    .filter(Boolean);

  const deepestSection =
    headingParts.length > 1 ? (headingParts.at(-1) ?? "") : "";
  const parentSection =
    headingParts.length > 2 ? (headingParts.at(-2) ?? "") : "";

  const rawLabel = (unit.label ?? "").trim();
  const labelIsUsable =
    rawLabel.length >= 6 &&
    !isNoisyTechnicalLabel(rawLabel) &&
    !/^(?:[A-Z]|\d{1,2})\)\s+/i.test(rawLabel);

  const candidates = [
    deepestSection,
    labelIsUsable ? rawLabel : "",
    parentSection,
    knowledgePassage(unit.preview ?? "").text.split(/\r?\n/)[0] ?? "",
    headingParts[0] ?? "",
  ];

  for (const value of candidates) {
    const clean = knowledgeText(value ?? "");
    if (
      clean.length >= 5 &&
      !isNoisyTechnicalLabel(clean) &&
      !METADATA_LINE_RE.test((value ?? "").trim()) &&
      !METADATA_LINE_RE.test(clean) &&
      !/^\w+[ _]?id\b/i.test(clean)
    ) {
      const title = clean
        .replace(/\s*\[(?:DOC|PRJ|NSC)[^\]]*\]/g, "")
        .replace(/^(?:DOC|PRJ|NSC)\d+\s+/i, "")
        .trim();
      if (title.length >= 4 && title.length <= 84) {
        return title;
      }
      if (title.length > 84) {
        return `${title.slice(0, 81).trimEnd()}…`;
      }
    }
  }
  return knowledgeDocumentTitle(unit.document_name, unit.heading);
}

/**
 * Disambiguates unit titles within the same document group so two units sharing
 * the same section heading never render as identical duplicate rows in the Browse drawer.
 */
export function disambiguateUnitTitles(
  units: UniverseKnowledgeUnit[],
): Map<string, string> {
  const result = new Map<string, string>();
  const byTitle = new Map<string, UniverseKnowledgeUnit[]>();

  for (const unit of units) {
    const base = knowledgeUnitTitle(unit);
    result.set(unit.id, base);
    const list = byTitle.get(base) ?? [];
    list.push(unit);
    byTitle.set(base, list);
  }

  for (const [baseTitle, group] of byTitle.entries()) {
    if (group.length <= 1) continue;
    const baseLower = baseTitle.toLowerCase();

    group.forEach((unit, idx) => {
      const passage = knowledgePassage(unit.preview ?? "").text;
      const lines = passage
        .split(/\r?\n/)
        .map((line) => knowledgeText(line))
        .filter(
          (line) =>
            line.length >= 6 &&
            !isNoisyTechnicalLabel(line) &&
            !line.toLowerCase().startsWith(baseLower) &&
            !baseLower.startsWith(line.toLowerCase()),
        );

      const snippet = lines[0];
      if (snippet) {
        const shortSnippet =
          snippet.length > 38 ? `${snippet.slice(0, 36).trimEnd()}…` : snippet;
        result.set(unit.id, `${baseTitle} · ${shortSnippet}`);
      } else if (idx > 0) {
        result.set(unit.id, `${baseTitle} (${idx + 1})`);
      }
    });
  }

  return result;
}

export function knowledgePreviewScore(unit: UniverseKnowledgeUnit): number {
  const preview = unit.preview.trim();
  if (
    /^(?:---|\||document_id|project_id|source type:)/i.test(preview) ||
    /superseded|historical|historic|version lineage/i.test(
      `${unit.document_name} ${unit.heading}`,
    )
  ) {
    return -100;
  }
  const prose = !/^[*#>-]/.test(preview);
  return (
    (prose ? 20 : 0) +
    (unit.heading.includes(">") ? 8 : 0) +
    Math.min(unit.cross_doc_synapse_count ?? 0, 20) * 0.4 -
    Math.abs(preview.length - 160) / 40
  );
}

function shortenRegionHeading(raw: string): string {
  const clean = humanizeHeadingSegment(raw)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/Security FAQ/i.test(clean)) return "Security & Compliance FAQ";
  if (/CI Eval Determinism/i.test(clean)) return "CI Determinism & Gating";
  if (/Runbook.*Rollout/i.test(clean)) return "Rollout & Traffic Split";
  if (/Key Management Standard/i.test(clean)) return "KMS & Key Management";
  if (/Topic-by-topic guidance/i.test(clean)) return "Compliance & Policy Guidance";
  if (/Approved language patterns/i.test(clean)) return "Approved Security Responses";
  if (/Recommended CI strategy/i.test(clean)) return "CI Evaluation Strategy";
  if (/RNG handling/i.test(clean)) return "RNG & Seed Standards";
  if (/Metric gating rules/i.test(clean)) return "Metric Gating Rules";
  if (/Logging and artifacts/i.test(clean)) return "Logging & Artifacts";
  if (/Required logging/i.test(clean)) return "Logging & Telemetry";

  if (clean.length <= 36) {
    return clean.replace(/[\s,;:-]+$/g, "");
  }
  const words = clean.split(" ").slice(0, 4);
  while (
    words.length > 2 &&
    /^(?:and|or|of|for|in|to|with|by|the|a|an|&)$/i.test(
      words[words.length - 1].replace(/[,;:.]/g, ""),
    )
  ) {
    words.pop();
  }
  return words.join(" ").replace(/[\s,;:-]+$/g, "");
}

export function knowledgeRegionTitle(
  units: UniverseKnowledgeUnit[],
  routingLabel: string,
): string | null {
  const descriptive = units.filter(
    (unit) =>
      !/^(?:---|\|[\s\S]*Document ID|document_id)/i.test(
        unit.preview.replace(/\*/g, "").trim(),
      ),
  );
  if (!descriptive.length) return null;

  const topics = [
    { label: "Payments", pattern: /payment|checkout/i, hint: /^HTTP$/i },
    {
      label: "Partner integrations",
      pattern: /partner|merchant|pulsepay|integration|webhook/i,
      hint: /meridian/i,
    },
    {
      label: "Access & governance",
      pattern: /security|access|audit|governance/i,
      hint: /authorized|hmac/i,
    },
    {
      label: "Search & discovery",
      pattern: /search|catalog|inventory|promotion|analytics/i,
      hint: /^SKU$/i,
    },
    {
      label: "Data platform",
      pattern: /platform|charter|pilot|release|weekly|decision/i,
      hint: /^DOC$/i,
    },
    {
      label: "Orders & fulfillment",
      pattern: /order|fulfillment|refund|cancellation/i,
      hint: /fulfillment/i,
    },
  ];
  const ranked = topics
    .map((topic) => {
      const count = descriptive.filter((unit) =>
        topic.pattern.test(unit.document_name),
      ).length;
      return {
        ...topic,
        score: count + (count && topic.hint.test(routingLabel) ? 2 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);
  if (ranked[0].score >= Math.max(2, descriptive.length * 0.3)) {
    return ranked[0].label;
  }

  // Derive semantic region label from the dominant section/document headings in this cluster
  const subSectionCounts = new Map<string, number>();
  const rootSectionCounts = new Map<string, number>();

  for (const unit of descriptive) {
    const parts = (unit.heading ?? "")
      .split(">")
      .map((p) => humanizeHeadingSegment(p))
      .filter((p) => p.length >= 4 && !isNoisyTechnicalLabel(p));

    if (parts.length >= 2) {
      const sub = shortenRegionHeading(parts[1]);
      if (sub && !/^(?:Summary|Purpose|Owners|Notes|Definitions)$/i.test(sub)) {
        subSectionCounts.set(sub, (subSectionCounts.get(sub) ?? 0) + 1);
      }
    }
    const root = parts[0]
      ? shortenRegionHeading(parts[0])
      : shortenRegionHeading(
          knowledgeDocumentTitle(unit.document_name, unit.heading),
        );
    if (root && root !== "Project Document") {
      rootSectionCounts.set(root, (rootSectionCounts.get(root) ?? 0) + 1);
    }
  }

  const topRoot = Array.from(rootSectionCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topSub = Array.from(subSectionCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];

  if (topSub && topSub[1] >= Math.max(2, descriptive.length * 0.45)) {
    return topSub[0];
  }
  if (topRoot && topRoot[1] >= 1) {
    return topRoot[0];
  }

  return null;
}

/**
 * Produces candidate labels for a cortical region node in priority order so callers
 * can pick the first candidate not yet claimed by a sibling region on the 3D canvas.
 */
export function knowledgeRegionCandidates(
  units: UniverseKnowledgeUnit[],
  routingLabel: string,
  fallbackLabel: string,
): string[] {
  const candidates: string[] = [];
  const pushUnique = (val: string | null | undefined) => {
    const clean = (val ?? "").trim();
    if (
      clean &&
      !isNoisyTechnicalLabel(clean) &&
      !candidates.some((c) => c.toLowerCase() === clean.toLowerCase())
    ) {
      candidates.push(clean);
    }
  };

  pushUnique(knowledgeRegionTitle(units, routingLabel));

  const subCounts = new Map<string, number>();
  const deepCounts = new Map<string, number>();
  const rootCounts = new Map<string, number>();
  const unitTitleCounts = new Map<string, number>();
  for (const unit of units) {
    const parts = (unit.heading ?? "")
      .split(">")
      .map((p) => humanizeHeadingSegment(p))
      .filter((p) => p.length >= 4 && !isNoisyTechnicalLabel(p));
    if (parts[1]) {
      const sub = shortenRegionHeading(parts[1]);
      if (!/^(?:Summary|Purpose|Owners|Notes|Definitions)$/i.test(sub)) {
        subCounts.set(sub, (subCounts.get(sub) ?? 0) + 1);
      }
    }
    for (const deepPart of parts.slice(2)) {
      const deep = shortenRegionHeading(deepPart);
      if (
        deep.length >= 4 &&
        !/^(?:Summary|Purpose|Owners|Notes|Definitions)$/i.test(deep)
      ) {
        deepCounts.set(deep, (deepCounts.get(deep) ?? 0) + 1);
      }
    }
    if (parts[0]) {
      const root = shortenRegionHeading(parts[0]);
      rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1);
    }
    const docClean = shortenRegionHeading(
      knowledgeDocumentTitle(unit.document_name, unit.heading),
    );
    if (docClean && docClean !== "Project Document") {
      rootCounts.set(docClean, (rootCounts.get(docClean) ?? 0) + 1);
    }
    const unitTitle = shortenRegionHeading(knowledgeUnitTitle(unit));
    if (
      unitTitle &&
      unitTitle.length >= 5 &&
      !isNoisyTechnicalLabel(unitTitle)
    ) {
      unitTitleCounts.set(unitTitle, (unitTitleCounts.get(unitTitle) ?? 0) + 1);
    }
  }

  for (const [sub] of Array.from(subCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    pushUnique(sub);
  }
  for (const [deep] of Array.from(deepCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    pushUnique(deep);
  }
  for (const [root] of Array.from(rootCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    pushUnique(root);
  }
  for (const [uTitle] of Array.from(unitTitleCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    pushUnique(uTitle);
  }

  const cleanRouting = humanizeHeadingSegment(routingLabel ?? "");
  if (cleanRouting && !isNoisyTechnicalLabel(cleanRouting)) {
    pushUnique(cleanRouting);
  }

  pushUnique(fallbackLabel);
  return candidates.length > 0 ? candidates : [fallbackLabel];
}
