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
  });

  const loginMutation = useMutation({
    mutationFn: async (creds: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", creds);
      return res.json();
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
