export const PROFILE_AREA_SCOPE_OPTIONS = ["Local", "Regional", "Nacional", "Global"] as const;

export const PROFILE_LANGUAGE_OPTIONS = [
  "Português", "Inglês", "Espanhol", "Francês", "Alemão", "Italiano",
  "Mandarim", "Japonês", "Árabe", "Russo", "Hindi", "Coreano",
  "Holandês", "Sueco", "Norueguês", "Dinamarquês", "Finlandês",
  "Polonês", "Turco", "Hebraico", "Grego", "Tailandês", "Vietnamita",
  "Indonésio", "Malaio", "Húngaro", "Tcheco", "Romeno", "Búlgaro",
  "Ucraniano", "Croata", "Sérvio", "Eslovaco", "Catalão", "Persa",
] as const;

export function normalizeProfileLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
}
