import { Suspense, lazy } from 'react';
import type { MarginChartProps } from './MarginChart';

/**
 * Recharts is 525kB — larger than the rest of the application put
 * together — and only the company page ever draws a chart. Loading it
 * on the front door would make every reader pay for something most of
 * them never see, so it is split out and fetched on demand.
 */
const MarginChart = lazy(() =>
  import('./MarginChart').then((m) => ({ default: m.MarginChart })),
);

export function LazyMarginChart(props: MarginChartProps) {
  return (
    <Suspense fallback={<div className="chart-empty">Loading the margin series…</div>}>
      <MarginChart {...props} />
    </Suspense>
  );
}
