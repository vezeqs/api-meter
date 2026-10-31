"use client";

import { TIME_RANGES, type TimeRange } from "@production/shared";
import styles from "./range-selector.module.css";

const LABELS: Record<TimeRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

interface RangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className={styles.group} role="group" aria-label="Reporting period">
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={styles.option}
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {LABELS[range]}
        </button>
      ))}
    </div>
  );
}
