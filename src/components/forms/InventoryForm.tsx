/**
 * Inventory form component
 */
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Inventory, CreateInventoryInput } from '../../types';
import { useLazyCheckInventoryCodeExistsQuery } from '../../api/inventoryApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';

const inventorySchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  totalQuantity: z.number().int().min(0, 'Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(20),
  description: z.string().max(500).optional(),
  defaultRatePerDay: z.number().min(0).optional(),
});

type FormData = z.infer<typeof inventorySchema>;

interface InventoryFormProps {
  initialData?: Inventory;
  onSubmit: (data: CreateInventoryInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function InventoryForm({ initialData, onSubmit, onCancel, isLoading }: InventoryFormProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkCodeExists] = useLazyCheckInventoryCodeExistsQuery();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: initialData
      ? {
          code: initialData.code,
          name: initialData.name,
          category: initialData.category,
          totalQuantity: initialData.totalQuantity,
          unit: initialData.unit,
          description: initialData.description || '',
          defaultRatePerDay: initialData.defaultRatePerDay,
        }
      : {
          code: '',
          unit: 'pcs',
          totalQuantity: 0,
        },
  });

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

  const handleFormSubmit = async (data: FormData) => {
    if (codeError) return;
    
    await onSubmit({
      code: data.code.toUpperCase(),
      name: data.name,
      category: data.category,
      totalQuantity: data.totalQuantity,
      unit: data.unit,
      description: data.description,
      defaultRatePerDay: data.defaultRatePerDay,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="name">Item Name *</label>
          <input id="name" {...register('name')} disabled={isLoading} />
          {errors.name && <span className="error-message">{errors.name.message}</span>}
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="code">Item Code *</label>
          <input
            id="code"
            {...register('code')}
            onBlur={(e) => {
              register('code').onBlur(e);
              handleCodeBlur();
            }}
            disabled={isLoading}
            style={{ textTransform: 'uppercase' }}
            placeholder="Enter code"
          />
          {errors.code && <span className="error-message">{errors.code.message}</span>}
          {codeError && <span className="error-message">{codeError}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="category">Category *</label>
          <input id="category" {...register('category')} disabled={isLoading} />
          {errors.category && <span className="error-message">{errors.category.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="unit">Unit *</label>
          <select id="unit" {...register('unit')} disabled={isLoading}>
            <option value="pcs">Pieces</option>
            <option value="meters">Meters</option>
            <option value="kg">Kilograms</option>
            <option value="tons">Tons</option>
            <option value="sets">Sets</option>
          </select>
          {errors.unit && <span className="error-message">{errors.unit.message}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="totalQuantity">Total Quantity *</label>
          <input
            id="totalQuantity"
            type="number"
            {...register('totalQuantity', { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.totalQuantity && (
            <span className="error-message">{errors.totalQuantity.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="defaultRatePerDay">Daily Rate (₹)</label>
          <input
            id="defaultRatePerDay"
            type="number"
            step="0.01"
            {...register('defaultRatePerDay', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea id="description" {...register('description')} rows={3} disabled={isLoading} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
