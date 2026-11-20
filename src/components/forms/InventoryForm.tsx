/**
 * Inventory form component
 */
import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Inventory, CreateInventoryInput } from '../../types';
import {
  useLazyCheckInventoryCodeExistsQuery,
  useLazyGenerateInventoryCodeQuery,
  useGetInventoryCategoriesQuery,
} from '../../api/inventoryApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';
import { Button, Field, Input, Select, Textarea } from '../ui';
import { optionalNumber } from './optionalNumber';
import styles from './InventoryForm.module.css';

const inventorySchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  totalQuantity: z.number().int().min(0, 'Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(20),
  description: z.string().max(500).optional(),
  defaultRatePerDay: z.number().min(0).optional(),
  damageRate: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
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
  const [generateCode] = useLazyGenerateInventoryCodeQuery();

  const { data: existingCategories } = useGetInventoryCategoriesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  /** Map category strings to AutocompleteItem format for CodeAutocomplete */
  const categoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    if (!existingCategories) return [];
    return existingCategories.map(cat => ({
      code: cat,
      label: cat,
      id: cat,
    }));
  }, [existingCategories]);

  const [categoryValue, setCategoryValue] = useState(initialData?.category || '');

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
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
          damageRate: initialData.damageRate,
          costPrice: initialData.costPrice,
        }
      : {
          code: '',
          unit: 'pcs',
          totalQuantity: 0,
        },
  });

  /** Sync local category state with react-hook-form */
  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategoryValue(value);
      setValue('category', value, { shouldValidate: true });
    },
    [setValue]
  );

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
   * Suggest a free code from the item name when the code is still empty
   */
  const handleNameBlur = useCallback(async () => {
    const name = getValues('name')?.trim();
    if (!name || getValues('code') || !currentBusinessId) return;

    try {
      const code = await generateCode({ businessId: currentBusinessId, name }).unwrap();
      if (!getValues('code')) {
        setValue('code', code, { shouldValidate: true });
        setCodeError(null);
      }
    } catch {
      // Leave the code for the user to type
    }
  }, [currentBusinessId, generateCode, getValues, setValue]);

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
      damageRate: data.damageRate,
      costPrice: data.costPrice,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.row}>
            <div className={styles.nameGroup}>
              <Field label="Item name" required error={errors.name?.message}>
                <Input
                  {...register('name')}
                  onBlur={e => {
                    register('name').onBlur(e);
                    handleNameBlur();
                  }}
                  disabled={isLoading}
                />
              </Field>
            </div>
            <div className={styles.codeGroup}>
              <Field
                label="Item code"
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
                  placeholder="Filled from the name"
                />
              </Field>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.group}>
              <CodeAutocomplete
                label="Category"
                placeholder="Select or type a new category..."
                value={categoryValue}
                onChange={handleCategoryChange}
                items={categoryAutocompleteItems}
                onSelect={item => handleCategoryChange(item.label)}
                disabled={isLoading}
                error={errors.category?.message}
                required
              />
            </div>
            <div className={styles.group}>
              <Field label="Unit" required error={errors.unit?.message}>
                <Select {...register('unit')} disabled={isLoading}>
                  <option value="pcs">Pieces</option>
                  <option value="meters">Meters</option>
                  <option value="kg">Kilograms</option>
                  <option value="tons">Tons</option>
                  <option value="sets">Sets</option>
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.numbers}>
            <Field label="Total quantity" required error={errors.totalQuantity?.message}>
              <Input
                mono
                type="number"
                {...register('totalQuantity', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Daily rate (₹)" error={errors.defaultRatePerDay?.message}>
              <Input
                mono
                type="number"
                step="0.01"
                {...register('defaultRatePerDay', { setValueAs: optionalNumber })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Damage charge (₹)" error={errors.damageRate?.message}>
              <Input
                mono
                type="number"
                step="0.01"
                {...register('damageRate', { setValueAs: optionalNumber })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Cost price (₹)" error={errors.costPrice?.message}>
              <Input
                mono
                type="number"
                step="0.01"
                {...register('costPrice', { setValueAs: optionalNumber })}
                disabled={isLoading}
              />
            </Field>
          </div>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register('description')} rows={3} disabled={isLoading} />
          </Field>
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          {initialData ? 'Update item' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
