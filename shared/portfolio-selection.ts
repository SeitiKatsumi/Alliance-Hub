/** Filter only an already authorized portfolio; never fetch arbitrary IDs. */
export function selectPortfolio<P extends { id: string }, B extends { id: string }>(
  properties: P[], alliances: B[], propertyId: unknown = "", allianceId: unknown = "",
) {
  for (const value of [propertyId, allianceId]) {
    if (typeof value !== "string") throw Object.assign(new Error("Filtro inválido."), { status: 400 });
  }
  const imoveis = propertyId ? properties.filter(p => String(p.id) === propertyId) : properties;
  const aliancas = allianceId ? alliances.filter(b => String(b.id) === allianceId) : alliances;
  if ((propertyId && !imoveis.length) || (allianceId && !aliancas.length)) {
    throw Object.assign(new Error("Item indisponível nesta carteira."), { status: 404 });
  }
  return { imoveis, aliancas };
}
