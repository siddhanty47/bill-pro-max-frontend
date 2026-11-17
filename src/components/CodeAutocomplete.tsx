/**
 * CodeAutocomplete Component
 * A reusable, keyboard-accessible autocomplete component for code-based selection.
 * Uses client-side filtering of pre-loaded data for instant results.
 * The listbox is portalled to `document.body` and fixed-positioned against the
 * input (same placement as the kit Menu), so table wrappers and modals never clip it.
 */
import {
  useState,
  useRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Field, Input } from './ui';
import { NARROW, placePanel } from './ui/placePanel';
import styles from './CodeAutocomplete.module.css';

/**
 * Interface for autocomplete items
 */
export interface AutocompleteItem {
  /** Unique code for the item */
  code: string;
  /** Display label (e.g., party name, inventory name) */
  label: string;
  /** Optional secondary info */
  sublabel?: string;
  /** The actual ID to use when selecting */
  id: string;
}

/**
 * Props for the CodeAutocomplete component
 */
interface CodeAutocompleteProps {
  /** Visible label; `""` renders the bare input (name it with `aria-label`). */
  label: string;
  /** Accessible name when there is no visible label (e.g. inside a table row). */
  'aria-label'?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current input value */
  value: string;
  /** Callback when input value changes */
  onChange: (value: string, selectedItem?: AutocompleteItem) => void;
  /** Pre-loaded items array to filter from (from RTK Query cache) */
  items: AutocompleteItem[];
  /** Callback when an item is selected */
  onSelect: (item: AutocompleteItem) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Whether the field is required (label star + aria-required; validation stays with the form) */
  required?: boolean;
}

/**
 * CodeAutocomplete - A keyboard-accessible autocomplete for code selection
 *
 * Features:
 * - Text input that filters dropdown as user types
 * - Client-side filtering of pre-loaded items (instant, no API calls)
 * - Keyboard navigation: ArrowDown/Up, Enter, Escape, Tab
 * - Visual highlight for currently selected option (aria-activedescendant)
 * - Shows "No results" when empty
 * - Click outside closes dropdown
 */
export function CodeAutocomplete({
  label,
  'aria-label': ariaLabel,
  placeholder = 'Type to search…',
  value,
  onChange,
  items,
  onSelect,
  disabled = false,
  error,
  required = false,
}: CodeAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const optionId = (index: number) => `${inputId}-option-${index}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * Filter items based on input value
   * Matches against code and label (case-insensitive)
   */
  const filteredItems = useMemo(() => {
    if (!value.trim()) return items.slice(0, 10); // Show first 10 when empty
    const searchTerm = value.toLowerCase();
    return items
      .filter(
        item =>
          item.code.toLowerCase().includes(searchTerm) ||
          item.label.toLowerCase().includes(searchTerm)
      )
      .slice(0, 10); // Limit to 10 results
  }, [value, items]);

  // Reset the highlight whenever the result list changes (adjust-state-during-render pattern).
  const [prevFilterInput, setPrevFilterInput] = useState({ value, items });
  if (prevFilterInput.value !== value || prevFilterInput.items !== items) {
    setPrevFilterInput({ value, items });
    setHighlightedIndex(-1);
  }

  const hasResults = filteredItems.length > 0;
  const showPanel = isOpen && (hasResults || !!value);
  const showListbox = showPanel && hasResults;

  /**
   * Place the panel against the input while open (below it, flipped above when
   * there is no room), and keep it there on scroll and resize.
   */
  useLayoutEffect(() => {
    if (!showPanel) return;
    const place = () => {
      if (dropdownRef.current && inputRef.current) {
        // Narrow phones: CSS spans the viewport, so only placePanel's `top` applies.
        if (window.innerWidth <= NARROW) dropdownRef.current.style.removeProperty('width');
        else
          dropdownRef.current.style.setProperty(
            'width',
            `${inputRef.current.getBoundingClientRect().width}px`
          );
        placePanel(dropdownRef.current, inputRef.current, 'start');
      }
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [showPanel, filteredItems.length]);

  /**
   * Handle click outside to close dropdown (includes portaled dropdown)
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Scroll highlighted item into view
   */
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      setIsOpen(true);
    },
    [onChange]
  );

  /**
   * Handle item selection
   */
  const handleSelect = useCallback(
    (item: AutocompleteItem) => {
      onChange(item.code, item);
      onSelect(item);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange, onSelect]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
            handleSelect(filteredItems[highlightedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, highlightedIndex, filteredItems, handleSelect]
  );

  /**
   * Handle input focus
   */
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const activeOption =
    showListbox && highlightedIndex >= 0 && highlightedIndex < filteredItems.length
      ? optionId(highlightedIndex)
      : undefined;

  // Wrapped in a div so Field links the label (htmlFor) without auto-wiring a
  // native `required` onto the input: the form's zod schema owns validation.
  const input = (
    <div className={styles.inputContainer}>
      <Input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-label={label ? undefined : ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={showListbox ? listboxId : undefined}
        aria-activedescendant={activeOption}
        aria-required={required || undefined}
        invalid={!!error}
      />
    </div>
  );

  return (
    <div className={styles.container} ref={containerRef}>
      {label ? (
        <Field label={label} htmlFor={inputId} required={required} error={error}>
          {input}
        </Field>
      ) : (
        <>
          {input}
          {error && (
            <span role="alert" className={styles.error}>
              {error}
            </span>
          )}
        </>
      )}

      {showPanel &&
        createPortal(
          <div ref={dropdownRef} className={styles.panel}>
            {hasResults ? (
              <ul ref={listRef} id={listboxId} className={styles.dropdown} role="listbox">
                {filteredItems.map((item, index) => (
                  <li
                    key={item.id}
                    id={optionId(index)}
                    className={`${styles.item} ${
                      index === highlightedIndex ? styles.itemHighlighted : ''
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={index === highlightedIndex}
                  >
                    <span className={styles.itemCode}>{item.code}</span>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.sublabel && <span className={styles.itemSublabel}>{item.sublabel}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
