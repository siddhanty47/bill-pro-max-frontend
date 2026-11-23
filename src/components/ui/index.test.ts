import { describe, expect, it } from 'vitest';
import * as ui from './index';

describe('ui barrel', () => {
  it.each([
    'Button',
    'IconButton',
    'Icon',
    'GoogleIcon',
    'Brand',
    'Avatar',
    'Dot',
    'Notice',
    'Card',
    'StatCard',
    'Meter',
    'ChartCard',
    'ProgressBar',
    'PageHeader',
    'EmptyState',
    'StatusChip',
    'DocNumber',
    'RowActions',
    'Table',
    'THead',
    'TBody',
    'Tr',
    'Th',
    'Td',
    'DataTable',
    'Field',
    'Input',
    'Select',
    'Textarea',
    'Checkbox',
    'Fieldset',
    'FilterBar',
    'SegmentedControl',
    'Menu',
    'MenuItem',
    'MenuLabel',
    'MenuDivider',
    'Modal',
    'Tabs',
    'TabPanel',
    'Spinner',
    'NotAdded',
    'NavCount',
    'TextLink',
    'ErrorMessage',
  ])('exports %s', name => {
    expect(ui).toHaveProperty(name);
  });

  it('does not export non-component helpers', () => {
    expect(ui).not.toHaveProperty('statusTone');
    expect(ui).not.toHaveProperty('statusLabel');
  });
});
