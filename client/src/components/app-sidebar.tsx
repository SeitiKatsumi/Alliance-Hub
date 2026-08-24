import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Users, UserCircle, Briefcase, Gem, BellRing } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { EnvironmentAccessDialog, environmentAccessFor, type EnvironmentTarget } from "@/components/environment-access";
import { hasEmployeeModuleAccess } from "@/lib/company-access";
import { AGENDA_ALERTS_REFRESH_MS, agendaAlertBadgeLabel } from "@/lib/agenda-alerts";
import builtLogo from "@assets/Logo_Built_3_Horizontal_Negativo.png";

const MEMBER_PORTFOLIO_V2_ENABLED = import.meta.env.VITE_MEMBER_PORTFOLIO_V2_ENABLED !== "false";

export function AppSidebar() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "admin";
  const [location, navigate] = useLocation();
  const [blockedAccess, setBlockedAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);
  const canInicio = hasEmployeeModuleAccess(user, "inicio");
  const canVitrine = hasEmployeeModuleAccess(user, "vitrine") && environmentAccessFor(user, "vitrine").canAccess;
  const canAlliances = hasEmployeeModuleAccess(user, "alliances");
  const canCapital = !MEMBER_PORTFOLIO_V2_ENABLED && hasEmployeeModuleAccess(user, "capital");
  const { data: alertCount } = useQuery<{ pendencias_ativas: number; display: number | "99+" | null }>({
    queryKey: ["/api/agenda-alertas/contador"],
    queryFn: async () => {
      const response = await fetch("/api/agenda-alertas/contador", { credentials: "include", cache: "no-store" });
      if (!response.ok) return { pendencias_ativas: 0, display: null };
      return response.json();
    },
    refetchInterval: AGENDA_ALERTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const alertBadge = agendaAlertBadgeLabel(alertCount?.pendencias_ativas);

  function handleEnvironmentClick(target: EnvironmentTarget, href: string) {
    const access = environmentAccessFor(user, target);
    if (!access.canAccess) {
      setBlockedAccess(access);
      return;
    }
    navigate(href);
  }

  return (
    <>
    <Sidebar>
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img src={builtLogo} alt="Built Alliances" className="h-16 w-auto max-w-[210px] object-contain" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>

              {/* Inicio */}
              {canInicio && <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} data-testid="nav-dashboard" className="text-sm">
                  <Link href="/">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Início</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/agenda-alertas") || location === "/agenda" || location === "/notificacoes"} data-testid="nav-agenda-alertas" className="text-sm">
                  <Link href="/agenda-alertas?view=resumo">
                    <BellRing className="w-3.5 h-3.5" />
                    <span className="truncate">Agenda e Alertas</span>
                    {alertBadge && (
                      <span
                        className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                        data-testid="agenda-alertas-badge"
                        aria-label={`${alertCount?.pendencias_ativas} pendências ativas`}
                      >
                        {alertBadge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {canVitrine && <SidebarMenuItem>
                <SidebarMenuButton isActive={location.startsWith("/vitrine")} className="text-sm" data-testid="nav-vitrine" onClick={() => handleEnvironmentClick("vitrine", "/vitrine")}>
                  <Gem className="w-3.5 h-3.5" />
                  <span>{MEMBER_PORTFOLIO_V2_ENABLED ? "Área de Vitrine" : "BUILT Vitrine"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>}

              {canAlliances && <SidebarMenuItem>
                <SidebarMenuButton isActive={location === "/area-aliancas" || location.startsWith("/opas")} className="text-sm" data-testid="nav-area-aliancas" onClick={() => handleEnvironmentClick("alliances", MEMBER_PORTFOLIO_V2_ENABLED ? "/area-aliancas?tab=bias" : "/area-aliancas?tab=opas")}>
                  <Users className="w-3.5 h-3.5" />
                  <span>{MEMBER_PORTFOLIO_V2_ENABLED ? "Área de Alianças" : "BUILT Alliances"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>}

              {canCapital && <SidebarMenuItem>
                <SidebarMenuButton isActive={location === "/built-capital"} className="text-sm" data-testid="nav-built-capital" onClick={() => handleEnvironmentClick("capital", "/built-capital")}>
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>BUILT Capital</span>
                </SidebarMenuButton>
              </SidebarMenuItem>}

              {/* Administração — Super Admin only */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin" || location === "/membros"} data-testid="nav-membros" className="text-sm">
                    <Link href="/admin">
                      <Users className="w-3.5 h-3.5" />
                      <span>Administração</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Meu Perfil — sempre visível */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/meu-perfil"} data-testid="nav-meu-perfil" className="text-sm">
                  <Link href="/meu-perfil">
                    <UserCircle className="w-3.5 h-3.5" />
                    <span>Meu Perfil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>


            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="text-[11px] text-sidebar-foreground/60 text-center">BUILT Alliances Platform</div>
      </SidebarFooter>
    </Sidebar>
    <EnvironmentAccessDialog
      access={blockedAccess}
      open={!!blockedAccess}
      onOpenChange={(open) => !open && setBlockedAccess(null)}
    />
    </>
  );
}
