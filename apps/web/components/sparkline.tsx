interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
  /** Adds a dot on the final point so the latest value is readable. */
  markLast?: boolean;
}

export function Sparkline({
  values,
  width = 120,
  height = 24,
  className,
  markLast = false,
}: SparklineProps) {
  if (values.length < 2) {
    return <svg className={className} width={width} height={height} aria-hidden="true" />;
  }

  let min = Infinity;
  let max = -Infinity;

  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const last = values[values.length - 1] ?? 0;
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((last - min) / span) * height;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {markLast ? <circle cx={lastX} cy={lastY} r={1.75} fill="currentColor" /> : null}
    </svg>
  );
}
