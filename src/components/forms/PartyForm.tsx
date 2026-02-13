/**
 * @file Party form component
 * @description Form for creating/editing parties (clients/suppliers).
 * Supports GSTIN lookup to auto-fill name, address, and GST details.
 */
import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, CreatePartyInput } from '../../types';
import { useLazyGeneratePartyCodeQuery, useLazyCheckPartyCodeExistsQuery } from '../../api/partyApi';
import { useLazyLookupGstinQuery } from '../../api/gstinApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';

/**
 * Create schema factory to handle conditional validation for site fields
 * Site address is required only when creating a new party
 */
const createPartySchema = (isEditing: boolean) => z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  roles: z.array(z.enum(['client', 'supplier'])).min(1, 'Select at least one role'),
  contactPerson: z.string().min(1, 'Contact person is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  gst: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  // Site fields - required only for new party
  siteCode: z.string().max(20).optional(),
  siteAddress: isEditing 
    ? z.string().max(500).optional()
    : z.string().min(1, 'Site address is required').max(500),
  siteIsSameAsOffice: z.boolean().optional(),
});

// Default schema type for form data inference
const partySchema = createPartySchema(false);

type FormData = z.infer<typeof partySchema>;

interface PartyFormProps {
  initialData?: Party;
  onSubmit: (data: CreatePartyInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PartyForm({ initialData, onSubmit, onCancel, isLoading }: PartyFormProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [gstFetchError, setGstFetchError] = useState<string | null>(null);
  const [gstFetchSuccess, setGstFetchSuccess] = useState<string | null>(null);
  const [generateCode] = useLazyGeneratePartyCodeQuery();
  const [checkCodeExists] = useLazyCheckPartyCodeExistsQuery();
  const [lookupGstin, { isFetching: isGstLoading }] = useLazyLookupGstinQuery();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
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
          notes: initialData.notes || '',
          siteCode: '',
          siteAddress: '',
          siteIsSameAsOffice: false,
        }
      : {
          code: '',
          roles: ['client'],
          siteCode: '',
          siteAddress: '',
          siteIsSameAsOffice: false,
        },
  });

  const roles = watch('roles') || [];
  const siteIsSameAsOffice = watch('siteIsSameAsOffice');
  const officeAddress = watch('address');
  const gstValue = watch('gst') || '';

  const toggleRole = (role: 'client' | 'supplier') => {
    const newRoles = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role];
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

    setGstFetchError(null);
    setGstFetchSuccess(null);

    try {
      const details = await lookupGstin({ businessId: currentBusinessId, gstin }).unwrap();

      // Auto-fill the party name (prefer trade name, fall back to legal name)
      const partyName = details.tradeName || details.legalName;
      if (partyName) {
        setValue('name', partyName);
        // Also auto-generate the party code for the new name
        if (!getValues('code')) {
          try {
            const code = await generateCode({ businessId: currentBusinessId, name: partyName }).unwrap();
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

      // Show status feedback
      if (!details.isActive) {
        setGstFetchError(`Warning: This GSTIN is ${details.status}`);
      } else {
        setGstFetchSuccess(`Fetched: ${details.legalName} (${details.status})`);
      }
    } catch (err) {
      const errorMessage =
        err && typeof err === 'object' && 'data' in err
          ? ((err as { data?: { error?: { message?: string } } }).data?.error?.message || 'Failed to fetch GST details')
          : 'Failed to fetch GST details';
      setGstFetchError(errorMessage);
    }
  }, [currentBusinessId, getValues, lookupGstin, setValue, generateCode]);

  const handleFormSubmit = async (data: FormData) => {
    if (codeError) return;
    
    await onSubmit({
      code: data.code.toUpperCase(),
      name: data.name,
      roles: data.roles,
      contact: {
        person: data.contactPerson,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
        gst: data.gst || undefined,
      },
      notes: data.notes || undefined,
      initialSite: {
        code: data.siteCode ? data.siteCode.toUpperCase() : undefined,
        address: data.siteAddress || '',
      },
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      {/* GST lookup at the top — enter GSTIN first to auto-fill other fields */}
      <div className="form-group">
        <label htmlFor="gst">GST Number</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <input
            id="gst"
            {...register('gst')}
            disabled={isLoading}
            placeholder="e.g. 22AAAAA0000A1Z5"
            style={{ flex: 1, textTransform: 'uppercase' }}
            maxLength={15}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleFetchGstDetails}
            disabled={isLoading || isGstLoading || gstValue.trim().length !== 15}
            style={{ whiteSpace: 'nowrap', padding: '8px 12px', fontSize: '13px' }}
          >
            {isGstLoading ? 'Fetching...' : 'Fetch Details'}
          </button>
        </div>
        {gstFetchError && <span className="error-message">{gstFetchError}</span>}
        {gstFetchSuccess && (
          <span style={{ color: '#16a34a', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {gstFetchSuccess}
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="name">Party Name *</label>
          <input
            id="name"
            {...register('name')}
            onBlur={(e) => {
              register('name').onBlur(e);
              handleNameBlur();
            }}
            disabled={isLoading}
          />
          {errors.name && <span className="error-message">{errors.name.message}</span>}
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="code">Party Code *</label>
          <input
            id="code"
            {...register('code')}
            onBlur={(e) => {
              register('code').onBlur(e);
              handleCodeBlur();
            }}
            disabled={isLoading}
            style={{ textTransform: 'uppercase' }}
            placeholder="Auto-generated"
          />
          {errors.code && <span className="error-message">{errors.code.message}</span>}
          {codeError && <span className="error-message">{codeError}</span>}
        </div>
      </div>

      <div className="form-group">
        <label>Roles *</label>
        <div style={{ display: 'flex', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={roles.includes('client')}
              onChange={() => toggleRole('client')}
              disabled={isLoading}
            />
            Client
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={roles.includes('supplier')}
              onChange={() => toggleRole('supplier')}
              disabled={isLoading}
            />
            Supplier
          </label>
        </div>
        {errors.roles && <span className="error-message">{errors.roles.message}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="contactPerson">Contact Person *</label>
          <input id="contactPerson" {...register('contactPerson')} disabled={isLoading} />
          {errors.contactPerson && (
            <span className="error-message">{errors.contactPerson.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone *</label>
          <input id="phone" {...register('phone')} disabled={isLoading} />
          {errors.phone && <span className="error-message">{errors.phone.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} disabled={isLoading} />
        {errors.email && <span className="error-message">{errors.email.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <textarea id="address" {...register('address')} rows={2} disabled={isLoading} />
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" {...register('notes')} rows={2} disabled={isLoading} />
      </div>

      {/* Site section - only show when creating a new party */}
      {!initialData && (
        <fieldset style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginTop: '20px' }}>
          <legend style={{ padding: '0 10px', fontWeight: 'bold' }}>Initial Site Address</legend>
          
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'normal' }}>
              <input
                type="checkbox"
                checked={siteIsSameAsOffice || false}
                onChange={(e) => handleSameAsOfficeChange(e.target.checked)}
                disabled={isLoading}
              />
              Same as office address
            </label>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="siteAddress">Site Address *</label>
              <textarea
                id="siteAddress"
                {...register('siteAddress')}
                rows={2}
                disabled={isLoading || siteIsSameAsOffice}
                placeholder="Enter site address"
              />
              {errors.siteAddress && (
                <span className="error-message">{errors.siteAddress.message}</span>
              )}
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="siteCode">Site Code</label>
              <input
                id="siteCode"
                {...register('siteCode')}
                disabled={isLoading}
                style={{ textTransform: 'uppercase' }}
                placeholder="Auto-generated"
              />
              {errors.siteCode && (
                <span className="error-message">{errors.siteCode.message}</span>
              )}
            </div>
          </div>
        </fieldset>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update Party' : 'Add Party'}
        </button>
      </div>
    </form>
  );
}
