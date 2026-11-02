"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentSecurityReport } from "@/lib/queries/work-notes/work-note-agent.api";

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const MASKED_SPAN =
  /\[\[WN_SEC:[A-Z_]+:[a-f0-9]{10,16}\]\]|__WN_PROTECTED_[A-Za-z0-9_]+?__/g;

const DUMMY_VALUE =
  /^(?:null|undefined|none|nil|true|false|string|number|boolean|any|object|required|optional|empty|redacted|hidden|masked|secret|password|passwd|token|changeme|placeholder|dummy|sample|example|test|todo|tbd|n\/a|your[_-]?[a-z_-]*|my[_-]?[a-z_-]*|\*+|x{3,}|\.{3,}|-+|_+|#+|•+|\$\{?|%[A-Z_]|\{\{|<|process\.env|import\.meta\.env|os\.environ|env\.|config\.|settings\.)/i;

export type PreSendSecurityScan = {
  blocked: boolean;
  categories: readonly string[];
};

const MASK_RULES: readonly {
  category: string;
  test: (clean: string) => boolean;
}[] = [
  {
    category: "CLOUD_KEY",
    test: (s) =>
      /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/.test(s) ||
      /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/.test(s) ||
      /\bGOCSPX-[A-Za-z0-9_-]{20,}/.test(s),
  },
  {
    category: "API_KEY",
    test: (s) =>
      /\bsk-(?:proj-|svcacct-|admin-|ant-)?[A-Za-z0-9_-]{20,}/.test(s) ||
      /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/.test(s) ||
      /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})/.test(
        s,
      ) ||
      /\bglpat-[A-Za-z0-9_-]{20,}/.test(s) ||
      /\bxox[abposr]-[A-Za-z0-9-]{10,}/.test(s) ||
      /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/.test(s) ||
      /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}/.test(s),
  },
  {
    category: "TOKEN",
    test: (s) => {
      if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(s))
        return true;
      const bearer = /\bBearer\s+([A-Za-z0-9._~+/-]{16,}=*)/i.exec(s);
      return Boolean(bearer && !DUMMY_VALUE.test(bearer[1]));
    },
  },
  {
    category: "CONNECTION_STRING",
    test: (s) => {
      const m =
        /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@/"'`]{1,100}:([^\s@/"'`]{3,200})@/i.exec(
          s,
        );
      return Boolean(m && !DUMMY_VALUE.test(m[1]));
    },
  },
  {
    category: "PASSWORD",
    test: (s) => {
      const assign =
        /(?:\b[\w.-]*(?:password|passwd|passphrase|pwd)|\bmk|mật\s?khẩu|mat\s?khau|matkhau)["']?\s*(?:[:=]|=>)\s*["']?([^\s"'\x60,;<>()[\]{}\\]{4,128})/giu;
      for (const m of s.matchAll(assign)) {
        const val = m[1];
        const after = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 3);
        if (!DUMMY_VALUE.test(val) && !/^\s*\(/.test(after)) return true;
      }
      const stmt =
        /(?:\bpassword|\bpasswd|\bmk|mật\s?khẩu|mat\s?khau|matkhau)\s+(?:là|la|is)\s+["']?([^\s"'\x60,;<>()[\]{}\\]{4,128})/giu;
      for (const m of s.matchAll(stmt)) {
        if (!DUMMY_VALUE.test(m[1]) && /[\d!@#$%^&*?_~.+-]/.test(m[1]))
          return true;
      }
      return false;
    },
  },
  {
    category: "CREDENTIAL",
    test: (s) => {
      const assign =
        /\b[\w.-]*(?:secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|credentials?|auth[_-]?key|signing[_-]?key)["']?\s*(?:[:=]|=>)\s*["']?([^\s"'\x60,;<>()[\]{}\\]{8,256})/gi;
      for (const m of s.matchAll(assign)) {
        const val = m[1];
        const after = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 3);
        const looksSecret =
          /\d/.test(val) ||
          val.length >= 16 ||
          (/[a-z]/.test(val) && /[A-Z]/.test(val)) ||
          /[^A-Za-z0-9]/.test(val);
        if (!DUMMY_VALUE.test(val) && !/^\s*\(/.test(after) && looksSecret)
          return true;
      }
      return false;
    },
  },
  {
    category: "EMAIL",
    test: (s) => {
      const re =
        /(?<![\w.+%-])([A-Za-z0-9._%+-]{1,64})@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,24})(?![A-Za-z0-9-])/g;
      for (const m of s.matchAll(re)) {
        const local = m[1].toLowerCase();
        const domain = m[2].toLowerCase();
        if (/^(?:git|noreply|no-reply|donotreply|do-not-reply)$/.test(local))
          continue;
        if (
          /(?:^|\.)(?:example\.(?:com|org|net)|test|invalid|localhost|local)$/.test(
            domain,
          )
        )
          continue;
        return true;
      }
      return false;
    },
  },
  {
    category: "PHONE",
    test: (s) =>
      /(?<![\d+])(?:\+84|0084|0)[\s.-]?[35789]\d(?:[\s.-]?\d){7}(?![\d])/.test(
        s,
      ) ||
      /(?<![\d+])(?:\+84|0084|0)[\s.-]?2\d(?:[\s.-]?\d){8}(?![\d])/.test(s),
  },
  {
    category: "NATIONAL_ID",
    test: (s) =>
      /(?:\bcmnd|\bcmt|\bcccd|căn\s?cước|hộ\s?chiếu|\bpassport)(?:\s*(?:số|so|no\.?|number))?\s*[:：]?\s*(?:\d{12}|\d{9}|[A-Z]\d{7,8})(?![\dA-Za-z])/iu.test(
        s,
      ),
  },
  {
    category: "BANK_ACCOUNT",
    test: (s) =>
      /(?:\bstk|số\s?tk|so\s?tk|số\s?tài\s?khoản|so\s?tai\s?khoan|\baccount\s?(?:no\.?|number)|\biban)\s*(?:[:：]|là|la|is)?\s*\d[\d .-]{4,24}\d(?!\d)/iu.test(
        s,
      ),
  },
];

