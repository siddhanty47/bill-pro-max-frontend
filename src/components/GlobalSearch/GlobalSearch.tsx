/**
 * Header global search: fuzzy local entity search + server document lookup.
 * Desktop renders an inline bar; on ≤768px a search icon opens the same bar
 * as a full-width overlay (CSS-driven, one input instance).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { usePlatform } from '../../hooks/usePlatform'
import { useGlobalSearch } from './useGlobalSearch'
import { SearchResultRow } from './SearchResultRow'
import type { SearchResult } from './searchEngine'
import styles from './GlobalSearch.module.css'

const MOBILE_QUERY = '(max-width: 768px)'

const svgProps = {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.3,
  strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const, 'aria-hidden': true,
}

const SearchIcon = () => (
  <svg {...svgProps}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

const CloseIcon = () => (
  <svg {...svgProps}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export function GlobalSearch() {
  const s = useGlobalSearch()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMac } = usePlatform()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const optionId = (key: string) => `${listId}-opt-${key.replace(/[^\w-]/g, '_')}`
  const [mobileOpen, setMobileOpen] = useState(false)

  const focusSearch = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileOpen(true)
    inputRef.current?.focus()
    inputRef.current?.select()
  }
  useHotkey('ctrl+k', focusSearch)
  useHotkey('meta+k', focusSearch)
  useHotkey('/', focusSearch)

  // Focus the input once the mobile overlay is shown.
  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus()
  }, [mobileOpen])

  // Any route change (ours or elsewhere) closes the mobile overlay.
  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setMobileOpen(false)
  }

  if (s.hidden) return null

  const closeAll = () => {
    s.setOpen(false)
    setMobileOpen(false)
    inputRef.current?.blur()
  }

  const go = (r: SearchResult) => {
    s.reset()
    closeAll()
    navigate(r.href)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        s.setOpen(true)
        s.move(e.key === 'ArrowDown' ? 1 : -1)
        break
      case 'Enter':
        if (s.open && s.selected) {
          e.preventDefault()
          go(s.selected)
        }
        break
      case 'Escape':
        e.preventDefault()
        closeAll()
        break
      case 'Tab':
        s.setOpen(false)
        break
    }
  }

  const loadingRow = s.docsLoading && (
    <li className={styles.loadingRow} aria-hidden="true">Searching bills &amp; challans…</li>
  )
  const rows = s.results.map((r) => (
    <SearchResultRow
      key={r.key}
      id={optionId(r.key)}
      result={r}
      query={s.trimmed}
      selected={r.key === s.selectedKey}
      onHover={() => s.select(r.key)}
      onPick={() => go(r)}
    />
  ))
  const empty = s.results.length === 0 && !s.docsLoading && !s.indexing

  return (
    <div className={`${styles.root} ${mobileOpen ? styles.mobileOpen : ''}`}>
      <button
        type="button"
        className={styles.mobileTrigger}
        onClick={() => setMobileOpen(true)}
        aria-label="Search"
      >
        <SearchIcon />
      </button>

      {mobileOpen && <div className={styles.backdrop} onClick={closeAll} />}

      <div className={styles.panel}>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}><SearchIcon /></span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search parties, items, bills…"
            value={s.query}
            onChange={(e) => {
              s.setQuery(e.target.value)
              s.setOpen(true)
            }}
            onFocus={() => s.setOpen(true)}
            onBlur={() => s.setOpen(false)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={s.open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={s.open && s.selectedKey ? optionId(s.selectedKey) : undefined}
            aria-label="Global search"
            autoComplete="off"
            spellCheck={false}
          />
          {s.indexing ? (
            <span className={styles.hint}>Indexing…</span>
          ) : (
            !s.query && <kbd className={styles.kbd}>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          )}
          <button type="button" className={styles.mobileClose} onClick={closeAll} aria-label="Close search">
            <CloseIcon />
          </button>
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className={`${styles.dropdown} ${s.open ? styles.dropdownOpen : ''}`}
          // Keep focus in the input while clicking a row.
          onMouseDown={(e) => e.preventDefault()}
        >
          {s.open && (
            <>
              {s.docsFirst && loadingRow}
              {rows}
              {!s.docsFirst && loadingRow}
              {s.indexing && s.results.length === 0 && <li className={styles.emptyRow}>Indexing…</li>}
              {empty && <li className={styles.emptyRow}>No matches for &ldquo;{s.trimmed}&rdquo;</li>}
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
