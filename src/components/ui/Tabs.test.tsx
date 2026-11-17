import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabPanel } from './Tabs';
import { Tabs as TabsShim } from '../Tabs';

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'challans', label: 'Challans' },
];

describe('Tabs', () => {
  it('renders a tablist with tabs and marks the active one', () => {
    render(<Tabs tabs={TABS} activeTab="challans" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Challans' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Bills' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the tab id', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeTab="bills" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Challans' }));
    expect(onChange).toHaveBeenCalledWith('challans');
  });

  it('is re-exported from the legacy path', () => {
    expect(TabsShim).toBe(Tabs);
  });

  it('wires tabs to panels when given an idPrefix', () => {
    render(
      <>
        <Tabs tabs={TABS} activeTab="bills" onChange={vi.fn()} idPrefix="party" />
        <TabPanel idPrefix="party" tabId="bills" className="extra">
          Bill list
        </TabPanel>
      </>
    );
    const tab = screen.getByRole('tab', { name: 'Bills' });
    expect(tab).toHaveAttribute('id', 'party-tab-bills');
    expect(tab).toHaveAttribute('aria-controls', 'party-panel-bills');
    expect(screen.getByRole('tab', { name: 'Challans' })).toHaveAttribute(
      'aria-controls',
      'party-panel-challans'
    );
    const panel = screen.getByRole('tabpanel', { name: 'Bills' });
    expect(panel).toHaveAttribute('id', 'party-panel-bills');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveClass('extra');
    expect(panel).toHaveTextContent('Bill list');
  });

  it('omits id wiring without an idPrefix', () => {
    render(<Tabs tabs={TABS} activeTab="bills" onChange={vi.fn()} />);
    const tab = screen.getByRole('tab', { name: 'Bills' });
    expect(tab).not.toHaveAttribute('id');
    expect(tab).not.toHaveAttribute('aria-controls');
  });

  it('shows a count after the label', () => {
    render(
      <Tabs
        tabs={[
          { id: 'bills', label: 'Bills', count: 12 },
          { id: 'about', label: 'About' },
        ]}
        activeTab="about"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('tab', { name: 'Bills 12' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'About' })).toBeInTheDocument();
  });
});
