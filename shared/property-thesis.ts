import { STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "./strategic-cells";
export const PROPERTY_THESIS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["gerir", "Apenas cadastrar e gerir"],
  ...STRATEGIC_CELL_BUSINESS_TYPES.map(([, code, , label]) => [code, formatBusinessThesisLabel(label)] as const),
];
// Broad legacy goals cannot identify a specific thesis; retain them without guessing.
export const LEGACY_PROPERTY_GOALS: Record<string, string> = {
  vender: "Vender", alugar: "Alugar", reformar: "Reformar", construir: "Construir",
  regularizar: "Regularizar", estruturar_alianca: "Estruturar uma Aliança BUILT",
  renda: "Gerar renda", venda: "Venda", valorizacao: "Valorização", uso: "Uso próprio",
  reforma: "Reforma", construcao: "Construção", indefinido: "Ainda não definido",
};
export function propertyThesisCode(value: unknown): string {
  return STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === String(value || "").toUpperCase())?.[1] || "";
}
export function propertyThesisLabel(value: unknown): string {
  return PROPERTY_THESIS_OPTIONS.find(([code]) => code === (propertyThesisCode(value) || value))?.[1]
    || LEGACY_PROPERTY_GOALS[String(value)] || "Tese não definida";
}
export function propertyThesisOptions(value?: unknown) {
  return Object.prototype.hasOwnProperty.call(LEGACY_PROPERTY_GOALS, String(value))
    ? [...PROPERTY_THESIS_OPTIONS, [String(value), propertyThesisLabel(value) + " (cadastro anterior)"] as const]
    : PROPERTY_THESIS_OPTIONS;
}
export function validatePropertyGoal(value: unknown): string {
  const code = propertyThesisCode(value);
  if (code) return code;
  if (typeof value === "string" && (value === "gerir" || Object.prototype.hasOwnProperty.call(LEGACY_PROPERTY_GOALS, value))) return value;
  throw Object.assign(new Error("Selecione uma tese válida para o imóvel."), { status: 400 });
}
export function propertyThesisGroup(value: unknown): string {
  return STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === propertyThesisCode(value))?.[0] || "";
}
