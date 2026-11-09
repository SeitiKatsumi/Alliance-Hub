import { areaChoices } from './account-areas';
import { hasCompanyAccess } from "./company-access";
import { normalizeOnboardingPurposes } from "./initial-onboarding";

export type BuiltEnvironmentTarget = "vitrine" | "alliances" | "capital";

export type BuiltEnvironmentAccessSubject = {
  permissions?: unknown;
  role?: string | null;
  account_purposes?: unknown;
  Outras_redes_as_quais_pertenco?: unknown;
  na_vitrine?: boolean | null;
  em_membros_built?: boolean | null;
  em_built_capital?: boolean | null;
  has_alliance_participation?: boolean;
  company_employee?: boolean;
  company_permissions?: unknown;
};

export function isBuiltAlliancesMember(user: BuiltEnvironmentAccessSubject | null | undefined): boolean {
  const role = String(user?.role || "").trim().toLowerCase();
  const seals = Array.isArray(user?.Outras_redes_as_quais_pertenco) ? user.Outras_redes_as_quais_pertenco : [];
  // Developers of alliances must be able to enter before their first BIA exists.
  return ["admin", "manager", "superadmin", "aliado", "membro"].includes(role)
    || user?.em_membros_built === true
    || seals.some(seal => ["BUILT_PROUD_MEMBER", "BUILT_FOUNDING_MEMBER", "BUILT_ALLIANCE_PARTNER"].includes(String(seal)))
    || user?.has_alliance_participation === true;
}

export function canPublishVitrineProfile(user: BuiltEnvironmentAccessSubject | null | undefined): boolean {
  const role = String(user?.role || "").trim().toLowerCase();
  const choice = areaChoices(user?.permissions).publicar;
  if (choice) return choice === "permit" && role !== "coproprietario";
  return ["admin", "manager", "superadmin", "aliado", "membro"].includes(role)
    || normalizeOnboardingPurposes(user?.account_purposes).includes("profissional");
}

export function canAccessBuiltEnvironment(
  user: BuiltEnvironmentAccessSubject | null | undefined,
  target: BuiltEnvironmentTarget,
): boolean {
  if (user?.company_employee) {
    return hasCompanyAccess(user.company_permissions, target, "view");
  }

  const role = String(user?.role || "").trim().toLowerCase();
  if (target !== "capital" && role !== "coproprietario") {
    const choice = areaChoices(user?.permissions)[target];
    if (choice) return choice === "permit";
  }
  const redes = Array.isArray(user?.Outras_redes_as_quais_pertenco)
    ? user.Outras_redes_as_quais_pertenco.map(String)
    : [];
  const isAdmin = ["admin", "manager", "superadmin"].includes(role);

  if (target === "vitrine") {
    return true;
  }
  if (target === "alliances") {
    return isBuiltAlliancesMember(user);
  }
  return isAdmin
    || user?.em_built_capital === true
    || role === "investidor"
    || redes.includes("BUILT_CAPITAL_PARTNER");
}
