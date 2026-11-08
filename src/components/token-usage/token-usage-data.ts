import type {
  AiTokenUsageOwner,
  AiTokenUsageResponse,
  AiTokenUsageTaskKind,
} from "@/lib/queries/token-usage/useTokenUsage";

export type TimeRangeId = "24h" | "7d" | "30d" | "12w" | "12m" | "custom";

export interface DateSpan {
  readonly from: Date;
  readonly to: Date;
}

export type FocusFilter =
  | { readonly kind: "owner"; readonly id: string }
  | { readonly kind: "task"; readonly id: AiTokenUsageTaskKind }
  | null;

export type HeatmapMode = "daily" | "weekly" | "cumulative";

export const OWNER_PALETTE = [
  "#465fff", // brand-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
] as const;

export const TASK_COLOR_MAP: Readonly<Record<AiTokenUsageTaskKind, string>> = {
  ai_chat: "#465fff",
  mind_map: "#8b5cf6",
  knowledge_sync: "#06b6d4",
  note_assessment: "#10b981",
  note_rewrite: "#f59e0b",
};

export interface RangePreset {
  readonly id: Exclude<TimeRangeId, "custom">;
  readonly unit: "hour" | "day" | "week" | "month";
  readonly count: number;
  readonly stride: number;
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: "24h", unit: "hour", count: 24, stride: 4 },
  { id: "7d", unit: "day", count: 7, stride: 1 },
  { id: "30d", unit: "day", count: 30, stride: 5 },
  { id: "12w", unit: "week", count: 12, stride: 2 },
  { id: "12m", unit: "month", count: 12, stride: 1 },
];

export interface ChartSegment {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly tokens: number;
  readonly share: number;
}

export interface ChartBucket {
  readonly index: number;
  readonly label: string;
  readonly fullLabel: string;
  readonly showTick: boolean;
  readonly isLast: boolean;
  readonly tokens: number;
  readonly input: number;
  readonly cacheRead: number;
  readonly output: number;
  readonly calls: number;
  readonly pct: number;
  readonly byOwner: readonly ChartSegment[];
  readonly byTask: readonly ChartSegment[];
}

export interface RankedOwnerItem extends AiTokenUsageOwner {
  readonly index: number;
  readonly color: string;
  readonly tokens: number;
  readonly input: number;
  readonly cacheRead: number;
  readonly output: number;
  readonly calls: number;
  readonly share: number;
}

export interface RankedTaskItem {
  readonly id: AiTokenUsageTaskKind;
  readonly index: number;
  readonly color: string;
  readonly tokens: number;
  readonly input: number;
  readonly cacheRead: number;
  readonly output: number;
  readonly calls: number;
  readonly share: number;
}

export interface HeatmapCell {
  readonly key: string;
  readonly date: Date;
  readonly label: string;
  readonly dailyTokens: number;
  readonly weeklyTokens: number;
  readonly cumulativeTokens: number;
  readonly dailyCalls: number;
  readonly dailyLevel: 0 | 1 | 2 | 3 | 4;
  readonly weeklyLevel: 0 | 1 | 2 | 3 | 4;
  readonly cumulativeLevel: 0 | 1 | 2 | 3 | 4;
  readonly isFuture: boolean;
  readonly isToday: boolean;
}

export interface HeatmapMonthLabel {
  readonly label: string;
  readonly col: number;
}

