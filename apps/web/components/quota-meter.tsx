import styles from "./quota-meter.module.css";

interface QuotaMeterProps {
  label: string;
  used: number;
  limit: number;
  usedLabel: string;
  limitLabel: string;
  /** Renders tighter spacing, for use inside dense panels. */
  dense?: boolean;
}

export function QuotaMeter({
  label,
  used,
  limit,
  usedLabel,
  limitLabel,
  dense = false,
}: QuotaMeterProps) {
  const ratio = limit > 0 ? used / limit : 0;
  const percent = Math.min(100, Math.max(0, ratio * 100));
  const isTight = ratio >= 0.9;
  const isOver = ratio > 1;

  const percentRounded = Math.round(ratio * 100);

  // aria-valuenow may not exceed aria-valuemax. Reporting the raw figure at
  // 125% produces an invalid range, so clamp it and let valuetext carry the
  // overage.
  const safeMax = limit > 0 ? limit : 1;
  const safeNow = Math.min(Math.max(used, 0), safeMax);

  const valueText = isOver
    ? `${usedLabel} of ${limitLabel}, ${percentRounded} percent, over limit`
    : `${usedLabel} of ${limitLabel}, ${percentRounded} percent`;

  return (
    <div className={dense ? `${styles.wrap} ${styles.dense}` : styles.wrap}>
      <div className={styles.head}>
        <span className={styles.name}>{label}</span>
        <span className={`${styles.pct} num`} data-tight={isTight ? "true" : undefined}>
          {percentRounded}%
        </span>
      </div>

      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeNow}
        aria-valuetext={valueText}
      >
        <span className={styles.ticks} aria-hidden="true" />
        <span
          className={isTight ? `${styles.fill} ${styles.fillTight}` : styles.fill}
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>

      <div className={styles.foot}>
        <span>
          {usedLabel}
          {isOver ? " · over limit" : ""}
        </span>
        <span>{limitLabel}</span>
      </div>
    </div>
  );
}
