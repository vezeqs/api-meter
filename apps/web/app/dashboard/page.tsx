"use client";

import { useMemo, useState } from "react";
import type { TimeRange } from "@production/shared";
import { EndpointsTable } from "@/components/endpoints-table";
import { QuotaMeter } from "@/components/quota-meter";
import { RangeSelector } from "@/components/range-selector";
import { Sparkline } from "@/components/sparkline";
import { UsageChart } from "@/components/usage-chart";
import { getBillingCycle, getUsageSummary } from "@/lib/data";
import {
  formatCompact,
  formatDayRange,
  formatDelta,
  formatQuotaLabels,
  formatRate,
  formatUsd,
} from "@/lib/format";
import styles from "./overview.module.css";

const RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
};

/** A change from zero has no percentage; say so instead of inventing one. */
function deltaNote(change: number): string {
  return Number.isFinite(change) ? `${formatDelta(change)} vs previous` : "no prior period";
}

interface StatProps {
  label: string;
  value: string;
  note: string;
  noteTone?: "neutral" | "bad";
  series?: readonly number[];
}

function Stat({ label, value, note, noteTone = "neutral", series }: StatProps) {
  return (
    <div className={styles.stat} data-stat={label}>
      <span className="label">{label}</span>
      <p className={`num ${styles.statValue}`} data-value>
        {value}
      </p>
      <div className={styles.statFoot}>
        <span className={`num ${styles.delta}`} data-bad={noteTone === "bad" ? "true" : undefined}>
          {note}
        </span>
        {series ? (
          <Sparkline values={series} width={80} height={18} className={styles.statSpark} />
        ) : null}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [range, setRange] = useState<TimeRange>("30d");

  // Two different questions. The range controls the analysis; the cycle
  // controls the bill. Mixing them lets the same account read 30% and 358%
  // of its allowance depending on a dropdown.
  const summary = useMemo(() => getUsageSummary(range), [range]);
  const billing = useMemo(() => getBillingCycle(), []);

  const errorRate = summary.requests > 0 ? summary.errors / summary.requests : 0;
  const cycleLabel = formatDayRange(billing.startDate, billing.endDate);

  const overageNote =
    billing.overageRequests > 0
      ? `${formatCompact(billing.overageRequests)} over allowance`
      : "within allowance";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Overview</h1>
          <p className={styles.sub}>
            Billing cycle {cycleLabel} · chart shows {RANGE_LABELS[range]}
          </p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </header>

      <section className={styles.stats} aria-label="Summary for the selected period">
        <Stat
          label="Requests"
          value={formatCompact(summary.requests)}
          note={deltaNote(summary.deltas.requests)}
          series={summary.daily.map((entry) => entry.requests)}
        />
        <Stat
          label="Error rate"
          value={formatRate(errorRate)}
          note={deltaNote(summary.deltas.errorRate)}
          noteTone={summary.deltas.errorRate > 0 ? "bad" : "neutral"}
        />
        <Stat
          label="Cycle spend"
          value={formatUsd(billing.overageUsd)}
          note={overageNote}
          noteTone={billing.overageRequests > 0 ? "bad" : "neutral"}
        />
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-label="Request volume over time">
          <UsageChart daily={summary.daily} />
        </section>

        <section className={styles.panel} aria-labelledby="quota-heading">
          <div className={styles.panelHead}>
            <h2 id="quota-heading" className="label">
              Quota
            </h2>
            <span className={`num ${styles.panelMeta}`}>{cycleLabel}</span>
          </div>
          <div className={styles.meters}>
            {billing.quotas.map((quota) => {
              const labels = formatQuotaLabels(quota);
              return (
                <QuotaMeter
                  key={quota.id}
                  label={quota.label}
                  used={quota.used}
                  limit={quota.limit}
                  usedLabel={labels.used}
                  limitLabel={labels.limit}
                  dense
                />
              );
            })}
          </div>
        </section>
      </div>

      <EndpointsTable endpoints={summary.endpoints} />
    </div>
  );
}
