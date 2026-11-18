/**
 * @file Party form component
 * @description Form for creating/editing parties (clients/suppliers).
 * Supports GSTIN lookup to auto-fill name, address, and GST details.
 */
import { useState, useCallback, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, CreatePartyInput } from '../../types';
import {
  useLazyGeneratePartyCodeQuery,
  useLazyCheckPartyCodeExistsQuery,
} from '../../api/partyApi';
import { useLazyLookupGstinQuery } from '../../api/gstinApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { Button, Checkbox, Field, Fieldset, Input, Notice, Textarea } from '../ui';
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
          siteCode: '',
          siteAddress: '',
          siteStateCode: '',
          siteIsSameAsOffice: false,
        }
      : {
          code: '',
          roles: ['client'],
          siteCode: '',
          siteAddress: '',
          siteStateCode: '',
          siteIsSameAsOffice: false,
        },
  });

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
                className={styles.uppercaseInput}
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
                      className={styles.uppercaseInput}
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
