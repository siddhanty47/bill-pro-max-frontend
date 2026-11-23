import { TrendLabel } from '../../components/ui';
import type { Change } from './dashboardFormat';

/** A dashboard change: with an arrow via the kit TrendLabel, plain text without a direction. */
export function ChangeText({ change }: { change: Change }) {
  return change.direction ? (
    <TrendLabel direction={change.direction}>{change.text}</TrendLabel>
  ) : (
    <>{change.text}</>
  );
}
