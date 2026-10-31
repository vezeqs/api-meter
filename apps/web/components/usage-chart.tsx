"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { DailyUsage } from "@production/shared";
import { formatCompact, formatDayMonth, formatInteger } from "@/lib/format";
import styles from "./usage-chart.module.css";

const VIEW_W = 1000;
const VIEW_H = 100;
const TOP_PAD = 6;

interface UsageChartProps {
  daily: readonly DailyUsage[];
}

export function UsageChart({ daily }: UsageChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const model = useMemo(() => {
    const values = daily.map((entry) => entry.requests);
    const count = values.length;
    const peak = values.reduce((highest, value) => (value > highest ? value : highest), 0);
    const scale = peak > 0 ? peak : 1;

    const points = values.map((value, index) => {
      const x = count <= 1 ? 0 : (index / (count - 1)) * VIEW_W;
      const y = VIEW_H - (value / scale) * (VIEW_H - TOP_PAD);
      return { x, y, value, entry: daily[index] };
    });

    const line = points
      .map(
        (point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
      )
      .join(" ");

    const area = points.length > 0 ? `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z` : "";

    return { points, line, area, peak };
  }, [daily]);

  const count = model.points.length;

  if (count === 0) {
    return null;
  }

  // The window can shrink under a selection (90 days -> 7 days). Clamp the
  // stored index so the tooltip and crosshair do not silently disappear.
  const effectiveIndex = activeIndex === null ? null : Math.min(activeIndex, count - 1);
  const active = effectiveIndex === null ? null : (model.points[effectiveIndex] ?? null);
  const activePercent = count <= 1 ? 0 : ((effectiveIndex ?? 0) / (count - 1)) * 100;
  const tooltipLeft = Math.min(92, Math.max(8, activePercent));

  function clampIndex(index: number): number {
    return Math.min(count - 1, Math.max(0, index));
  }

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setActiveIndex(clampIndex(Math.round(ratio * (count - 1))));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = effectiveIndex ?? count - 1;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setActiveIndex(clampIndex(current + 1));
        break;
      case "ArrowLeft":
        event.preventDefault();
        setActiveIndex(clampIndex(current - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(count - 1);
        break;
      case "Escape":
        setActiveIndex(null);
        break;
      default:
        break;
    }
  }

  const first = daily[0];
  const middle = daily[Math.floor((count - 1) / 2)];
  const last = daily[count - 1];

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className="label">Request volume</span>
        <span className={`num ${styles.peak}`}>peak {formatCompact(model.peak)} / day</span>
      </figcaption>

      <div
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label="Daily request volume. Use the left and right arrow keys to inspect a day."
        onPointerMove={handlePointer}
        onPointerLeave={() => setActiveIndex(null)}
        onKeyDown={handleKey}
        onBlur={() => setActiveIndex(null)}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line x1="0" y1={VIEW_H / 3} x2={VIEW_W} y2={VIEW_H / 3} className={styles.grid} />
          <line
            x1="0"
            y1={(VIEW_H / 3) * 2}
            x2={VIEW_W}
            y2={(VIEW_H / 3) * 2}
            className={styles.grid}
          />
          <path d={model.area} className={styles.area} />
          <path d={model.line} className={styles.line} vectorEffect="non-scaling-stroke" />
          {active ? (
            <line
              x1={active.x}
              y1="0"
              x2={active.x}
              y2={VIEW_H}
              className={styles.crosshair}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {active ? (
          // The marker lives in the HTML overlay, not the stretched SVG:
          // preserveAspectRatio="none" would render a circle as an ellipse.
          <span
            className={styles.marker}
            data-chart-marker
            style={{ left: `${(active.x / VIEW_W) * 100}%`, top: `${(active.y / VIEW_H) * 100}%` }}
            aria-hidden="true"
          />
        ) : null}

        {active ? (
          <div className={styles.tooltip} style={{ left: `${tooltipLeft}%` }} aria-hidden="true">
            <span className={styles.tooltipDate}>{formatDayMonth(active.entry?.date ?? "")}</span>
            <span className={`num ${styles.tooltipValue}`}>
              {formatInteger(active.entry?.requests ?? 0)}
            </span>
            <span className={`num ${styles.tooltipMeta}`}>
              {formatInteger(active.entry?.errors ?? 0)} errors
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.axis} aria-hidden="true">
        <span className="num">{first ? formatDayMonth(first.date) : ""}</span>
        <span className="num">{middle ? formatDayMonth(middle.date) : ""}</span>
        <span className="num">{last ? formatDayMonth(last.date) : ""}</span>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {active
          ? `${formatDayMonth(active.entry?.date ?? "")}: ${formatInteger(active.entry?.requests ?? 0)} requests, ${formatInteger(active.entry?.errors ?? 0)} errors.`
          : ""}
      </p>
    </figure>
  );
}
