/**
 * @file Party form component
 * @description Form for creating/editing parties (clients/suppliers).
 * Supports GSTIN lookup to auto-fill name, address, and GST details.
 */
import { useState, useCallback, useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, CreatePartyInput, OpeningBalanceRow } from '../../types';
import {
  useLazyGeneratePartyCodeQuery,
  useLazyCheckPartyCodeExistsQuery,
} from '../../api/partyApi';
import { useLazyLookupGstinQuery } from '../../api/gstinApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import {
  Button,
  Checkbox,
  Field,
  Fieldset,
  IconButton,
  Input,
  Notice,
  Select,
  Textarea,
} from '../ui';
import { formatMoney } from '../../utils/format';
import { DEFAULT_SITE_LABEL } from '../../utils/sites';
import styles from './PartyForm.module.css';

/**
 * Create schema factory to handle conditional validation for site fields
 * Site address is required only when creating a new party
 */
const createPartySchema = (isEditing: boolean) =>
  z.object({
    code: z.string().min(1, 'Code is required').max(20),
    name: z.string().min(1, 'Name is required').max(100),
    roles: z.array(z.enum(['client', 'supplier'])).min(1, 'Select at least one role'),
    contactPerson: z.string().min(1, 'Contact person is required').max(100),
    phone: z.string().min(1, 'Phone is required').max(20),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    gst: z.string().max(20).optional(),
    stateCode: z
      .string()
      .regex(/^[0-9]{2}$/)
      .max(2)
      .optional()
      .or(z.literal('')),
    notes: z.string().max(1000).optional(),
    // Opening money balance carried in from before BillProMax, per site (negative = advance).
    // siteCode '' = the default site (party address).
    openingRows: z
      .array(
        z.object({
          siteCode: z.string(),
          amount: z
            .string()
            .regex(/^-?\d+(\.\d{1,2})?$/, 'Enter an amount like 12500 or -500.50')
            .or(z.literal('')),
        })
      )
      .superRefine((rows, ctx) => {
        const seen = new Set<string>();
        rows.forEach((row, i) => {
          if (!row.amount) return;
          if (seen.has(row.siteCode)) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'siteCode'],
              message: 'This site already has a row',
            });
          }
          seen.add(row.siteCode);
        });
      }),
    openingBalanceDate: z.string().optional(),
    // Site fields - required only for new party
    siteCode: z.string().max(20).optional(),
    siteAddress: isEditing
      ? z.string().max(500).optional()
      : z.string().min(1, 'Site address is required').max(500),
    siteStateCode: z
      .string()
      .regex(/^[0-9]{2}$/)
      .max(2)
      .optional()
      .or(z.literal('')),
    siteIsSameAsOffice: z.boolean().optional(),
  });

// Default schema type for form data inference

type FormData = z.infer<ReturnType<typeof createPartySchema>>;

type OpeningFormRow = { siteCode: string; amount: string };

/** Rows to start the form with: saved rows, a legacy total as one default-site row, or one blank row */
function initialOpeningRows(party: Party): OpeningFormRow[] {
  if (party.openingBalanceSites?.length) {
    return party.openingBalanceSites.map(r => ({
      siteCode: r.siteCode ?? '',
      amount: String(r.amount),
    }));
  }
  if (party.openingBalance) return [{ siteCode: '', amount: String(party.openingBalance) }];
  return [{ siteCode: '', amount: '' }];
}

/**
 * Opening rows to send, or null to leave the opening untouched (nothing entered on a party that
 * had none). Blank amounts are dropped; '' site = the default site.
 */
function openingPayload(
  rows: OpeningFormRow[],
  hadOpening: boolean
): { openingBalanceSites: OpeningBalanceRow[] } | null {
  const filled = rows
    .filter(r => r.amount !== '')
    .map(r => ({ siteCode: r.siteCode || null, amount: Number(r.amount) }));
  if (!filled.length && !hadOpening) return null;
  return { openingBalanceSites: filled };
}

