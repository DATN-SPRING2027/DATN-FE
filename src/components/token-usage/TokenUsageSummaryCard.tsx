"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRightIcon, PieChartIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useTokenUsageQuery } from "@/lib/queries/token-usage/useTokenUsage";
import {
  aggregateTokenUsage,
  formatCompactTokens,
} from "./token-usage-data";
import { useTokenUsageModalStore } from "./token-usage.store";

export default function TokenUsageSummaryCard() {
  const t = useTranslations("TokenUsage");
  const locale = useLocale();
  const openModal = useTokenUsageModalStore((s) => s.openModal);
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId ?? "";

  const usageQuery = useTokenUsageQuery(organizationId, {
    scope: "personal",
    enabled: Boolean(organizationId),
  });

  const summary = useMemo(
    () =>
      aggregateTokenUsage(
        usageQuery.data,
        "30d",
        null,
        null,
        locale,
      ),
    [usageQuery.data, locale],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <PieChartIcon className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                {t("profileCard.title")}
              </h3>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {t("scopes.personal")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("profileCard.subtitle")}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => openModal({ scope: "personal" })}
          endIcon={<ArrowRightIcon className="size-3.5" />}
          className="rounded-xl text-xs font-semibold"
        >
          {t("profileCard.openDetail")}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800/80 dark:bg-white/[0.02]">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t("ranges.last30d")}
          </span>
          <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {formatCompactTokens(summary.totals.tokens)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800/80 dark:bg-white/[0.02]">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t("metrics.cacheHitRate")}
          </span>
          <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {Math.round(summary.totals.cacheHitRate * 100)}%
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800/80 dark:bg-white/[0.02]">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t("metrics.calls")}
          </span>
          <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {summary.totals.calls.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800/80 dark:bg-white/[0.02]">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t("heatmap.lifetimeTokens")}
          </span>
          <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {formatCompactTokens(summary.heatmap.lifetimeTokens)}
          </div>
        </div>
      </div>
    </div>
  );
}