/**
 * Lightweight client-side pre-send check so the author gets immediate visual
 * assurance (or Private Key block warning) before clicking Send / Improve with AI.
 * Authoritative enforcement and masking always run on the Backend Security Gateway.
 */
export function detectPreSendSensitiveData(
  texts: readonly string[],
): PreSendSecurityScan | null {
  const joined = texts
    .filter(Boolean)
    .map((t) => t.replace(INVISIBLE, "").replace(MASKED_SPAN, " "))
    .join("\n");
  if (!joined.trim()) return null;

  const hasPrivateKey =
    /-----BEGIN[ A-Z0-9]*PRIVATE KEY(?: BLOCK)?-----/.test(joined);
  const categories: string[] = [];
  if (hasPrivateKey) categories.push("PRIVATE_KEY");
  for (const rule of MASK_RULES) {
    if (rule.test(joined)) categories.push(rule.category);
  }
  if (categories.length === 0) return null;
  return {
    blocked: hasPrivateKey,
    categories,
  };
}

function formatCategoryLabels(
  categories: readonly string[],
  t: ReturnType<typeof useTranslations<"workNotes.agent">>,
): string {
  const unique = [...new Set(categories)];
  return unique
    .map((cat) => {
      const key = `securityCategory.${cat}`;
      return t.has(key) ? t(key) : cat;
    })
    .join(", ");
}

/**
 * Server-verified Security Gateway report banner shown on AI Proposal cards
 * and assistant chat replies whenever the Backend masked sensitive values.
 */
export function SecurityShieldBanner({
  report,
}: {
  report: AgentSecurityReport | null | undefined;
}) {
  const t = useTranslations("workNotes.agent");
  if (!report || report.input.maskedValues <= 0) return null;

  const categories = formatCategoryLabels(
    report.input.findings.map((f) => f.category),
    t,
  );
  const restoredLocally = report.output.unmasked > 0;

  return (
    <div
      data-testid="agent-security-shield"
      className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[11px] leading-relaxed text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100"
    >
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {t("securityShield.maskedTitle", {
            count: report.input.maskedValues,
            categories,
          })}
        </p>
        <p className="text-emerald-800 dark:text-emerald-200/90">
          {t(
            restoredLocally
              ? "securityShield.restoredLocallyHint"
              : "securityShield.keptMaskedHint",
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Live pre-send indicator shown as soon as sensitive data is typed/pasted into
 * the Note editor or AI chat input.
 */
export function PreSendSecurityNotice({
  scan,
}: {
  scan: PreSendSecurityScan | null;
}) {
  const t = useTranslations("workNotes.agent");
  if (!scan) return null;

  if (scan.blocked) {
    return (
      <div
        data-testid="agent-presend-security-notice"
        data-security-level="block"
        className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50/95 px-3 py-2 text-[11px] leading-relaxed text-error-800 dark:border-error-500/35 dark:bg-error-500/15 dark:text-error-200"
      >
        <ShieldAlert
          className="mt-0.5 size-4 shrink-0 text-error-600 dark:text-error-400"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">{t("securityShield.preSendBlockTitle")}</p>
          <p>{t("securityShield.preSendBlockHint")}</p>
        </div>
      </div>
    );
  }

  const categories = formatCategoryLabels(scan.categories, t);
  return (
    <div
      data-testid="agent-presend-security-notice"
      data-security-level="mask"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {t("securityShield.preSendMaskTitle", { categories })}
        </p>
        <p className="text-amber-800 dark:text-amber-200/90">
          {t("securityShield.preSendMaskHint")}
        </p>
      </div>
    </div>
  );
}