interface PartyFormProps {
  initialData?: Party;
  onSubmit: (data: CreatePartyInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PartyForm({ initialData, onSubmit, onCancel, isLoading }: PartyFormProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [gstNotice, setGstNotice] = useState<{
    tone: 'success' | 'warning' | 'danger';
    text: string;
  } | null>(null);
  const [generateCode] = useLazyGeneratePartyCodeQuery();
  const [checkCodeExists] = useLazyCheckPartyCodeExistsQuery();
  const [lookupGstin, { isFetching: isGstLoading }] = useLazyLookupGstinQuery();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(createPartySchema(!!initialData)),
    defaultValues: initialData
      ? {
          code: initialData.code,
          name: initialData.name,
          roles: initialData.roles,
          contactPerson: initialData.contact.person,
          phone: initialData.contact.phone,
          email: initialData.contact.email || '',
          address: initialData.contact.address || '',
          gst: initialData.contact.gst || '',
          stateCode: initialData.contact.stateCode || '',
          notes: initialData.notes || '',
          openingRows: initialOpeningRows(initialData),
          openingBalanceDate: initialData.openingBalanceDate?.split('T')[0] ?? '',
          siteCode: '',
          siteAddress: '',
          siteStateCode: '',
          siteIsSameAsOffice: false,
        }
      : {
          code: '',
          roles: ['client'],
          openingRows: [{ siteCode: '', amount: '' }],
          siteCode: '',
          siteAddress: '',
          siteStateCode: '',
          siteIsSameAsOffice: false,
        },
  });

  const {
    fields: openingFields,
    append: addOpeningRow,
    remove: removeOpeningRow,
  } = useFieldArray({ control, name: 'openingRows' });
  const openingRows = useWatch({ control, name: 'openingRows' }) || [];
  const openingTotal = openingRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const initialSiteCode = useWatch({ control, name: 'siteCode' }) || '';
  // Sites an opening row can name: the party's sites, or on create the initial site once it has a code
  const openingSiteOptions = initialData
    ? (initialData.sites ?? []).map(s => ({ code: s.code, label: `${s.code} – ${s.address}` }))
    : initialSiteCode
      ? [
          {
            code: initialSiteCode.toUpperCase(),
            label: `${initialSiteCode.toUpperCase()} – initial site`,
          },
        ]
      : [];

  const roles = useWatch({ control, name: 'roles' }) || [];
  const siteIsSameAsOffice = useWatch({ control, name: 'siteIsSameAsOffice' });
  const officeAddress = useWatch({ control, name: 'address' });
  const gstValue = useWatch({ control, name: 'gst' }) || '';
  const stateCodeValue = useWatch({ control, name: 'stateCode' }) || '';
  const siteStateCodeValue = useWatch({ control, name: 'siteStateCode' }) || '';

  // Auto-fill state code and site state code from GSTIN when 15 chars and empty
  useEffect(() => {
    if (gstValue.trim().length === 15 && !stateCodeValue) {
      const code = gstValue.trim().substring(0, 2);
      setValue('stateCode', code);
      if (!initialData && !siteStateCodeValue) {
        setValue('siteStateCode', code);
      }
    }
  }, [gstValue, stateCodeValue, siteStateCodeValue, initialData, setValue]);

