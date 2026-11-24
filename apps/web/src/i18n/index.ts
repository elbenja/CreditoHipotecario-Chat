import { useSyncExternalStore } from 'react';
import { en } from './en';
import { es, type Copy } from './es';

/**
 * The reader's language. Kept outside React, like the access token, because
 * the reducer, the PDF reader and the API client write copy too — and the API
 * needs to know which language to answer in.
 */
export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
export const LANG_NAMES: Record<Lang, string> = { es: 'Español', en: 'English' };

const KEY = 'dito-lang-v1';
const COPY: Record<Lang, Copy> = { es, en };

/** A stored choice wins; otherwise Spanish only for a Spanish browser. */
function detect(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Private mode: fall through to the browser.
  }
  const browser = typeof navigator === 'undefined' ? 'es' : (navigator.languages?.[0] ?? navigator.language ?? 'es');
  return browser.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang: Lang = detect();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
apply();

export const getLang = () => lang;

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice lasts for this tab only.
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The copy for whatever is current. Outside React, read it at call time. */
export const t = (): Copy => COPY[lang];

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}

/** Re-renders the component when the language changes. */
export function useT(): Copy {
  return COPY[useLang()];
}

/** A row's name in the reader's language, by key, or the name it came with. */
export function fieldLabel(copy: Copy, field: { key: string; label: string }): string {
  return (copy.fieldLabels as Record<string, string>)[field.key] ?? copy.mortgageLabels[field.key] ?? field.label;
}

/** A stored unit ("años", "cuotas") in the reader's language. */
export function unitLabel(copy: Copy, suffix: string | undefined): string | undefined {
  if (!suffix) return suffix;
  const s = suffix.trim().toLowerCase();
  if (s === 'años' || s === 'year' || s === 'years') return copy.units.years;
  if (s === 'cuotas' || s === 'installments') return copy.units.installments;
  return suffix;
}
