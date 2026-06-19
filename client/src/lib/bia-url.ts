export type BiaPublicRef = {
  id?: string | null;
  codigo_publico?: string | null;
};

export function getBiaPublicRef(bia?: BiaPublicRef | null): string {
  return String(bia?.codigo_publico || bia?.id || "").trim();
}

export function getBiaUrl(bia?: BiaPublicRef | null): string {
  const ref = getBiaPublicRef(bia);
  return ref ? `/bias/${ref}` : "/bias";
}
