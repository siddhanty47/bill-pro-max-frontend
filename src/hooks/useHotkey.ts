/**
 * Lightweight keyboard shortcut hook.
 *
 * Combo syntax: modifier tokens joined by "+", followed by the key name.
 *   - "alt+n"  → e.altKey + physical N key
 *   - "/"      → bare "/" key with no modifiers
 *
 * Supported modifiers: alt, ctrl, shift, meta.
 *
 * Uses `e.code` (physical key position) instead of `e.key` so that
 * modifier-induced character transformations (e.g. Option+N → "˜" on
 * macOS) don't break matching.
 *
 * When the combo contains no modifiers (e.g. "/"), the handler is
 * skipped if the active element is a text-entry field so normal
 * typing is not intercepted.
 */
import { useEffect, useRef } from 'react';

type Modifier = 'alt' | 'ctrl' | 'shift' | 'meta';
const MODIFIER_SET = new Set<string>(['alt', 'ctrl', 'shift', 'meta']);

const SPECIAL_KEY_CODES: Record<string, string> = {
  '/': 'Slash', '\\': 'Backslash',
  '.': 'Period', ',': 'Comma',
  ';': 'Semicolon', "'": 'Quote',
  '[': 'BracketLeft', ']': 'BracketRight',
  '-': 'Minus', '=': 'Equal',
  '`': 'Backquote',
  escape: 'Escape', enter: 'Enter', tab: 'Tab',
  space: 'Space', backspace: 'Backspace', delete: 'Delete',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
};

/** Map a human-readable key name to the physical `KeyboardEvent.code` value. */
function toCode(key: string): string {
  if (key.length === 1 && key >= 'a' && key <= 'z') return `Key${key.toUpperCase()}`;
  if (key.length === 1 && key >= '0' && key <= '9') return `Digit${key}`;
  return SPECIAL_KEY_CODES[key] ?? key;
}

interface ParsedCombo {
  code: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  hasModifier: boolean;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+');
  const modifiers: Record<Modifier, boolean> = { alt: false, ctrl: false, shift: false, meta: false };
  let key = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (MODIFIER_SET.has(trimmed)) {
      modifiers[trimmed as Modifier] = true;
    } else {
      key = trimmed;
    }
  }

  return {
    code: toCode(key),
    ...modifiers,
    hasModifier: modifiers.alt || modifiers.ctrl || modifiers.shift || modifiers.meta,
  };
}

function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useHotkey(combo: string, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const parsedRef = useRef(parseCombo(combo));
  parsedRef.current = parseCombo(combo);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const p = parsedRef.current;

      if (!p.hasModifier && isTextInput(e.target)) return;

      if (e.code !== p.code) return;
      if (e.altKey !== p.alt) return;
      if (e.ctrlKey !== p.ctrl) return;
      if (e.shiftKey !== p.shift) return;
      if (e.metaKey !== p.meta) return;

      e.preventDefault();
      handlerRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [combo]);
}
