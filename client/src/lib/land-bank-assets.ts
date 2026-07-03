export function landBankPhotoUrl(value?: any): string | null {
  if (!value) return null;
  if (typeof value === "object") {
    return landBankPhotoUrl(value.id || value.uuid || value.directus_files_id || value.file);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^(data:|blob:|https?:\/\/|\/api\/assets\/)/i.test(text)) return text;
  return `/api/assets/${text}?width=1200&height=520&fit=cover`;
}
