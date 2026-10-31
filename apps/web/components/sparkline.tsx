interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * The chart is drawn with preserveAspectRatio="none" so it can stretch to any
 * container width. That also means any shape inside it is stretched: a dot
 * becomes an ellipse on a narrow screen. Only the line is drawn here, and the
 * stroke is kept uniform with non-scaling-stroke.
 */
export function Sparkline({ values, width = 120, height = 24, className }: SparklineProps) {
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
    </svg>
  );
}
