import React, { createContext, createElement, type Key, type ReactNode } from 'react';
import type { Language } from '@shared/user-preferences';
import { translateInterface } from './interface-language';

export const InterfaceLocale = createContext<Language>('pt-BR');
const owned = new WeakMap<object, ReadonlySet<string>>();
export function markCopyObject<T extends object>(object: T, keys: string[]): T {
  owned.set(object, new Set(keys));
  return object;
}
export function interfaceText(language: Language) {
  const text = (value: string) => translateInterface(value, language);
  return Object.assign(text, {
    locale: language === 'en' ? 'en-US' : language,
    field(object: Record<string, unknown> | null | undefined, key: string) {
      const raw = object?.[key];
      return typeof raw === 'string' && object && owned.get(object)?.has(key) ? text(raw) : raw;
    },
    template(parts: string[], values: unknown[]) {
      const source = parts.map((part, i) => part + (i < values.length ? '{'+i+'}' : '')).join('');
      const translated = text(source);
      if (translated !== source) return translated.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
      return parts.map((part, i) => text(part) + (i < values.length ? String(values[i]) : '')).join('');
    },
  });
}
const byLanguage = { 'pt-BR': interfaceText('pt-BR'), 'pt-PT': interfaceText('pt-PT'), en: interfaceText('en'), es: interfaceText('es') };
let renderingLocale: string | undefined;
export function presentationLocale() {
  return renderingLocale || (typeof document !== 'undefined' && document.documentElement.lang) || 'pt-BR';
}
export function localizedView(render: (text: ReturnType<typeof interfaceText>) => ReactNode, key?: Key) {
  return createElement(InterfaceLocale.Consumer, { key, children: language => {
    const previous = renderingLocale;
    try { renderingLocale = byLanguage[language].locale; return render(byLanguage[language]); }
    finally { renderingLocale = previous; }
  } });
}
