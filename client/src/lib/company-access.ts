import {
  hasCompanyAccess,
  type CompanyAccessKey,
  type CompanyAccessLevel,
} from "@shared/company-access";
import type { AppUser } from "@/hooks/use-auth";

export function companyModuleForLocation(location: string): CompanyAccessKey | null {
  const path = String(location || "/").split("?")[0].toLowerCase();
  if (path === "/" || path === "/painel") return "inicio";
  if (path.startsWith("/agenda")) return "agenda";
  if (path.startsWith("/carteira")) return "carteira";
  if (path.startsWith("/vitrine")) return "vitrine";
  if (path.startsWith("/built-capital") || path.startsWith("/land-bank")) return "capital";
  if (path.startsWith("/aura")) return "aura";
  if (
    path.startsWith("/bias")
    || path.startsWith("/opas")
    || path.startsWith("/area-aliancas")
    || path.startsWith("/area-membros")
    || path.startsWith("/membro/")
    || path.startsWith("/comunidade")
    || path.startsWith("/movimentacao-cotas")
    || path.startsWith("/notificacoes")
    || path.startsWith("/convites")
  ) return "alliances";
  return null;
}

export function hasEmployeeModuleAccess(
  user: AppUser | null | undefined,
  key: CompanyAccessKey,
  required: Exclude<CompanyAccessLevel, "none"> = "view",
): boolean {
  if (!user?.company_employee) return true;
  return hasCompanyAccess(user.company_permissions, key, required);
}
