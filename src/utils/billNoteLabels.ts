/** Display labels for credit/debit note fields (list and detail pages). */
import type { BillNote, BillNoteLineKind } from '../types';

export const NOTE_TYPE_LABEL: Record<BillNote['type'], string> = {
  credit: 'Credit',
  debit: 'Debit',
};

export const NOTE_SOURCE_LABEL: Record<BillNote['source'], string> = {
  auto: 'Auto',
  manual: 'Manual',
};

export const NOTE_LINE_KINDS: { value: BillNoteLineKind; label: string }[] = [
  { value: 'hire', label: 'Hire' },
  { value: 'damage', label: 'Damage' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

export const NOTE_LINE_KIND_LABEL = Object.fromEntries(
  NOTE_LINE_KINDS.map(k => [k.value, k.label])
) as Record<BillNoteLineKind, string>;

/** Download name of a note's PDF: `CN/2026-27/0001` → `note-CN-2026-27-0001.pdf` */
export const noteFileName = (noteNumber?: string): string =>
  `note-${(noteNumber ?? 'draft').replace(/\//g, '-')}.pdf`;
