import { useCallback, useContext } from 'react';
import { InterfaceLocale } from './interface-locale-runtime';
import { translateInterface } from './interface-language';
import { RAMOS_SEGMENTOS } from './ramos-segmentos';
import { CONTRIBUTION_AREA_GROUPS } from '@shared/contribution-areas';
import { PROFILE_AREA_SCOPE_OPTIONS, PROFILE_LANGUAGE_OPTIONS } from '@shared/profile-taxonomy';
import { PUBLIC_LABELS } from '@shared/public-labels';
import { STRATEGIC_CELL_TYPES, LEGACY_STRATEGIC_CELL_BUSINESS_TYPES, STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from '@shared/strategic-cells';
import type { Language } from '@shared/user-preferences';

// The API also returns custom labels. Translate only entries owned by the platform.
export const taxonomyTerms = new Set<string>([
  ...Object.values(PUBLIC_LABELS), ...PROFILE_LANGUAGE_OPTIONS, ...PROFILE_AREA_SCOPE_OPTIONS,
  ...RAMOS_SEGMENTOS.flatMap(ramo => [ramo.nome, ...ramo.segmentos.map(segmento => segmento.nome)]),
  ...CONTRIBUTION_AREA_GROUPS.flatMap(group => [group.nucleus, ...group.areas.flatMap(area => [area.value, area.displayName, area.description])]),
  ...STRATEGIC_CELL_TYPES.flatMap(cell => [cell.publicName, cell.description]),
  ...[...STRATEGIC_CELL_BUSINESS_TYPES, ...LEGACY_STRATEGIC_CELL_BUSINESS_TYPES].flatMap(([, , name, label]) => [name, label, formatBusinessThesisLabel(label)]),
]);

export function taxonomyLabel(value: string, language: Language): string {
  return taxonomyTerms.has(value) ? translateInterface(value, language) : value;
}

export function useTaxonomyLabel() {
  const language = useContext(InterfaceLocale);
  return useCallback((value: string) => taxonomyLabel(value, language), [language]);
}

export function canonicalProfileLanguage(input: string, label: (value: string) => string) {
  const value = input.trim();
  const match = value.toLocaleLowerCase();
  return PROFILE_LANGUAGE_OPTIONS.find(option =>
    option.toLocaleLowerCase() === match || label(option).toLocaleLowerCase() === match
  ) || value;
}
