import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface AppUser {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  membro_directus_id: string | null;
  role: string;
  permissions: Record<string, string>;
  ativo: boolean;
  tipos_alianca?: string[];
  account_purposes?: string[];
  account_objectives?: Record<string, string[]>;
  Outras_redes_as_quais_pertenco?: string[];
  na_vitrine?: boolean | null;
  em_membros_built?: boolean | null;
  em_built_capital?: boolean | null;
  has_alliance_participation?: boolean;
  membership?: {
    condition: "registered" | "member";
    active: boolean;
    status: string | null;
    starts_at: string | null;
    ends_at: string | null;
    next_renewal_at?: string | null;
    billing_suspended?: boolean;
    frozen_at?: string | null;
    entitlement_source?: "company_plan" | "individual_membership" | null;
    annual_fee_brl?: number;
    communities: string[];
    requirements: { onboarding: boolean; aura: boolean; annual_fee: boolean; community: boolean };
    permissions?: Record<string, boolean>;
  };
  foto_perfil?: string | null;
  pending_vitrine?: boolean;
  onboarding_required?: boolean;
  onboarding_step?: string | null;
  onboarding_next_url?: string | null;
  convite_pendente?: { token: string; status: string } | null;
  adesao_pendente?: { token: string; status: string } | null;
  company_employee?: boolean;
  company_owner_user_id?: string | null;
  company_owner_membro_id?: string | null;
  company_owner_nome?: string | null;
  company_owner_email?: string | null;
  company_employee_role?: string | null;
  company_permissions?: Record<string, "none" | "view" | "edit"> | null;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AppUser | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      let res: Response;
      try {
        res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(creds),
        });
      } catch {
        throw new Error("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
      }
      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await res.json().catch(() => null) : null;
      if (!isJson) {
        throw new Error("Servidor de login indisponível. Verifique se a API está ativa.");
      }
      if (!res.ok) throw new Error(data.error || "Credenciais inválidas");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], null);
      queryClient.clear();
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}

