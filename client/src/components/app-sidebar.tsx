import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Sparkles, LayoutDashboard, Calculator, Wallet, Target, ChevronDown, Landmark, BarChart3, Users, UserCircle, BookOpen, FileText } from "lucide-react";
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
import builtLogo from "@assets/Built_Alliances_Platform_Negativo_1774284078992.png";

export function AppSidebar() {
  const [location] = useLocation();
  const isBiasSection = location === "/bias" || location === "/fluxo-caixa" || location === "/bias-calculadora" || location === "/resultados";
  const [biasOpen, setBiasOpen] = useState(isBiasSection);
  const [nucleoOpen, setNucleoOpen] = useState(location === "/fluxo-caixa" || location === "/resultados");

  return (
    <Sidebar>
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img src={builtLogo} alt="Built Alliances" className="h-16 w-auto max-w-[200px]" />
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

              {/* BIAs — colapsável */}
              <Collapsible open={biasOpen} onOpenChange={setBiasOpen}>
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton asChild isActive={location === "/bias"} className="flex-1 text-sm" data-testid="nav-bias">
                      <Link href="/bias">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>BIAs</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" data-testid="toggle-bias-menu">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${biasOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Núcleo de Capital — colapsável dentro de BIAs */}
                      <SidebarMenuSubItem>
                        <Collapsible open={nucleoOpen} onOpenChange={setNucleoOpen}>
                          <div className="flex items-center w-full">
                            <SidebarMenuSubButton
                              isActive={location === "/fluxo-caixa"}
                              className="flex-1 text-xs cursor-default"
                              data-testid="nav-nucleo-capital"
                            >
                              <Landmark className="w-3 h-3" />
                              <span>Núcleo de Capital</span>
                            </SidebarMenuSubButton>
                            <CollapsibleTrigger asChild>
                              <button className="p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors mr-1" data-testid="toggle-nucleo-menu">
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${nucleoOpen ? "rotate-180" : ""}`} />
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="pl-3">
                              <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={location === "/fluxo-caixa"} data-testid="nav-fluxo-caixa" className="text-xs">
                                    <Link href="/fluxo-caixa">
                                      <Wallet className="w-3 h-3" />
                                      <span>Financeiro</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={location === "/resultados"} data-testid="nav-resultados" className="text-xs">
                                    <Link href="/resultados">
                                      <BarChart3 className="w-3 h-3" />
                                      <span>Análises</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </SidebarMenuSub>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      {/* Calculadora DM — abaixo do Núcleo de Capital */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/bias-calculadora"} data-testid="nav-bias-calculadora" className="text-xs">
                          <Link href="/bias-calculadora">
                            <Calculator className="w-3 h-3" />
                            <span>Calculadora DM</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* OPAs */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/opas"} data-testid="nav-opas" className="text-sm">
                  <Link href="/opas">
                    <Target className="w-3.5 h-3.5" />
                    <span>OPAs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Membros */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/membros"} data-testid="nav-membros" className="text-sm">
                  <Link href="/membros">
                    <Users className="w-3.5 h-3.5" />
                    <span>Membros</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Aura */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/aura"} data-testid="nav-aura" className="text-sm">
                  <Link href="/aura">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aura</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Propostas */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/propostas"} data-testid="nav-propostas" className="text-sm">
                  <Link href="/propostas">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Propostas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Meu Perfil */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/meu-perfil"} data-testid="nav-meu-perfil" className="text-sm">
                  <Link href="/meu-perfil">
                    <UserCircle className="w-3.5 h-3.5" />
                    <span>Meu Perfil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Documentação */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/documentacao"} data-testid="nav-documentacao" className="text-sm">
                  <Link href="/documentacao">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Documentação</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="text-[11px] text-sidebar-foreground/60 text-center">Built Alliances Platform</div>
      </SidebarFooter>
    </Sidebar>
  );
}
