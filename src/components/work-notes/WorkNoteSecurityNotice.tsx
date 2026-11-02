"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentSecurityReport } from "@/lib/queries/work-notes/work-note-agent.api";

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const MASKED_SPAN =
  /\[\[WN_SEC:[A-Z_]+:[a-f0-9]{10,16}\]\]|__WN_PROTECTED_[A-Za-z0-9_]+?__/g;
export const MASKED_PLACEHOLDER_GLOBAL =
  /\[\[WN_SEC:([A-Z_]+):[a-f0-9]{10,16}\]\]/g;

/**
 * Matches backend `isDummyValue` (`sensitive-data.rules.ts`) with full start+end anchors
 * on placeholder words and repeated symbol runs so real secrets prefixed with `password`,
 * `my`, `token`, `test`, etc. (e.g. `Password123!`, `myProdSecret99!`) are never ignored.
 */
export function isDummySensitiveValue(raw: string): boolean {
  const value = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!value) return true;
  if (/^\[\[WN_SEC:/.test(value) || value.includes("__WN_PROTECTED_")) {
    return true;
  }
  if (/^(?:\*+|x{3,}|\.{3,}|-+|_+|#+|•+)$/i.test(value)) return true;
  if (/^(?:\$\{?|%[A-Z_]|\{\{|<)/i.test(value)) return true;
  if (
    /^(?:process\.env|import\.meta\.env|os\.environ|env\.|config\.|settings\.)/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /^(?:null|undefined|none|nil|true|false|string|number|boolean|any|object|required|optional|empty|redacted|hidden|masked|secret|password|passwd|token|changeme|placeholder|dummy|sample|example|test|todo|tbd|n\/a|your[_-]?[a-z_-]*|my[_-]?[a-z_-]*)$/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value) &&
    !/\d/.test(value)
  ) {
    return true;
  }
  return false;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return digits.length > 0 && sum % 10 === 0;
}

const CCCD_PROVINCES = new Set(
  "001 002 004 006 008 010 011 012 014 015 017 019 020 022 024 025 026 027 030 031 033 034 035 036 037 038 040 042 044 045 046 048 049 051 052 054 056 058 060 062 064 066 067 068 070 072 074 075 077 079 080 082 083 084 086 087 089 091 092 093 094 095 096".split(
    " ",
  ),
);

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
      if (
        /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(
          s,
        )
      ) {
        return true;
      }
      for (const m of s.matchAll(/\bBearer\s+([A-Za-z0-9._~+/-]{16,}=*)/gi)) {
        if (!isDummySensitiveValue(m[1])) return true;
      }
      for (const m of s.matchAll(/\bBasic\s+([A-Za-z0-9+/]{12,}={0,2})/gi)) {
        if (!isDummySensitiveValue(m[1])) return true;
      }
      for (const m of s.matchAll(
        /\b(?:Cookie|Set-Cookie)\s*:\s*([^\r\n]{8,})/gi,
      )) {
        if (!isDummySensitiveValue(m[1]) && /=/.test(m[1])) return true;
      }
      return false;
    },
  },
  {
    category: "CONNECTION_STRING",
    test: (s) => {
      const re =
        /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@/"'`]{0,100}:([^\s@/"'`]{3,200})@/gi;
      for (const m of s.matchAll(re)) {
        if (!isDummySensitiveValue(m[1])) return true;
      }
      return false;
    },
  },
  {
    category: "PASSWORD",
    test: (s) => {
      const assign =
        /(?:\b[\w.-]*(?:password|passwd|passphrase|pwd)|\bmk|mật\s?khẩu|mat\s?khau|matkhau)["']?\s*(?:[:=]|=>)\s*["']?([^\s"'\x60,;<>()[\]{}\\]{4,128})/giu;
      for (const m of s.matchAll(assign)) {
        const val = m[1];
        const after = s.slice(
          (m.index ?? 0) + m[0].length,
          (m.index ?? 0) + m[0].length + 3,
        );
        if (!isDummySensitiveValue(val) && !/^\s*\(/.test(after)) return true;
      }
      const stmt =
        /(?:\bpassword|\bpasswd|\bmk|mật\s?khẩu|mat\s?khau|matkhau)\s+(?:là|la|is)\s+["']?([^\s"'\x60,;<>()[\]{}\\]{4,128})/giu;
      for (const m of s.matchAll(stmt)) {
        if (
          !isDummySensitiveValue(m[1]) &&
          /[\d!@#$%^&*?_~.+-]/.test(m[1])
        ) {
          return true;
        }
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
        const after = s.slice(
          (m.index ?? 0) + m[0].length,
          (m.index ?? 0) + m[0].length + 3,
        );
        const looksSecret =
          /\d/.test(val) ||
          val.length >= 16 ||
          (/[a-z]/.test(val) && /[A-Z]/.test(val)) ||
          /[^A-Za-z0-9]/.test(val);
        if (
          !isDummySensitiveValue(val) &&
          !/^\s*\(/.test(after) &&
          looksSecret
        ) {
          return true;
        }
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
        if (/^(?:git|noreply|no-reply|donotreply|do-not-reply)$/.test(local)) {
          continue;
        }
        if (
          /(?:^|\.)(?:example\.(?:com|org|net)|test|invalid|localhost|local)$/.test(
            domain,
          )
        ) {
          continue;
        }
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
    test: (s) => {
      if (
        /(?:\bcmnd|\bcmt|\bcccd|căn\s?cước|hộ\s?chiếu|\bpassport)(?:\s*(?:số|so|no\.?|number))?\s*[:：]?\s*(?:\d{12}|\d{9}|[A-Z]\d{7,8})(?![\dA-Za-z])/iu.test(
          s,
        )
      ) {
        return true;
      }
      for (const m of s.matchAll(/(?<![\dA-Za-z_-])\d{12}(?![\dA-Za-z_-])/g)) {
        const v = m[0];
        if (
          CCCD_PROVINCES.has(v.slice(0, 3)) &&
          /^[0-3]$/.test(v[3]) &&
          !/^(\d)\1{11}$/.test(v)
        ) {
          return true;
        }
      }
      return false;
    },
  },
  {
    category: "BANK_CARD",
    test: (s) => {
      for (const m of s.matchAll(
        /(?<![\dA-Za-z])(?:\d[ -]?){13,19}(?![\dA-Za-z])/g,
      )) {
        const digits = m[0].replace(/\D/g, "");
        if (
          digits.length >= 13 &&
          digits.length <= 19 &&
          /^(?:3[47]|4|5[1-5]|2[2-7]|6(?:011|5)|9704)/.test(digits) &&
          !/^(\d)\1+$/.test(digits) &&
          luhnValid(digits)
        ) {
          return true;
        }
      }
      return false;
    },
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
 * Replaces server-masked `[[WN_SEC:CATEGORY:hash]]` placeholders with a localized
 * friendly lock label so raw internal tokens never surface in UI strings.
 */
export function formatMaskedSensitiveText(
  text: string,
  resolveCategoryLabel: (category: string) => string,
): string {
  if (!text || !text.includes("[[WN_SEC:")) return text;
  return text.replace(
    MASKED_PLACEHOLDER_GLOBAL,
    (_m, category: string) => `🔒 ${resolveCategoryLabel(category)}`,
  );
}

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
      className="flex items-start gap-2 rounded-xl border border-success-200 bg-success-50/90 px-3 py-2 text-[11px] leading-relaxed text-success-900 dark:border-success-500/35 dark:bg-success-500/10 dark:text-success-100"
    >
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-success-600 dark:text-success-400"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {t("securityShield.maskedTitle", {
            count: report.input.maskedValues,
            categories,
          })}
        </p>
        <p className="text-success-800 dark:text-success-200/90">
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
      className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50/90 px-3 py-2 text-[11px] leading-relaxed text-warning-900 dark:border-warning-500/35 dark:bg-warning-500/10 dark:text-warning-100"
    >
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-warning-600 dark:text-warning-400"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {t("securityShield.preSendMaskTitle", { categories })}
        </p>
        <p className="text-warning-800 dark:text-warning-200/90">
          {t("securityShield.preSendMaskHint")}
        </p>
      </div>
    </div>
  );
}

export default function WorkNoteSecurityNotice({
  scan,
  report,
}: {
  scan?: PreSendSecurityScan | null;
  report?: AgentSecurityReport | null;
}) {
  if (report && report.input.maskedValues > 0) {
    return <SecurityShieldBanner report={report} />;
  }
  return <PreSendSecurityNotice scan={scan ?? null} />;
}

