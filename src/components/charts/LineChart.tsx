import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Bucket, SeriesPoint } from '../../types';
import { formatTick } from './chartFormat';
import { useChartTheme } from './chartTheme';
import { ChartFrame, type ChartSize } from './ChartFrame';
import { ChartTooltip } from './ChartTooltip';
import type { SeriesSpec } from './BarLineChart';

export type LineChartProps = {
  data: SeriesPoint[];
  bucket: Bucket;
  y: SeriesSpec;
  /** Fixed y range, e.g. [0, 100] for a percentage. */
  domain?: [number, number];
  format: (n: number) => string;
  /** Fixed size instead of filling the wrapper (tests). */
  size?: ChartSize;
};

/** A single line over time (utilization, steel index). Load via React.lazy. */
export function LineChart({ data, bucket, y, domain, format, size }: LineChartProps) {
  const theme = useChartTheme();
  return (
    <ChartFrame size={size}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="t"
          tickFormatter={(t: string) => formatTick(t, bucket)}
          stroke={theme.grid}
          tick={{ fill: theme.axis }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          width="auto"
          domain={domain ?? ['auto', 'auto']}
          tickFormatter={(n: number) => format(n)}
          stroke={theme.grid}
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: theme.grid }}
          content={props => <ChartTooltip {...props} bucket={bucket} format={format} />}
        />
        <Line
          dataKey={y.key}
          name={y.label}
          type="monotone"
          stroke={theme.accent}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: theme.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </RechartsLineChart>
    </ChartFrame>
  );
}

export default LineChart;
