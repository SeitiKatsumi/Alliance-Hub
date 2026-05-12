import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, Sparkles, LayoutDashboard, Calculator, Wallet, Target, ChevronDown, Landmark, BarChart3, Users, UserCircle, Wrench, HardHat, TrendingUp, Shield, Globe2, Store, Network, Coins, MessageCircle, ClipboardList, Ticket } from "lucide-react";
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
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_Nova.png";

export function AppSidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isSuperAdmin = user?.role === "admin";
  const [location] = useLocation();

  // Seal-based permissions (stored in Outras_redes_as_quais_pertenco)
  const redes = user?.Outras_redes_as_quais_pertenco ?? [];
  const hasSeal = isAdmin || redes.some(r => r.startsWith("BUILT_"));
  const hasProudMemberSeal = isAdmin || redes.includes("BUILT_PROUD_MEMBER") || redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER");
  const hasBuiltCapitalPartnerSeal = isAdmin || redes.includes("BUILT_CAPITAL_PARTNER") || redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER");

  const isBiasSection = location === "/gestao-bias" || location === "/gestao-opas" || location === "/fluxo-caixa" || location === "/bias-calculadora" || location === "/resultados" || location === "/nucleo-tecnico" || location === "/nucleo-obra" || location === "/nucleo-comercial" || location === "/nucleo-capital" || location === "/diretoria-alianca";
  const isRedeBuiltSection = location === "/area-aliancas" || location === "/area-membros" || location === "/comunidade" || location === "/bias";
  const [biasOpen, setBiasOpen] = useState(isBiasSection);
  const [diretoriaOpen, setDiretoriaOpen] = useState(location === "/diretoria-alianca");
  const [nucleoCapitalOpen, setNucleoCapitalOpen] = useState(location === "/nucleo-capital" || location === "/fluxo-caixa" || location === "/resultados");
  const [redeBuiltOpen, setRedeBuiltOpen] = useState(isRedeBuiltSection);

  return (
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

              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} data-testid="nav-dashboard" className="text-sm">
                  <Link href="/">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/vitrine"} className="text-sm" data-testid="nav-vitrine">
                  <Link href="/vitrine">
                    <Store className="w-3.5 h-3.5" />
                    <span>BUILT Vitrine</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* OPAs — sempre visível */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/opas"} data-testid="nav-opas" className="text-sm">
                  <Link href="/opas">
                    <Target className="w-3.5 h-3.5" />
                    <span>OPAs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {hasSeal && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/area-aliancas"} className="text-sm" data-testid="nav-area-aliancas">
                    <Link href="/area-aliancas">
                      <Globe2 className="w-3.5 h-3.5" />
                      <span>Área de Alianças</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasSeal && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/built-capital"} className="text-sm" data-testid="nav-built-capital">
                    <Link href="/built-capital">
                      <Coins className="w-3.5 h-3.5" />
                      <span>BUILT Capital</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Gestão de BIAs */}
              {hasSeal && (
                <Collapsible open={biasOpen} onOpenChange={setBiasOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isBiasSection} className="text-sm" data-testid="nav-gestao-bias">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Gestão de BIAs</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${biasOpen ? "rotate-180" : ""}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/diretoria-alianca"} className="text-sm" data-testid="nav-diretoria-alianca">
                          <Link href="/diretoria-alianca">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Diretoria da Aliança</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/gestao-opas"} className="text-sm" data-testid="nav-gestao-opas">
                          <Link href="/gestao-opas">
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Gestão OPAs</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/nucleo-tecnico"} className="text-sm" data-testid="nav-nucleo-tecnico">
                          <Link href="/nucleo-tecnico">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Núcleo Técnico</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/nucleo-obra"} className="text-sm" data-testid="nav-nucleo-obra">
                          <Link href="/nucleo-obra">
                            <HardHat className="w-3.5 h-3.5" />
                            <span>Núcleo de Obra</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/nucleo-comercial"} className="text-sm" data-testid="nav-nucleo-comercial">
                          <Link href="/nucleo-comercial">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Núcleo Comercial</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location === "/nucleo-capital" || location === "/fluxo-caixa" || location === "/resultados" || location === "/bias-calculadora"}
                          className="text-sm"
                          data-testid="nav-nucleo-capital"
                        >
                          <Link href="/nucleo-capital">
                            <Landmark className="w-3.5 h-3.5" />
                            <span>Núcleo de Capital</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Cadastro Geral — Super Admin only */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/membros"} data-testid="nav-membros" className="text-sm">
                    <Link href="/membros">
                      <Users className="w-3.5 h-3.5" />
                      <span>Cadastro Geral</span>
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
  );
}
