"use client";

import { useMemo, useState } from "react";
import type { TimeRange } from "@production/shared";
import { EndpointsTable } from "@/components/endpoints-table";
import { QuotaMeter } from "@/components/quota-meter";
import { RangeSelector } from "@/components/range-selector";
import { Sparkline } from "@/components/sparkline";
import { UsageChart } from "@/components/usage-chart";
import { getUsageSummary } from "@/lib/data";
import { formatCompact, formatDelta, formatQuotaLabels, formatRate, formatUsd } from "@/lib/format";
import styles from "./overview.module.css";

const RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
};

interface StatProps {
  label: string;
  value: string;
  delta: number;
  series?: readonly number[];
  tone?: "neutral" | "bad";
}

function Stat({ label, value, delta, series, tone = "neutral" }: StatProps) {
  const isBad = tone === "bad" && delta > 0;

  return (
    <div className={styles.stat} data-stat={label}>
      <span className="label">{label}</span>
      <p className={`num ${styles.statValue}`} data-value>
        {value}
      </p>
      <div className={styles.statFoot}>
        <span className={`num ${styles.delta}`} data-bad={isBad ? "true" : undefined}>
          {formatDelta(delta)} vs previous
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
  const summary = useMemo(() => getUsageSummary(range), [range]);

  const errorRate = summary.requests > 0 ? summary.errors / summary.requests : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Overview</h1>
          <p className={styles.sub}>Billing cycle · {RANGE_LABELS[range]}</p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </header>

      <section className={styles.stats} aria-label="Summary for the selected period">
        <Stat
          label="Requests"
          value={formatCompact(summary.requests)}
          delta={summary.deltas.requests}
          series={summary.daily.map((entry) => entry.requests)}
        />
        <Stat
          label="Error rate"
          value={formatRate(errorRate)}
          delta={summary.deltas.errorRate}
          tone="bad"
        />
        <Stat
          label="Usage spend"
          value={formatUsd(summary.costUsd)}
          delta={summary.deltas.costUsd}
        />
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-label="Request volume over time">
          <UsageChart daily={summary.daily} />
        </section>

        <section className={styles.panel} aria-labelledby="quota-heading">
          <h2 id="quota-heading" className="label">
            Quota
          </h2>
          <div className={styles.meters}>
            {summary.quotas.map((quota) => {
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
