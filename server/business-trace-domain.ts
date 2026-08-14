import { randomBytes } from "crypto";

export function createBusinessTraceCode(bytes = randomBytes(5)): string {
  return `TRC-${bytes.toString("hex").toUpperCase()}`;
}

export function traceObjectTypeForRegistry(registry: { tipo?: unknown }): string {
  if (registry.tipo === "demanda") return "demanda";
  if (registry.tipo === "oportunidade") return "oportunidade";
  return "oba";
}

export function traceStageLabel(type: string, status?: string | null): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (type === "demanda") return normalized === "rascunho" ? "Demanda em preparação" : "Demanda";
  if (type === "oportunidade") return normalized ? `Oportunidade: ${normalized.replace(/_/g, " ")}` : "Oportunidade";
  if (type === "ro") return "Reunião de Oportunidades";
  if (type === "bia") return "BIA";
  if (type === "oba") return "OBA";
  if (type === "resultado") return "Resultado";
  return type.replace(/_/g, " ");
}
