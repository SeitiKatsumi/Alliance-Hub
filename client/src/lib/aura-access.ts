import type { AppUser } from "@/hooks/use-auth";

function userRedes(user?: AppUser | null): string[] {
  return Array.isArray(user?.Outras_redes_as_quais_pertenco) ? user!.Outras_redes_as_quais_pertenco! : [];
}

export function isBuiltMemberForAura(user?: AppUser | null): boolean {
  const role = user?.role || "";
  const redes = userRedes(user);
  return (
    user?.em_membros_built === true ||
    ["membro", "aliado", "manager", "admin"].includes(role) ||
    redes.includes("BUILT_PROUD_MEMBER") ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER")
  );
}

export function isVitrineOnlyUser(user?: AppUser | null): boolean {
  return (
    user?.role === "user" &&
    user?.na_vitrine === true &&
    user?.em_membros_built !== true &&
    user?.em_built_capital !== true
  );
}
