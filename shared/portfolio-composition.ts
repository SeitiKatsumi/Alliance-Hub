export interface CompositionProperty { id: string; tipo?: string | null; ocupacao?: string | null; consolidado_via_bia?: boolean }
export interface CompositionSlice { name: string; value: number; percent: number }
const occupancy: Record<string, string> = { ocupado: "Ocupado", parcial: "Parcialmente ocupado", parcialmente_ocupado: "Parcialmente ocupado", subutilizado: "Parcialmente ocupado", vazio: "Vazio", ocioso: "Vazio", desocupado: "Vazio", uso_proprio: "Uso próprio" };
export function portfolioComposition(properties: CompositionProperty[]) {
  const owned = [...new Map(properties.filter(p => !p.consolidado_via_bia).map(p => [p.id, p])).values()];
  const group = (label: (p: CompositionProperty) => string): CompositionSlice[] => {
    const counts = new Map<string, number>();
    for (const p of owned) { const key = label(p); counts.set(key, (counts.get(key) || 0) + 1); }
    return [...counts].map(([name, value]) => ({ name, value, percent: value / owned.length * 100 })).sort((a,b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  };
  return { total: owned.length, occupancy: group(p => occupancy[String(p.ocupacao || "").trim().toLowerCase()] || "Não informado"), types: group(p => p.tipo?.trim() || "Não informado") };
}
