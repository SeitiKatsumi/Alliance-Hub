import { getBiaPublicRef } from "@/lib/bia-url";

type WithId = { id?: string | null };
type BiaLike = WithId & { codigo_publico?: string | null };
type OpaLike = WithId & { bia_id?: string | null; date_created?: string | null };

export function isUuidLike(value?: string | null): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function hashBase36(value?: string | null): string {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export function publicCodeFromId(id?: string | null, prefix = "", length = 10): string {
  if (!id) return "";
  const normalizedPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hashLength = Math.max(1, length - normalizedPrefix.length);
  const hash = hashBase36(id).padStart(hashLength, "0").slice(-hashLength);
  return `${normalizedPrefix}${hash}`.slice(0, length);
}

export function getMembroPublicRef(membro?: WithId | null): string {
  return publicCodeFromId(membro?.id, "M", 10);
}

export function getMembroUrl(membro?: WithId | null): string {
  const ref = getMembroPublicRef(membro);
  return ref ? `/membro/${ref}` : "/area-membros";
}

function sameBiaId(opa: OpaLike, bia?: BiaLike | null): boolean {
  return !!bia?.id && String(opa.bia_id || "") === String(bia.id);
}

export function getOpaSequence(opa: OpaLike, opas: OpaLike[] = []): number {
  const sameBia = opas
    .filter((item) => item.bia_id && item.bia_id === opa.bia_id)
    .sort((a, b) => {
      const dateCompare = String(a.date_created || "").localeCompare(String(b.date_created || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  const index = sameBia.findIndex((item) => item.id === opa.id);
  return index >= 0 ? index + 1 : 1;
}

export function getOpaPublicRef(opa?: OpaLike | null, bia?: BiaLike | null, opas: OpaLike[] = []): string {
  if (!opa?.id) return "";
  if (bia && sameBiaId(opa, bia)) {
    const biaRef = getBiaPublicRef(bia).toUpperCase();
    if (biaRef) return `${biaRef}-${String(getOpaSequence(opa, opas)).padStart(2, "0")}`;
  }
  return publicCodeFromId(opa.id, "O", 10);
}

export function getOpaUrl(opa?: OpaLike | null, bia?: BiaLike | null, opas: OpaLike[] = []): string {
  const ref = getOpaPublicRef(opa, bia, opas);
  return ref ? `/opas/${ref}` : "/opas";
}

export function getVitrineOpaUrl(opa?: OpaLike | null, bia?: BiaLike | null, opas: OpaLike[] = []): string {
  const ref = getOpaPublicRef(opa, bia, opas);
  return ref ? `/vitrine/opas/${ref}` : "/vitrine/oportunidades";
}

export function resolveMembroByRef<T extends WithId>(items: T[] = [], ref?: string | null): T | null {
  if (!ref) return null;
  return items.find((item) => item.id === ref || getMembroPublicRef(item) === ref.toUpperCase()) || null;
}

export function resolveOpaByRef<T extends OpaLike, B extends BiaLike>(
  opas: T[] = [],
  bias: B[] = [],
  ref?: string | null
): T | null {
  if (!ref) return null;
  const normalized = ref.toUpperCase();
  const byId = opas.find((opa) => opa.id === ref);
  if (byId) return byId;
  return opas.find((opa) => {
    const bia = bias.find((item) => item.id === opa.bia_id);
    const publicRef = getOpaPublicRef(opa, bia, opas);
    return publicRef === normalized || publicRef.replace("-", "") === normalized;
  }) || null;
}
