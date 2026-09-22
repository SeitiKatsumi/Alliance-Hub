export const formatBiaPercent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits:5, maximumFractionDigits:5 })}%`;
export const formatBiaNumber = (value: number, decimals = 2) => value.toLocaleString("pt-BR", { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
export function parseBiaNumber(value: string): number {
  const normalized = value.trim().replace(/R\$|%|\s/g, "");
  if (!normalized || !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(normalized)) return NaN;
  return Number(normalized.replace(/\./g, "").replace(",", "."));
}
