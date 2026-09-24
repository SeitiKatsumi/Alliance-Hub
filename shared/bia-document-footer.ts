export function buildBiaMouFooterText(name: string, code = "") {
  const biaName = (name || "selecionada").replace(/\s+/g, " ").replace(/^BIA\s+/i, "").trim();
  const label = [biaName, code.trim()].filter(Boolean).join(" / ");
  return `Esta página integra o MoU Padrão BUILT vinculado à BIA ${label} e deve ser interpretada em conjunto com o documento completo, seus anexos, registros formais, deliberações internas e instrumentos jurídicos específicos da respectiva Aliança.`;
}
