import { biaBusinessTypeCode } from "./bia-business-type";

// Includes mixed sale/rental theses; income-only and unspecified theses stay out.
const SALES_THESES = new Set([
  "APPRECIATION_HOLD", "FLIPPING", "SHORT_TERM_RESALE",
  "REAL_ESTATE_INCORPORATION", "LAND_SUBDIVISION",
  "ASSET_REGULARIZATION", "STALLED_CONSTRUCTION_COMPLETION", "RETROFIT_REPOSITIONING",
]);
const LEGACY_SALES_THESES = new Set(["BUILD_TO_SELL", "OFF_PLAN_RESALE"]);

export function biaHasSalesThesis(bia?: { business_type_code?: unknown; objetivo_alianca?: unknown } | null): boolean {
  if (!bia) return false;
  const code = biaBusinessTypeCode(bia);
  if (code) return SALES_THESES.has(code);
  const legacy = bia.business_type_code || bia.objetivo_alianca;
  return typeof legacy === "string" && (LEGACY_SALES_THESES.has(legacy) || legacy.trim().toLowerCase() === "venda");
}