  const toggleRole = (role: 'client' | 'supplier') => {
    const newRoles = roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role];
    setValue('roles', newRoles as ('client' | 'supplier')[]);
  };

  /**
   * Handle "Same as office address" checkbox change
   */
  const handleSameAsOfficeChange = (checked: boolean) => {
    setValue('siteIsSameAsOffice', checked);
    if (checked && officeAddress) {
      setValue('siteAddress', officeAddress);
    }
  };

  /**
   * Sync office address to site address when checkbox is checked
   */
  useEffect(() => {
    if (siteIsSameAsOffice && officeAddress) {
      setValue('siteAddress', officeAddress);
    }
  }, [officeAddress, siteIsSameAsOffice, setValue]);

  /**
   * Handle name blur to auto-generate code if empty
   */
  const handleNameBlur = useCallback(async () => {
    const name = getValues('name');
    const currentCode = getValues('code');

    if (!name || currentCode || !currentBusinessId) return;

    try {
      const result = await generateCode({ businessId: currentBusinessId, name }).unwrap();
      setValue('code', result);
      setCodeError(null);
    } catch {
      // Silently fail - user can enter code manually
    }
  }, [currentBusinessId, generateCode, getValues, setValue]);

  /**
   * Handle code change to validate uniqueness
   */
  const handleCodeBlur = useCallback(async () => {
    const code = getValues('code');

    if (!code || !currentBusinessId) return;

    // Skip check if editing and code hasn't changed
    if (initialData && initialData.code === code) {
      setCodeError(null);
      return;
    }

    try {
      const exists = await checkCodeExists({ businessId: currentBusinessId, code }).unwrap();
      if (exists) {
        setCodeError('This code already exists');
      } else {
        setCodeError(null);
      }
    } catch {
      // Silently fail
    }
  }, [currentBusinessId, checkCodeExists, getValues, initialData]);

  /**
   * Handle GSTIN fetch button click.
   * Calls the backend GSTIN lookup API and auto-fills
   * name, address, and GST number fields from the response.
   */
  const handleFetchGstDetails = useCallback(async () => {
    const gstin = getValues('gst')?.trim();
    if (!gstin || gstin.length !== 15 || !currentBusinessId) return;

    setGstNotice(null);

    try {
      const details = await lookupGstin({ businessId: currentBusinessId, gstin }).unwrap();

      // Auto-fill the party name (prefer trade name, fall back to legal name)
      const partyName = details.tradeName || details.legalName;
      if (partyName) {
        setValue('name', partyName);
        // Also auto-generate the party code for the new name
        if (!getValues('code')) {
          try {
            const code = await generateCode({
              businessId: currentBusinessId,
              name: partyName,
            }).unwrap();
            setValue('code', code);
          } catch {
            // Silently fail code generation
          }
        }
      }

      // Auto-fill address
      if (details.address) {
        setValue('address', details.address);
      }

      // Auto-fill state code from GSTIN (first 2 digits) when empty
      if (!getValues('stateCode') && details.gstin?.length === 15) {
        const code = details.gstin.substring(0, 2);
        setValue('stateCode', code);
        if (!initialData && !getValues('siteStateCode')) {
          setValue('siteStateCode', code);
        }
      }

      // Show status feedback
      if (!details.isActive) {
        setGstNotice({ tone: 'warning', text: `Warning: This GSTIN is ${details.status}` });
      } else {
        setGstNotice({
          tone: 'success',
          text: `Fetched: ${details.legalName} (${details.status})`,
        });
      }
    } catch (err) {
      const errorMessage =
        err && typeof err === 'object' && 'data' in err
          ? (err as { data?: { error?: { message?: string } } }).data?.error?.message ||
            'Failed to fetch GST details'
          : 'Failed to fetch GST details';
      setGstNotice({ tone: 'danger', text: errorMessage });
    }
  }, [currentBusinessId, getValues, lookupGstin, setValue, generateCode, initialData]);

  const handleFormSubmit = async (data: FormData) => {
    if (codeError) return;

    const payload: CreatePartyInput = {
      code: data.code.toUpperCase(),
      name: data.name,
      roles: data.roles,
      contact: {
        person: data.contactPerson,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
        gst: data.gst || undefined,
        stateCode: data.stateCode?.trim() || undefined,
      },
      notes: data.notes || undefined,
      // The server derives the total from the rows; clearing every row while editing resets it to 0
      ...(openingPayload(
        data.openingRows,
        !!initialData?.openingBalance || !!initialData?.openingBalanceSites?.length
      ) ?? {}),
      ...(data.openingBalanceDate && { openingBalanceDate: data.openingBalanceDate }),
      initialSite: initialData
        ? { address: '' }
        : {
            code: data.siteCode ? data.siteCode.toUpperCase() : undefined,
            address: data.siteAddress || '',
            stateCode: data.siteStateCode?.trim() || undefined,
          },
    };
    await onSubmit(payload);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          {/* GST lookup at the top: enter GSTIN first to auto-fill other fields */}
          <div className={styles.gstGroup}>
            <Field label="GST number" htmlFor="gst">
              <div className={styles.gstRow}>
                <Input
                  id="gst"
                  mono
                  {...register('gst')}
                  disabled={isLoading}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className={styles.gstInput}
                  uppercase
                  maxLength={15}
                />
                <Button
                  onClick={handleFetchGstDetails}
                  loading={isGstLoading}
                  disabled={isLoading || gstValue.trim().length !== 15}
                >
                  Fetch details
                </Button>
              </div>
            </Field>
            {gstNotice && <Notice tone={gstNotice.tone}>{gstNotice.text}</Notice>}
          </div>

          <Field
            label="State code"
            hint="2-digit GST state code (auto-filled from GSTIN)"
            error={errors.stateCode?.message}
          >
            <Input
              mono
              {...register('stateCode')}
              disabled={isLoading}
              placeholder="e.g. 27"
              maxLength={2}
            />
          </Field>

          <div className={styles.nameCode}>
            <Field label="Party name" required error={errors.name?.message}>
              <Input
                {...register('name')}
                onBlur={e => {
                  register('name').onBlur(e);
                  handleNameBlur();
                }}
                disabled={isLoading}
              />
            </Field>
            <Field
              label="Party code"
              required
              error={errors.code?.message ?? codeError ?? undefined}
            >
              <Input
                mono
                {...register('code')}
                onBlur={e => {
                  register('code').onBlur(e);
                  handleCodeBlur();
                }}
                disabled={isLoading}
                uppercase
                placeholder="Auto-generated"
              />
            </Field>
          </div>

          <Field
            label="Roles"
            required
            error={errors.roles?.message}
            role="group"
            aria-label="Roles"
          >
            <div className={styles.roles}>
              <Checkbox
                label="Client"
                checked={roles.includes('client')}
                onChange={() => toggleRole('client')}
                disabled={isLoading}
              />
              <Checkbox
                label="Supplier"
                checked={roles.includes('supplier')}
                onChange={() => toggleRole('supplier')}
                disabled={isLoading}
              />
            </div>
          </Field>

          <div className={styles.pair}>
            <Field label="Contact person" required error={errors.contactPerson?.message}>
              <Input {...register('contactPerson')} disabled={isLoading} />
            </Field>
            <Field label="Phone" required error={errors.phone?.message}>
              <Input mono {...register('phone')} disabled={isLoading} />
            </Field>
          </div>

          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} disabled={isLoading} />
          </Field>
        </div>

        <div className={styles.column}>
          <Field label="Address" error={errors.address?.message}>
            <Textarea {...register('address')} rows={2} disabled={isLoading} />
          </Field>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} rows={2} disabled={isLoading} />
          </Field>

          <Fieldset legend="Opening balance (₹)">
            <div className={styles.openingRows}>
              {openingFields.map((row, i) => (
                <div key={row.id} className={styles.openingRow}>
                  <Field
                    label="Site"
                    error={errors.openingRows?.[i]?.siteCode?.message}
                    className={styles.openingSite}
                  >
                    <Select
                      aria-label={`Site for opening row ${i + 1}`}
                      {...register(`openingRows.${i}.siteCode`)}
                      disabled={isLoading}
                    >
                      <option value="">{DEFAULT_SITE_LABEL}</option>
                      {openingSiteOptions.map(o => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Amount" error={errors.openingRows?.[i]?.amount?.message}>
                    <Input
                      mono
                      inputMode="decimal"
                      aria-label={`Opening amount ${i + 1}`}
                      {...register(`openingRows.${i}.amount`)}
                      disabled={isLoading}
                      placeholder="0"
                    />
                  </Field>
                  <IconButton
                    icon="close"
                    label={`Remove opening row ${i + 1}`}
                    onClick={() => removeOpeningRow(i)}
                    disabled={isLoading}
                    className={styles.openingRemove}
                  />
                </div>
              ))}
              <div className={styles.openingFooter}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="plus"
                  onClick={() => addOpeningRow({ siteCode: '', amount: '' })}
                  disabled={isLoading}
                >
                  Add site
                </Button>
              </div>
              <div className={styles.pair}>
                <Field label="Total">
                  <Input mono readOnly value={formatMoney(openingTotal)} />
                </Field>
                <Field label="As of" error={errors.openingBalanceDate?.message}>
                  <Input type="date" {...register('openingBalanceDate')} disabled={isLoading} />
                </Field>
              </div>
            </div>
          </Fieldset>

          {/* Site section: only when creating a new party */}
          {!initialData && (
            <Fieldset legend="Initial site address">
              <div className={styles.siteFields}>
                <Checkbox
                  label="Same as office address"
                  checked={siteIsSameAsOffice || false}
                  onChange={e => handleSameAsOfficeChange(e.target.checked)}
                  disabled={isLoading}
                />

                <Field label="Site address" required error={errors.siteAddress?.message}>
                  <Textarea
                    {...register('siteAddress')}
                    rows={2}
                    disabled={isLoading || siteIsSameAsOffice}
                    placeholder="Enter site address"
                  />
                </Field>

                <div className={styles.pair}>
                  <Field label="Site code" error={errors.siteCode?.message}>
                    <Input
                      mono
                      {...register('siteCode')}
                      disabled={isLoading}
                      uppercase
                      placeholder="Auto-generated"
                    />
                  </Field>
                  <Field
                    label="Site state code"
                    hint="Defaults from party state code"
                    error={errors.siteStateCode?.message}
                  >
                    <Input
                      mono
                      {...register('siteStateCode')}
                      disabled={isLoading}
                      placeholder="e.g. 27"
                      maxLength={2}
                    />
                  </Field>
                </div>
              </div>
            </Fieldset>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          {initialData ? 'Update party' : 'Add party'}
        </Button>
      </div>
    </form>
  );
}
