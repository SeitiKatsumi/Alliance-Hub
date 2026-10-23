import { STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "./strategic-cells";

type BiaBusinessRecord = { business_type_code?: unknown; objetivo_alianca?: unknown };

export function biaBusinessTypeCode(bia: BiaBusinessRecord): string {
  return [bia.business_type_code, bia.objetivo_alianca]
    .map(value => STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === value)?.[1])
    .find(Boolean) || "";
}

export function biaBusinessTypeLabel(bia: BiaBusinessRecord): string {
  const item = STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === biaBusinessTypeCode(bia));
  return item ? formatBusinessThesisLabel(item[3]) : "";
}

// An OBA's legacy field is a free-text scope, not the BIA's thesis selection.
export function opportunityScopeLabel(opportunity: BiaBusinessRecord): string {
  return biaBusinessTypeLabel(opportunity) || (typeof opportunity.objetivo_alianca === "string" ? opportunity.objetivo_alianca : "");
}

export function buildBiaThesisAllocation(items: (BiaBusinessRecord & { invested: number })[]) {
  const groups = new Map<string, { name: string; value: number }>();
  for (const item of items) {
    if (!Number.isFinite(item.invested) || item.invested <= 0) continue;
    const key = biaBusinessTypeCode(item) || "unclassified";
    const group = groups.get(key) || { name: biaBusinessTypeLabel(item) || "Tese não definida", value: 0 };
    group.value += item.invested;
    groups.set(key, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.value, 0);
  return [...groups.values()].map(group => ({ ...group, percent: group.value / total * 100 }))
    .sort((a, b) => b.value - a.value);
}

// Keep the existing physical field for compatibility. It now stores the thesis code,
// not a second independently editable objective. Legacy values are read, not guessed.
export function biaBusinessTypeStoragePayload<T extends Record<string, any>>(input: T): Record<string, any> {
  const data: Record<string, any> = {...input};
  if (input.business_type_code !== undefined) {
    if (typeof input.business_type_code !== "string" || (input.business_type_code !== "" && !biaBusinessTypeCode({business_type_code:input.business_type_code}))) {
      throw Object.assign(new Error("Escolha uma tese de interesse válida."), {statusCode:400});
    }
    data.objetivo_alianca = input.business_type_code || null;
  }
  delete data.business_type_code;
  return data;
}
