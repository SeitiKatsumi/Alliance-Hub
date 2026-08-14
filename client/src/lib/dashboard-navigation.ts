export type DashboardTab = "inicio" | "carteira" | "negocios" | "gestao";
export type CarteiraView = "imoveis" | "bias";
export type BusinessSection = "recomendados" | "indicadores" | "andamento" | "minhas-oportunidades";

export interface DashboardNavigationState {
  tab: DashboardTab;
  carteiraView: CarteiraView;
  businessSection: BusinessSection;
}

const dashboardTabs = new Set<DashboardTab>(["inicio", "carteira", "negocios", "gestao"]);
const businessSections = new Set<BusinessSection>(["recomendados", "indicadores", "andamento", "minhas-oportunidades"]);

export function resolveDashboardNavigation(search: string): DashboardNavigationState {
  const params = new URLSearchParams(search);
  const requestedTab = params.get("tab");
  const requestedView = params.get("view");
  const requestedSection = params.get("section") as BusinessSection | null;

  if (requestedTab === "convergencias" || requestedTab === "opas") {
    return { tab: "negocios", carteiraView: "imoveis", businessSection: "recomendados" };
  }

  if (requestedTab === "carteira" && requestedView === "oportunidades") {
    return { tab: "negocios", carteiraView: "imoveis", businessSection: "minhas-oportunidades" };
  }

  const tab: DashboardTab = requestedTab === "bias"
    ? "carteira"
    : dashboardTabs.has(requestedTab as DashboardTab)
      ? requestedTab as DashboardTab
      : "inicio";

  return {
    tab,
    carteiraView: requestedTab === "bias" || requestedView === "bias" ? "bias" : "imoveis",
    businessSection: businessSections.has(requestedSection as BusinessSection) ? requestedSection! : "recomendados",
  };
}

export function dashboardNavigationUrl(state: DashboardNavigationState): string {
  if (state.tab === "inicio") return "/";
  if (state.tab === "carteira") return `/?tab=carteira&view=${state.carteiraView}`;
  if (state.tab === "negocios") return `/?tab=negocios&section=${state.businessSection}`;
  return "/?tab=gestao";
}
