import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportCsvButton } from './ExportCsvButton';

describe('ExportCsvButton', () => {
  it('names the count and calls onExport', async () => {
    const onExport = vi.fn();
    render(<ExportCsvButton count={3} onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export 3 to CSV' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('is disabled with nothing selected', async () => {
    const onExport = vi.fn();
    render(<ExportCsvButton count={0} onExport={onExport} />);
    const button = screen.getByRole('button', { name: 'Export 0 to CSV' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onExport).not.toHaveBeenCalled();
  });
});
