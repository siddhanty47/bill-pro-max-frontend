/**
 * @fileoverview Credit/debit note form: reason plus, for manual notes, a line editor with a
 * tax preview from the bill's own rates. Auto notes only take a reason (their amounts come from
 * the drift pass). Used to edit drafts (notes detail page) and, later, to create manual notes.
 */
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Field,
  IconButton,
  Input,
  Notice,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Textarea,
} from '../ui';
import { formatMoney } from '../../utils/format';
import { manualNoteTotals, noteSign, type NoteTaxRates } from '../../utils/billMoney';
import { NOTE_LINE_KINDS } from '../../utils/billNoteLabels';
import type { BillNoteLineInput, BillNoteSource, BillNoteType } from '../../types';
import styles from './BillNoteForm.module.css';

const reasonField = z.string().trim().min(1, 'Add a reason');

const lineSchema = z.object({
  kind: z.enum(['hire', 'damage', 'transport', 'other']),
  itemId: z.string().optional(),
  itemName: z.string().optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Add a description')
    .max(200, 'Keep it under 200 characters'),
  amount: z.number({ error: 'Enter an amount' }).positive('Enter an amount above zero'),
});

const manualSchema = z.object({
  reason: reasonField,
  lines: z.array(lineSchema).min(1, 'Add at least one line').max(50, 'Up to 50 lines'),
});

const reasonOnlySchema = z.object({ reason: reasonField, lines: z.array(lineSchema) });

type FormValues = z.infer<typeof manualSchema>;

export interface BillNoteFormValues {
  reason: string;
  /** Only for manual notes */
  lines?: BillNoteLineInput[];
}

export interface BillNoteFormProps {
  mode: 'create' | 'edit';
  source: BillNoteSource;
  type: BillNoteType;
  initial?: { reason: string; lines: BillNoteLineInput[] };
  /** Tax rates for the preview: the bill's own (a note carries the same fields) */
  bill: NoteTaxRates;
  onSubmit: (values: BillNoteFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  /** Server error from the last submit */
  error?: string | null;
}

const emptyLine = (): BillNoteLineInput => ({ kind: 'other', description: '', amount: NaN });

/** "Line 2: Add a description" for each line with an error (first field error per line). */
function lineMessages(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const messages: string[] = [];
  rows.forEach((row, i) => {
    if (!row) return;
    const fields = row as Record<string, { message?: string } | undefined>;
    const message = fields.description?.message ?? fields.amount?.message;
    if (message) messages.push(`Line ${i + 1}: ${message}`);
  });
  return messages;
}

/** Column name inside a cell; only shown on phones, where the header row is hidden. */
function PhoneLabel({ children }: { children: string }) {
  return (
    <span className={styles.phoneLabel} aria-hidden="true">
      {children}
    </span>
  );
}

export function BillNoteForm({
  mode,
  source,
  type,
  initial,
  bill,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: BillNoteFormProps) {
  const manual = source === 'manual';
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(manual ? manualSchema : reasonOnlySchema),
    defaultValues: {
      reason: initial?.reason ?? '',
      lines: manual ? (initial?.lines.length ? initial.lines : [emptyLine()]) : [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' }) ?? [];
  const totals = manualNoteTotals(lines, bill);
  const sign = noteSign(type);
  const signed = (n: number) => formatMoney(sign * n);
  const intra = (bill.taxMode ?? 'intra') === 'intra';

  const submit = (values: FormValues) =>
    onSubmit(manual ? { reason: values.reason, lines: values.lines } : { reason: values.reason });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;
  const rowErrors = lineMessages(errors.lines);

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      {manual && (
        <div className={styles.lines}>
          <Table aria-label="Note lines">
            <THead>
              <Tr className={styles.headRow}>
                <Th className={styles.colKind}>Kind</Th>
                <Th className={styles.colDescription}>Description</Th>
                <Th align="right" className={styles.colAmount}>
                  Amount
                </Th>
                <Th className={styles.colAction} aria-label="Actions" />
              </Tr>
            </THead>
            <TBody>
              {fields.map((field, index) => {
                const rowErrors = errors.lines?.[index];
                const n = index + 1;
                return (
                  <Tr key={field.id} stackOnMobile className={styles.lineRow}>
                    <Td className={styles.colKind}>
                      <Select
                        aria-label={`Kind for line ${n}`}
                        {...register(`lines.${index}.kind`)}
                      >
                        {NOTE_LINE_KINDS.map(k => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className={styles.colDescription}>
                      <Input
                        aria-label={`Description for line ${n}`}
                        invalid={!!rowErrors?.description}
                        {...register(`lines.${index}.description`)}
                      />
                    </Td>
                    <Td align="right" className={styles.colAmount}>
                      <PhoneLabel>Amount</PhoneLabel>
                      <Input
                        mono
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        aria-label={`Amount for line ${n}`}
                        className={styles.numberInput}
                        invalid={!!rowErrors?.amount}
                        {...register(`lines.${index}.amount`, { valueAsNumber: true })}
                      />
                    </Td>
                    <Td align="right" className={styles.colAction}>
                      <IconButton
                        icon="close"
                        label={`Remove line ${n}`}
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          {linesError && <Notice tone="danger">{linesError}</Notice>}
          {rowErrors.length > 0 && (
            <Notice tone="danger">
              {rowErrors.map(m => (
                <p key={m} className={styles.message}>
                  {m}
                </p>
              ))}
            </Notice>
          )}
          <div>
            <Button icon="plus" size="sm" onClick={() => append(emptyLine())}>
              Add line
            </Button>
          </div>

          <Table aria-label="Note totals" detail>
            <TBody>
              <Tr>
                <Td>Subtotal</Td>
                <Td align="right" mono nowrap>
                  {signed(totals.subtotal)}
                </Td>
              </Tr>
              {intra ? (
                <>
                  <Tr>
                    <Td>SGST</Td>
                    <Td align="right" mono nowrap>
                      {signed(totals.sgstAmount)}
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>CGST</Td>
                    <Td align="right" mono nowrap>
                      {signed(totals.cgstAmount)}
                    </Td>
                  </Tr>
                </>
              ) : (
                <Tr>
                  <Td>IGST</Td>
                  <Td align="right" mono nowrap>
                    {signed(totals.igstAmount)}
                  </Td>
                </Tr>
              )}
              <Tr variant="total">
                <Td>Total</Td>
                <Td align="right" mono nowrap>
                  {signed(totals.totalAmount)}
                </Td>
              </Tr>
            </TBody>
          </Table>
        </div>
      )}

      <Field label="Reason" required error={errors.reason?.message}>
        <Textarea rows={3} {...register('reason')} />
      </Field>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          {mode === 'edit' ? 'Save note' : 'Create note'}
        </Button>
      </div>
    </form>
  );
}
