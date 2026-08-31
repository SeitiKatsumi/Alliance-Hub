export const STRATEGIC_CELL_TYPES = [
  { code: "VALUE_RESALE", name: "Valorização e Revenda", publicName: "Valorização e Revenda", description: "Comprar, melhorar e vender imóveis.", iconKey: "trending-up" },
  { code: "REAL_ESTATE_INCOME", name: "Renda Imobiliária", publicName: "Renda Imobiliária", description: "Ter ou desenvolver imóveis para gerar aluguel e renda.", iconKey: "landmark" },
  { code: "REAL_ESTATE_DEVELOPMENT", name: "Desenvolvimento Imobiliário", publicName: "Desenvolvimento Imobiliário", description: "Criar novos empreendimentos e desenvolver terrenos.", iconKey: "building-2" },
  { code: "ASSET_UNLOCKING", name: "Destravamento de Ativos", publicName: "Destravamento de Ativos", description: "Resolver problemas do imóvel e aumentar seu valor.", iconKey: "key-round" },
  { code: "INVESTMENT_CAPITAL", name: "Investimento e Capital", publicName: "Investimento e Capital", description: "Investir ou financiar negócios imobiliários.", iconKey: "badge-dollar-sign" },
  { code: "PROPERTY_OPERATIONS", name: "Operação Imobiliária", publicName: "Operação Imobiliária", description: "Administrar e operar imóveis para gerar resultado.", iconKey: "settings-2" },
] as const;

export const STRATEGIC_CELL_BUSINESS_TYPES = [
  ["VALUE_RESALE", "FLIPPING", "Flipping", "Comprar, reformar e vender"],
  ["VALUE_RESALE", "REAL_ESTATE_AUCTIONS", "Leilões Imobiliários", "Comprar imóveis em leilão"],
  ["VALUE_RESALE", "OFF_PLAN_RESALE", "Compra na Planta", "Comprar na planta para revender"],
  ["VALUE_RESALE", "BUILD_TO_SELL", "Built to Sell", "Construir para vender"],
  ["REAL_ESTATE_INCOME", "BUY_AND_HOLD", "Buy and Hold", "Comprar para alugar e manter"],
  ["REAL_ESTATE_INCOME", "SHORT_STAY", "Short Stay", "Aluguel por temporada"],
  ["REAL_ESTATE_INCOME", "BUILD_TO_RENT", "Build to Rent", "Construir para alugar"],
  ["REAL_ESTATE_INCOME", "BUILD_TO_SUIT", "Built to Suit", "Construir sob medida para locação"],
  ["REAL_ESTATE_DEVELOPMENT", "REAL_ESTATE_INCORPORATION", "Incorporação Imobiliária", "Desenvolver empreendimento para venda"],
  ["REAL_ESTATE_DEVELOPMENT", "LAND_SUBDIVISION", "Loteamento", "Desenvolver e vender lotes"],
  ["REAL_ESTATE_DEVELOPMENT", "HORIZONTAL_DEVELOPMENT", "Desenvolvimento Horizontal", "Desenvolver condomínio horizontal"],
  ["REAL_ESTATE_DEVELOPMENT", "MIXED_USE_DEVELOPMENT", "Desenvolvimento de Uso Misto", "Desenvolver imóvel com mais de um uso"],
  ["ASSET_UNLOCKING", "ASSET_REGULARIZATION", "Regularização", "Regularizar o imóvel"],
  ["ASSET_UNLOCKING", "CHANGE_OF_USE", "Mudança de Uso", "Transformar o uso do imóvel"],
  ["ASSET_UNLOCKING", "RETROFIT_REPOSITIONING", "Retrofit e Reposicionamento", "Renovar e reposicionar o imóvel"],
  ["ASSET_UNLOCKING", "DISTRESSED_ASSETS", "Ativos Distressed", "Resolver e recuperar imóveis com problemas"],
  ["INVESTMENT_CAPITAL", "CO_INVESTMENT", "Coinvestimento", "Investir junto em uma BIA"],
  ["INVESTMENT_CAPITAL", "REAL_ESTATE_DEBT", "Dívida Imobiliária", "Financiar uma BIA"],
  ["PROPERTY_OPERATIONS", "ASSET_MANAGEMENT", "Gestão de Ativos", "Administrar imóveis e gerar resultado"],
  ["PROPERTY_OPERATIONS", "FACILITIES_MANAGEMENT", "Facilities", "Operar e manter imóveis"],
  ["PROPERTY_OPERATIONS", "HOSPITALITY_OPERATION", "Operação de Hospitalidade", "Operar hospedagem e estadias"],
  ["PROPERTY_OPERATIONS", "SPECIALIZED_PROPERTY_OPERATION", "Operações Especializadas", "Operar imóveis com modelo especializado"],
] as const;

export function getStrategicCellType(code: unknown) {
  return STRATEGIC_CELL_TYPES.find((item) => item.code === String(code).toUpperCase()) || null;
}

export function getBusinessTypesForStrategicCell(code: unknown) {
  const normalized = String(code).toUpperCase();
  return STRATEGIC_CELL_BUSINESS_TYPES
    .filter(([cellCode]) => cellCode === normalized)
    .map(([, businessTypeCode, name, publicName]) => ({ code: businessTypeCode, name, publicName }));
}

export function normalizeStrategicCellPreferences(cellTypeCodes: unknown, businessTypeCodes: unknown) {
  const hasCanonicalBusinessTypes = Array.isArray(businessTypeCodes);
  const legacySelectedCells = Array.from(new Set((Array.isArray(cellTypeCodes) ? cellTypeCodes : [cellTypeCodes])
    .map((code) => String(code || "").trim().toUpperCase())
    .filter((code) => STRATEGIC_CELL_TYPES.some((item) => item.code === code))));
  const knownBusinessTypes = new Map(STRATEGIC_CELL_BUSINESS_TYPES.map(([cellCode, code]) => [code, cellCode]));
  const selectedBusinessTypes = Array.from(new Set((Array.isArray(businessTypeCodes) ? businessTypeCodes : [businessTypeCodes])
    .map((code) => String(code || "").trim().toUpperCase())
    .filter((code) => knownBusinessTypes.has(code as any))));
  return {
    cellTypeCodes: hasCanonicalBusinessTypes || selectedBusinessTypes.length
      ? Array.from(new Set(selectedBusinessTypes.map((code) => knownBusinessTypes.get(code as any)!)))
      : legacySelectedCells,
    businessTypeCodes: selectedBusinessTypes,
  };
}
