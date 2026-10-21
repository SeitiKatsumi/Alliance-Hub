import { STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "./strategic-cells";

type BiaBusinessRecord = { business_type_code?: unknown; objetivo_alianca?: unknown };

export function biaBusinessTypeCode(bia: BiaBusinessRecord): string {
  const value = bia.business_type_code || bia.objetivo_alianca;
  return STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === value)?.[1] || "";
}

export function biaBusinessTypeLabel(bia: BiaBusinessRecord): string {
  const item = STRATEGIC_CELL_BUSINESS_TYPES.find(([, code]) => code === biaBusinessTypeCode(bia));
  return item ? formatBusinessThesisLabel(item[3]) : typeof bia.objetivo_alianca === "string" ? bia.objetivo_alianca : "";
}

// Keep the existing physical field for compatibility. It now stores the thesis code,
// not a second independently editable objective. Legacy values are read, not guessed.
export function biaBusinessTypeStoragePayload<T extends Record<string, any>>(input: T): Record<string, any> {
  const data: Record<string, any> = {...input};
  if (input.business_type_code !== undefined) {
    if (typeof input.business_type_code !== "string" || (input.business_type_code !== "" && !biaBusinessTypeCode({business_type_code:input.business_type_code}))) {
      throw Object.assign(new Error("Escolha um tipo de negócio válido."), {statusCode:400});
    }
    data.objetivo_alianca = input.business_type_code || null;
  }
  delete data.business_type_code;
  return data;
}
