/**
 * @fileoverview i18n bootstrap for the Nocturna SPA (Italian + English).
 *
 * Preference is persisted in localStorage. Default: browser language if it
 * starts with `it`, otherwise English — Hosts in Italy get IT out of the box.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it.json';
import en from './locales/en.json';

export const LANG_STORAGE_KEY = 'nocturna.lang.v1';

export type AppLanguage = 'it' | 'en';

export function detectDefaultLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'it' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('it')) {
    return 'it';
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: detectDefaultLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setAppLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export default i18n;
