import { z } from 'zod';

export const languages = ['pt-BR', 'pt-PT', 'en', 'es'] as const;
export const emailCategories = ['invites', 'agenda', 'bia', 'opportunities', 'ro_pulses', 'community'] as const;
export type Language = typeof languages[number];
export type EmailCategory = typeof emailCategories[number];
export type MailCategory = EmailCategory | 'essential';
export const emailPreferencesSchema = z.object({
  invites: z.boolean(), agenda: z.boolean(), bia: z.boolean(),
  opportunities: z.boolean(), ro_pulses: z.boolean(), community: z.boolean(),
}).strict();
export const preferencesSchema = z.object({ language: z.enum(languages), email: emailPreferencesSchema }).strict();
export const preferencesPatchSchema = z.object({
  language: z.enum(languages).optional(), email: emailPreferencesSchema.partial().optional(),
}).strict().refine(value => value.language !== undefined || Object.keys(value.email || {}).length > 0);
export type UserPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = (): UserPreferences => ({
  language: 'pt-BR', email: { invites:true, agenda:true, bia:true, opportunities:true, ro_pulses:true, community:true },
});

export function parsePreferences(value: unknown): UserPreferences {
  const base = defaultPreferences();
  const raw = value as Partial<UserPreferences> | null;
  // Existing opt-outs also apply to RO pulses until the person makes a separate choice.
  if (typeof raw?.email?.opportunities === 'boolean') base.email.ro_pulses = raw.email.opportunities;
  if (languages.includes(raw?.language as Language)) base.language = raw!.language!;
  for (const category of emailCategories) if (typeof raw?.email?.[category] === 'boolean') base.email[category] = raw.email[category];
  return base;
}
