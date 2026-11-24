export type RadioDotMetrics = {
  boxSize: number;
  ringSize: number;
  strokeWidth: number;
  dotSize: number;
};

export function getRadioDotMetrics(size: number): RadioDotMetrics {
  const safeSize = Math.max(12, size);
  const ringSize = Math.round(safeSize * 0.86 * 10) / 10;
  const strokeWidth = Math.max(1.5, Math.round(safeSize * 0.085 * 10) / 10);
  const dotSize = Math.round(safeSize * 0.45 * 10) / 10;
  return {
    boxSize: safeSize,
    ringSize,
    strokeWidth,
    dotSize,
  };
}