export interface AggregatedTokenUsage {
  readonly unit: "hour" | "day" | "week" | "month";
  readonly stride: number;
  readonly totals: {
    readonly tokens: number;
    readonly input: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    readonly output: number;
    readonly calls: number;
    readonly cacheHitRate: number;
  };
  readonly buckets: readonly ChartBucket[];
  readonly maxBucket: number;
  readonly axisTop: number;
  readonly ownersList: readonly RankedOwnerItem[];
  readonly tasksList: readonly RankedTaskItem[];
  readonly legendOwners: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }[];
  readonly legendTasks: readonly {
    readonly id: AiTokenUsageTaskKind;
    readonly color: string;
  }[];
  readonly heatmap: {
    readonly weeks: readonly (readonly HeatmapCell[])[];
    readonly months: readonly HeatmapMonthLabel[];
    readonly activeDays: number;
    readonly lifetimeTokens: number;
    readonly peakDailyTokens: number;
    readonly longestStreak: number;
    readonly currentStreak: number;
    readonly activeDayKeys: ReadonlySet<string>;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function niceCeil(value: number): number {
  if (value <= 0) return 1000;
  const exp = 10 ** Math.floor(Math.log10(value));
  const norm = value / exp;
  const step = norm <= 1.2 ? 1.2 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * exp;
}

export function formatCompactTokens(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "")}K`;
  }
  return n.toLocaleString();
}

export function formatFullTokens(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString();
}

export function formatSharePercent(share: number): string {
  if (share <= 0) return "0%";
  const pct = share * 100;
  if (pct < 1) return "< 1%";
  return `${Math.round(pct)}%`;
}

function computeLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  const ratio = Math.sqrt(value / max);
  if (ratio < 0.28) return 1;
  if (ratio < 0.55) return 2;
  if (ratio < 0.82) return 3;
  return 4;
}

interface BucketWindow {
  readonly startMs: number;
  readonly endMs: number;
  readonly label: string;
  readonly fullLabel: string;
}

function buildBucketWindows(
  rangeId: TimeRangeId,
  customSpan: DateSpan | null,
  locale: string,
  now: Date,
): {
  unit: "hour" | "day" | "week" | "month";
  stride: number;
  windows: BucketWindow[];
} {
  const shortDateFmt = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
  });
  const fullDateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const monthShortFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
  });
  const monthFullFmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });

  if (rangeId === "custom" && customSpan) {
    const sDay = startOfDay(
      customSpan.from <= customSpan.to ? customSpan.from : customSpan.to,
    );
    const eDay = startOfDay(
      customSpan.from <= customSpan.to ? customSpan.to : customSpan.from,
    );
    const totalDays = Math.max(
      1,
      Math.round((eDay.getTime() - sDay.getTime()) / DAY_MS) + 1,
    );

    if (totalDays <= 2) {
      const count = totalDays * 24;
      const windows: BucketWindow[] = [];
      for (let i = 0; i < count; i += 1) {
        const startMs = sDay.getTime() + i * HOUR_MS;
        const d = new Date(startMs);
        const hh = `${String(d.getHours()).padStart(2, "0")}:00`;
        windows.push({
          startMs,
          endMs: startMs + HOUR_MS,
          label: hh,
          fullLabel: `${shortDateFmt.format(d)} · ${hh}`,
        });
      }
      return {
        unit: "hour",
        stride: totalDays === 1 ? 4 : 8,
        windows,
      };
    }

    if (totalDays <= 62) {
      const windows: BucketWindow[] = [];
      for (let i = 0; i < totalDays; i += 1) {
        const d = addDays(sDay, i);
        windows.push({
          startMs: d.getTime(),
          endMs: addDays(d, 1).getTime(),
          label: shortDateFmt.format(d),
          fullLabel: fullDateFmt.format(d),
        });
      }
      const stride =
        totalDays <= 10
          ? 1
          : totalDays <= 21
            ? 3
            : totalDays <= 35
              ? 5
              : 7;
      return { unit: "day", stride, windows };
    }

    if (totalDays <= 240) {
      const weekCount = Math.ceil(totalDays / 7);
      const windows: BucketWindow[] = [];
      for (let i = 0; i < weekCount; i += 1) {
        const ws = addDays(sDay, i * 7);
        const we = addDays(ws, 6);
        windows.push({
          startMs: ws.getTime(),
          endMs: addDays(ws, 7).getTime(),
          label: shortDateFmt.format(ws),
          fullLabel: `${shortDateFmt.format(ws)} – ${shortDateFmt.format(we)}`,
        });
      }
      return {
        unit: "week",
        stride: Math.max(1, Math.round(weekCount / 6)),
        windows,
      };
    }

    const months: BucketWindow[] = [];
    let cursor = new Date(sDay.getFullYear(), sDay.getMonth(), 1);
    const limit = new Date(eDay.getFullYear(), eDay.getMonth() + 1, 1);
    while (cursor < limit) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      months.push({
        startMs: cursor.getTime(),
        endMs: nextMonth.getTime(),
        label: monthShortFmt.format(cursor),
        fullLabel: monthFullFmt.format(cursor),
      });
      cursor = nextMonth;
    }
    return {
      unit: "month",
      stride: Math.max(1, Math.round(months.length / 8)),
      windows: months,
    };
  }

  const preset =
    RANGE_PRESETS.find((p) => p.id === rangeId) ?? RANGE_PRESETS[1]!;

  if (preset.unit === "hour") {
    const currentHourMs =
      Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    const startHourMs = currentHourMs - (preset.count - 1) * HOUR_MS;
    const windows: BucketWindow[] = [];
    for (let i = 0; i < preset.count; i += 1) {
      const startMs = startHourMs + i * HOUR_MS;
      const d = new Date(startMs);
      const hh = `${String(d.getHours()).padStart(2, "0")}:00`;
      windows.push({
        startMs,
        endMs: startMs + HOUR_MS,
        label: hh,
        fullLabel: `${shortDateFmt.format(d)} · ${hh}`,
      });
    }
    return { unit: "hour", stride: preset.stride, windows };
  }

  if (preset.unit === "day") {
    const today = startOfDay(now);
    const firstDay = addDays(today, -(preset.count - 1));
    const windows: BucketWindow[] = [];
    for (let i = 0; i < preset.count; i += 1) {
      const d = addDays(firstDay, i);
      windows.push({
        startMs: d.getTime(),
        endMs: addDays(d, 1).getTime(),
        label: shortDateFmt.format(d),
        fullLabel: fullDateFmt.format(d),
      });
    }
    return { unit: "day", stride: preset.stride, windows };
  }

  if (preset.unit === "week") {
    const today = startOfDay(now);
    const dow = (today.getDay() + 6) % 7; // Monday = 0
    const thisWeekStart = addDays(today, -dow);
    const firstWeekStart = addDays(thisWeekStart, -(preset.count - 1) * 7);
    const windows: BucketWindow[] = [];
    for (let i = 0; i < preset.count; i += 1) {
      const ws = addDays(firstWeekStart, i * 7);
      const we = addDays(ws, 6);
      windows.push({
        startMs: ws.getTime(),
        endMs: addDays(ws, 7).getTime(),
        label: shortDateFmt.format(ws),
        fullLabel: `${shortDateFmt.format(ws)} – ${shortDateFmt.format(we)}`,
      });
    }
    return { unit: "week", stride: preset.stride, windows };
  }

  // Month
  const windows: BucketWindow[] = [];
  for (let i = preset.count - 1; i >= 0; i -= 1) {
    const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    windows.push({
      startMs: ms.getTime(),
      endMs: me.getTime(),
      label: monthShortFmt.format(ms),
      fullLabel: monthFullFmt.format(ms),
    });
  }
  return { unit: "month", stride: preset.stride, windows };
}

export function aggregateTokenUsage(
  data: AiTokenUsageResponse | undefined,
  rangeId: TimeRangeId,
  customSpan: DateSpan | null,
  focus: FocusFilter,
  locale = "vi",
): AggregatedTokenUsage {
  const now = new Date();
  const owners = data?.owners ?? [];
  const tasks = data?.tasks ?? [
    { id: "ai_chat", index: 0 },
    { id: "mind_map", index: 1 },
    { id: "knowledge_sync", index: 2 },
    { id: "note_assessment", index: 3 },
    { id: "note_rewrite", index: 4 },
  ];
  const rows = data?.rows ?? [];

  const ownerColor = (idx: number) =>
    OWNER_PALETTE[idx % OWNER_PALETTE.length]!;

  const { unit, stride, windows } = buildBucketWindows(
    rangeId,
    customSpan,
    locale,
    now,
  );
  const windowStartMs = windows[0]?.startMs ?? 0;
  const windowEndMs = windows[windows.length - 1]?.endMs ?? now.getTime();

  const bucketAccum = windows.map((w, index) => ({
    index,
    startMs: w.startMs,
    endMs: w.endMs,
    label: w.label,
    fullLabel: w.fullLabel,
    tokens: 0,
    input: 0,
    cacheRead: 0,
    output: 0,
    calls: 0,
    byOwnerMap: new Map<number, number>(),
    byTaskMap: new Map<number, number>(),
  }));

  const ownerTotals = owners.map((o, index) => ({
    ...o,
    index,
    color: ownerColor(index),
    tokens: 0,
    input: 0,
    cacheRead: 0,
    output: 0,
    calls: 0,
  }));

  const taskTotals = tasks.map((t) => ({
    id: t.id,
    index: t.index,
    color: TASK_COLOR_MAP[t.id],
    tokens: 0,
    input: 0,
    cacheRead: 0,
    output: 0,
    calls: 0,
  }));

  let totalTokens = 0;
  let totalInput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalOutput = 0;
  let totalCalls = 0;

  // Daily map for 53-week heatmap + Codex lifetime/peak/streak stats
  const dailyMap = new Map<string, { tokens: number; calls: number }>();
  const activeDayKeys = new Set<string>();
  let lifetimeTokens = 0;

  const focusOwnerIdx =
    focus?.kind === "owner"
      ? owners.findIndex((o) => o.id === focus.id)
      : -1;
  const focusTaskIdx =
    focus?.kind === "task"
      ? tasks.findIndex((t) => t.id === focus.id)
      : -1;

  for (const row of rows) {
    const [
      hourEpoch,
      ownerIdx,
      taskIdx,
      input,
      cacheRead,
      cacheWrite,
      output,
      calls,
    ] = row;

    if (focusOwnerIdx !== -1 && ownerIdx !== focusOwnerIdx) continue;
    if (focusTaskIdx !== -1 && taskIdx !== focusTaskIdx) continue;

    const rowTokens = input + cacheRead + cacheWrite + output;
    if (rowTokens <= 0) continue;

    const tsMs = hourEpoch * HOUR_MS;
    const dKey = dayKey(new Date(tsMs));
    activeDayKeys.add(dKey);
    lifetimeTokens += rowTokens;

    const existingDay = dailyMap.get(dKey);
    if (existingDay) {
      existingDay.tokens += rowTokens;
      existingDay.calls += calls;
    } else {
      dailyMap.set(dKey, { tokens: rowTokens, calls });
    }

    if (tsMs < windowStartMs || tsMs >= windowEndMs) continue;

    // Locate bucket window
    let bIdx = -1;
    if (unit === "hour") {
      bIdx = Math.floor((tsMs - windowStartMs) / HOUR_MS);
    } else if (unit === "day") {
      const dayStart = startOfDay(new Date(tsMs)).getTime();
      bIdx = Math.round((dayStart - windowStartMs) / DAY_MS);
    } else if (unit === "week") {
      const dayStart = startOfDay(new Date(tsMs)).getTime();
      bIdx = Math.floor((dayStart - windowStartMs) / (7 * DAY_MS));
    } else {
      for (let i = 0; i < bucketAccum.length; i += 1) {
        const cand = bucketAccum[i]!;
        if (tsMs >= cand.startMs && tsMs < cand.endMs) {
          bIdx = i;
          break;
        }
      }
    }

    const bucket = bucketAccum[bIdx];
    if (!bucket) continue;

    bucket.tokens += rowTokens;
    bucket.input += input;
    bucket.cacheRead += cacheRead;
    bucket.output += output;
    bucket.calls += calls;
    bucket.byOwnerMap.set(
      ownerIdx,
      (bucket.byOwnerMap.get(ownerIdx) ?? 0) + rowTokens,
    );
    bucket.byTaskMap.set(
      taskIdx,
      (bucket.byTaskMap.get(taskIdx) ?? 0) + rowTokens,
    );

    totalTokens += rowTokens;
    totalInput += input;
    totalCacheRead += cacheRead;
    totalCacheWrite += cacheWrite;
    totalOutput += output;
    totalCalls += calls;

    const oTarget = ownerTotals[ownerIdx];
    if (oTarget) {
      oTarget.tokens += rowTokens;
      oTarget.input += input;
      oTarget.cacheRead += cacheRead;
      oTarget.output += output;
      oTarget.calls += calls;
    }

    const tTarget = taskTotals[taskIdx];
    if (tTarget) {
      tTarget.tokens += rowTokens;
      tTarget.input += input;
      tTarget.cacheRead += cacheRead;
      tTarget.output += output;
      tTarget.calls += calls;
    }
  }

  const maxBucket = bucketAccum.reduce(
    (max, b) => (b.tokens > max ? b.tokens : max),
    0,
  );
  const axisTop = niceCeil(maxBucket);

  const buckets: ChartBucket[] = bucketAccum.map((b, idx) => {
    const isLast = idx === bucketAccum.length - 1;
    const showTick =
      stride === 1 || idx % stride === 0 || isLast;
    const pct = axisTop > 0 ? (b.tokens / axisTop) * 100 : 0;

    const byOwner: ChartSegment[] = [...b.byOwnerMap.entries()]
      .filter(([, tok]) => tok > 0)
      .sort((a, c) => c[1] - a[1])
      .map(([oIdx, tok]) => ({
        id: owners[oIdx]?.id ?? String(oIdx),
        name: owners[oIdx]?.name ?? `#${oIdx + 1}`,
        color: ownerColor(oIdx),
        tokens: tok,
        share: b.tokens > 0 ? tok / b.tokens : 0,
      }));

    const byTask: ChartSegment[] = [...b.byTaskMap.entries()]
      .filter(([, tok]) => tok > 0)
      .sort((a, c) => c[1] - a[1])
      .map(([tIdx, tok]) => {
        const taskKind = tasks[tIdx]?.id ?? "ai_chat";
        return {
          id: taskKind,
          name: taskKind,
          color: TASK_COLOR_MAP[taskKind],
          tokens: tok,
          share: b.tokens > 0 ? tok / b.tokens : 0,
        };
      });

    return {
      index: idx,
      label: b.label,
      fullLabel: b.fullLabel,
      showTick,
      isLast,
      tokens: b.tokens,
      input: b.input,
      cacheRead: b.cacheRead,
      output: b.output,
      calls: b.calls,
      pct,
      byOwner,
      byTask,
    };
  });

  const ownersList: RankedOwnerItem[] = ownerTotals
    .map((o) => ({
      ...o,
      share: totalTokens > 0 ? o.tokens / totalTokens : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));

  const tasksList: RankedTaskItem[] = taskTotals
    .map((t) => ({
      ...t,
      share: totalTokens > 0 ? t.tokens / totalTokens : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens || a.index - b.index);

  const legendOwners = ownersList
    .filter((o) => o.tokens > 0)
    .slice(0, 6)
    .map((o) => ({ id: o.id, name: o.name, color: o.color }));

  const legendTasks = tasksList
    .filter((t) => t.tokens > 0)
    .map((t) => ({ id: t.id, color: t.color }));

  // Build 53-week × 7-day heatmap
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const endOfGrid = addDays(today, 6 - today.getDay()); // Saturday of current week
  const startOfGrid = addDays(endOfGrid, -(53 * 7 - 1));

  const fullDateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const monthShortFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
  });

  // First pass: calculate raw daily, weekly, and cumulative values across 53 weeks
  let maxDaily = 0;
  let maxWeekly = 0;
  let runningCumulative = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const rawWeeks: {
    weekTotal: number;
    days: {
      key: string;
      date: Date;
      label: string;
      dailyTokens: number;
      dailyCalls: number;
      cumulativeTokens: number;
      isFuture: boolean;
      isToday: boolean;
    }[];
  }[] = [];

  for (let w = 0; w < 53; w += 1) {
    let weekTotal = 0;
    const days: (typeof rawWeeks)[number]["days"] = [];
    for (let d = 0; d < 7; d += 1) {
      const cellDate = addDays(startOfGrid, w * 7 + d);
      const k = dayKey(cellDate);
      const isFuture = cellDate > today;
      const isToday = k === todayKey;
      const entry = isFuture ? undefined : dailyMap.get(k);
      const dailyTokens = entry?.tokens ?? 0;
      const dailyCalls = entry?.calls ?? 0;

      if (!isFuture) {
        runningCumulative += dailyTokens;
        weekTotal += dailyTokens;
        if (dailyTokens > 0) {
          activeDays += 1;
          tempStreak += 1;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
        if (dailyTokens > maxDaily) maxDaily = dailyTokens;
      }

      days.push({
        key: k,
        date: cellDate,
        label: fullDateFmt.format(cellDate),
        dailyTokens,
        dailyCalls,
        cumulativeTokens: runningCumulative,
        isFuture,
        isToday,
      });
    }
    if (weekTotal > maxWeekly) maxWeekly = weekTotal;
    rawWeeks.push({ weekTotal, days });
  }

  // Compute current streak backwards from today (or yesterday if today is 0 so far)
  let currentStreak = 0;
  let cursorDay = today;
  if ((dailyMap.get(dayKey(cursorDay))?.tokens ?? 0) === 0) {
    cursorDay = addDays(today, -1);
  }
  while ((dailyMap.get(dayKey(cursorDay))?.tokens ?? 0) > 0) {
    currentStreak += 1;
    cursorDay = addDays(cursorDay, -1);
  }

  const maxCumulative = Math.max(1, runningCumulative);
  const weeks: HeatmapCell[][] = [];
  const months: HeatmapMonthLabel[] = [];
  let prevMonth = -1;

  for (let w = 0; w < rawWeeks.length; w += 1) {
    const rw = rawWeeks[w]!;
    const firstDay = rw.days[0]!.date;
    const m = firstDay.getMonth();
    if (m !== prevMonth) {
      if (w === 0 || w - (months[months.length - 1]?.col ?? -10) >= 3) {
        months.push({
          label: monthShortFmt.format(firstDay),
          col: w,
        });
      }
      prevMonth = m;
    }

    const weekLevel = computeLevel(rw.weekTotal, maxWeekly);
    weeks.push(
      rw.days.map((cell) => ({
        key: cell.key,
        date: cell.date,
        label: cell.label,
        dailyTokens: cell.dailyTokens,
        weeklyTokens: rw.weekTotal,
        cumulativeTokens: cell.cumulativeTokens,
        dailyCalls: cell.dailyCalls,
        dailyLevel: cell.isFuture
          ? 0
          : computeLevel(cell.dailyTokens, maxDaily),
        weeklyLevel: cell.isFuture ? 0 : weekLevel,
        cumulativeLevel: cell.isFuture
          ? 0
          : computeLevel(cell.cumulativeTokens, maxCumulative),
        isFuture: cell.isFuture,
        isToday: cell.isToday,
      })),
    );
  }

  const promptDenominator = totalInput + totalCacheRead + totalCacheWrite;
  const cacheHitRate =
    promptDenominator > 0 ? totalCacheRead / promptDenominator : 0;

  return {
    unit,
    stride,
    totals: {
      tokens: totalTokens,
      input: totalInput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      output: totalOutput,
      calls: totalCalls,
      cacheHitRate,
    },
    buckets,
    maxBucket,
    axisTop,
    ownersList,
    tasksList,
    legendOwners,
    legendTasks,
    heatmap: {
      weeks,
      months,
      activeDays,
      lifetimeTokens,
      peakDailyTokens: maxDaily,
      longestStreak,
      currentStreak,
      activeDayKeys,
    },
  };
}
