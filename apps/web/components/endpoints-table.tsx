"use client";

import { useMemo, useState } from "react";
import type { EndpointStat } from "@production/shared";
import { formatDuration, formatInteger, formatRate } from "@/lib/format";
import { Sparkline } from "./sparkline";
import styles from "./endpoints-table.module.css";

type SortKey = "path" | "requests" | "errorRate" | "p95Ms";
type SortDirection = "asc" | "desc";

interface EndpointsTableProps {
  endpoints: readonly EndpointStat[];
}

const NUMERIC_COLUMNS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "requests", label: "Requests" },
  { key: "errorRate", label: "Error rate" },
  { key: "p95Ms", label: "p95" },
];

function compare(a: EndpointStat, b: EndpointStat, key: SortKey): number {
  if (key === "path") {
    return a.path.localeCompare(b.path);
  }
  return a[key] - b[key];
}

export function EndpointsTable({ endpoints }: EndpointsTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("requests");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? endpoints.filter((endpoint) =>
          `${endpoint.method} ${endpoint.path}`.toLowerCase().includes(needle),
        )
      : [...endpoints];

    const direction = sortDirection === "asc" ? 1 : -1;

    return filtered.sort((a, b) => compare(a, b, sortKey) * direction);
  }, [endpoints, query, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "path" ? "asc" : "desc");
  }

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (key !== sortKey) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  return (
    <section className={styles.wrap} aria-labelledby="endpoints-heading">
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id="endpoints-heading" className="label">
            Endpoints
          </h2>
          <p className={`num ${styles.count}`}>
            {rows.length} of {endpoints.length}
          </p>
        </div>

        <div className={styles.filter}>
          <label className="visually-hidden" htmlFor="endpoint-filter">
            Filter endpoints
          </label>
          <input
            id="endpoint-filter"
            type="search"
            className={styles.input}
            placeholder="Filter by path"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="visually-hidden">
            Request volume, error rate, and p95 latency by endpoint for the selected period.
          </caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort("path")} className={styles.leftHead}>
                <button type="button" className={styles.sort} onClick={() => toggleSort("path")}>
                  Endpoint
                  <span className={styles.caret} aria-hidden="true" />
                </button>
              </th>
              {NUMERIC_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort(column.key)}
                  className={styles.numericHead}
                >
                  <button
                    type="button"
                    className={styles.sort}
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}
                    <span className={styles.caret} aria-hidden="true" />
                  </button>
                </th>
              ))}
              <th scope="col" className={styles.trendHead}>
                <span className="visually-hidden">Trend</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No endpoints match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              rows.map((endpoint) => (
                <tr key={endpoint.id} className={styles.row}>
                  <th scope="row" className={styles.endpointCell}>
                    <span className={styles.method} data-method={endpoint.method}>
                      {endpoint.method}
                    </span>
                    <span className={styles.path}>{endpoint.path}</span>
                  </th>
                  <td className={`num ${styles.numeric}`}>{formatInteger(endpoint.requests)}</td>
                  <td
                    className={`num ${styles.numeric}`}
                    data-warn={endpoint.errorRate > 0.01 ? "true" : undefined}
                  >
                    {formatRate(endpoint.errorRate)}
                  </td>
                  <td className={`num ${styles.numeric}`}>{formatDuration(endpoint.p95Ms)}</td>
                  <td className={styles.trendCell}>
                    <Sparkline
                      values={endpoint.series}
                      width={96}
                      height={20}
                      className={styles.spark}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
