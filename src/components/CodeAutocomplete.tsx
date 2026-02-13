/**
 * CodeAutocomplete Component
 * A reusable, keyboard-accessible autocomplete component for code-based selection.
 * Uses client-side filtering of pre-loaded data for instant results.
 */
import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import './CodeAutocomplete.css';

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
  /** Label for the input field */
  label: string;
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
  /** Whether the field is required */
  required?: boolean;
}

/**
 * CodeAutocomplete - A keyboard-accessible autocomplete for code selection
 * 
 * Features:
 * - Text input that filters dropdown as user types
 * - Client-side filtering of pre-loaded items (instant, no API calls)
 * - Keyboard navigation: ArrowDown/Up, Enter, Escape, Tab
 * - Visual highlight for currently selected option
 * - Shows "No results" when empty
 * - Click outside closes dropdown
 */
export function CodeAutocomplete({
  label,
  placeholder = 'Type to search...',
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
  const [filteredItems, setFilteredItems] = useState<AutocompleteItem[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * Filter items based on input value
   * Matches against code and label (case-insensitive)
   */
  useEffect(() => {
    if (!value.trim()) {
      setFilteredItems(items.slice(0, 10)); // Show first 10 when empty
      return;
    }

    const searchTerm = value.toLowerCase();
    const filtered = items.filter(
      (item) =>
        item.code.toLowerCase().includes(searchTerm) ||
        item.label.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results

    setFilteredItems(filtered);
    setHighlightedIndex(-1);
  }, [value, items]);

  /**
   * Handle click outside to close dropdown
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
          setHighlightedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
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

  return (
    <div className="code-autocomplete" ref={containerRef}>
      <label className="code-autocomplete__label">
        {label}
        {required && ' *'}
      </label>
      
      <div className="code-autocomplete__input-container">
        <input
          ref={inputRef}
          type="text"
          className={`code-autocomplete__input ${error ? 'code-autocomplete__input--error' : ''}`}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        {isOpen && filteredItems.length > 0 && (
          <ul
            ref={listRef}
            className="code-autocomplete__dropdown"
            role="listbox"
          >
            {filteredItems.map((item, index) => (
              <li
                key={item.id}
                className={`code-autocomplete__item ${
                  index === highlightedIndex ? 'code-autocomplete__item--highlighted' : ''
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <span className="code-autocomplete__item-code">{item.code}</span>
                <span className="code-autocomplete__item-label">{item.label}</span>
                {item.sublabel && (
                  <span className="code-autocomplete__item-sublabel">{item.sublabel}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOpen && value && filteredItems.length === 0 && (
          <div className="code-autocomplete__no-results">No results found</div>
        )}
      </div>

      {error && <span className="code-autocomplete__error">{error}</span>}
    </div>
  );
}
