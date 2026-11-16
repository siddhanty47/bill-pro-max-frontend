import { describe, expect, it } from 'vitest';
import * as ui from './index';

describe('ui barrel', () => {
  it.each([
    'Button',
    'IconButton',
    'Icon',
    'GoogleIcon',
    'Card',
    'StatCard',
    'Meter',
    'PageHeader',
    'EmptyState',
    'StatusChip',
    'DocNumber',
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
    'Menu',
    'MenuItem',
    'MenuLabel',
    'MenuDivider',
    'Modal',
    'Tabs',
    'Spinner',
    'LoadingSpinner',
    'ErrorMessage',
  ])('exports %s', name => {
    expect(ui).toHaveProperty(name);
  });

  it('does not export non-component helpers', () => {
    expect(ui).not.toHaveProperty('statusTone');
    expect(ui).not.toHaveProperty('statusLabel');
  });
});
