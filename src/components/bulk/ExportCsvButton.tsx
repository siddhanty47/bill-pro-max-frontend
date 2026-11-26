import { Button } from '../ui';

/** `Export {n} to CSV`: hands the selected rows to `onExport`; disabled with none selected. */
export function ExportCsvButton({ count, onExport }: { count: number; onExport: () => void }) {
  return (
    <Button disabled={count === 0} onClick={onExport}>
      Export {count} to CSV
    </Button>
  );
}
