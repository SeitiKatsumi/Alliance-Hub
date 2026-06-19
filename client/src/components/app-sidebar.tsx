import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, LayoutDashboard, ChevronDown, Users, UserCircle, TrendingUp, Globe2, Gem, CalendarDays } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EnvironmentAccessDialog, environmentAccessFor, type EnvironmentTarget } from "@/components/environment-access";
import builtLogo from "@assets/Logo_Built_3_Horizontal_Negativo.png";

export function AppSidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isSuperAdmin = user?.role === "admin";
  const [location, navigate] = useLocation();
  const [blockedAccess, setBlockedAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);

  // Seal-based permissions (stored in Outras_redes_as_quais_pertenco)
  const redes = user?.Outras_redes_as_quais_pertenco ?? [];
  const hasSeal = isAdmin || redes.some(r => r.startsWith("BUILT_"));

  const isAmbientesSection = location.startsWith("/vitrine") || location.startsWith("/opas") || location === "/area-aliancas" || location === "/built-capital";
  const [ambientesOpen, setAmbientesOpen] = useState(isAmbientesSection);

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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} data-testid="nav-dashboard" className="text-sm">
                  <Link href="/">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Início</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/agenda"} data-testid="nav-agenda" className="text-sm">
                  <Link href="/agenda">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Agenda</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible open={ambientesOpen} onOpenChange={setAmbientesOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isAmbientesSection} className="text-sm" data-testid="nav-ambientes-built">
                      <Globe2 className="w-3.5 h-3.5" />
                      <span>Ambientes BUILT</span>
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${ambientesOpen ? "rotate-180" : ""}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={location.startsWith("/vitrine")} className="text-sm" data-testid="nav-vitrine">
                        <button type="button" onClick={() => handleEnvironmentClick("vitrine", "/vitrine")}>
                          <Gem className="w-3.5 h-3.5" />
                          <span>BUILT Vitrine</span>
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={location === "/area-aliancas" || location.startsWith("/opas")} className="text-sm" data-testid="nav-area-aliancas">
                        <button type="button" onClick={() => handleEnvironmentClick("alliances", "/area-aliancas?tab=opas")}>
                          <Users className="w-3.5 h-3.5" />
                          <span>BUILT Alliances</span>
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={location === "/built-capital"} className="text-sm" data-testid="nav-built-capital">
                        <button type="button" onClick={() => handleEnvironmentClick("capital", "/built-capital")}>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>BUILT Capital</span>
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>

              {/* Administração — Super Admin only */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/membros"} data-testid="nav-membros" className="text-sm">
                    <Link href="/membros">
                      <Users className="w-3.5 h-3.5" />
                      <span>Administração</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Aura — requer qualquer selo */}
              {hasSeal && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/aura"} data-testid="nav-aura" className="text-sm">
                    <Link href="/aura">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Aura</span>
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
