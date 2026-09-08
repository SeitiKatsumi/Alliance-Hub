export function formatPtBrMoneyInput(value: unknown, fixedCents = false): string {
  if (value == null || String(value).trim() === "") return "";

  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: fixedCents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  const raw = String(value).replace(/[^\d,.]/g, "");
  const commaIndex = raw.lastIndexOf(",");
  const decimalIndex = commaIndex >= 0
    ? commaIndex
    : (raw.match(/\./g) || []).length === 1 && /\.\d{1,2}$/.test(raw) ? raw.lastIndexOf(".") : -1;
  const integerDigits = (decimalIndex >= 0 ? raw.slice(0, decimalIndex) : raw).replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const cents = decimalIndex >= 0 ? raw.slice(decimalIndex + 1).replace(/\D/g, "").slice(0, 2) : "";
  const integer = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (fixedCents) return `${integer},${cents.padEnd(2, "0")}`;
  return decimalIndex >= 0 ? `${integer},${cents}` : integer;
}
