import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Sparkles, LayoutDashboard, Calculator, Wallet, Target, ChevronDown, Landmark, BarChart3, Users, UserCircle, BookOpen, Wrench, HardHat, TrendingUp, Shield, Globe2, Store, Network, Coins } from "lucide-react";
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
import builtLogo from "@assets/Built_Alliances_Platform_Negativo_1775603722664.png";

export function AppSidebar() {
  const [location] = useLocation();
  const isBiasSection = location === "/bias" || location === "/fluxo-caixa" || location === "/bias-calculadora" || location === "/resultados" || location === "/nucleo-tecnico" || location === "/nucleo-obra" || location === "/nucleo-comercial" || location === "/nucleo-capital" || location === "/diretoria-alianca";
  const isRedeBuiltSection = location === "/vitrine" || location === "/area-membros" || location === "/built-capital";
  const [biasOpen, setBiasOpen] = useState(isBiasSection);
  const [diretoriaOpen, setDiretoriaOpen] = useState(location === "/diretoria-alianca");
  const [nucleoCapitalOpen, setNucleoCapitalOpen] = useState(location === "/nucleo-capital" || location === "/fluxo-caixa" || location === "/resultados");
  const [redeBuiltOpen, setRedeBuiltOpen] = useState(isRedeBuiltSection);

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

              {/* Rede Built — colapsável */}
              <Collapsible open={redeBuiltOpen} onOpenChange={setRedeBuiltOpen}>
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      className="flex-1 text-sm cursor-pointer"
                      isActive={isRedeBuiltSection}
                      data-testid="nav-rede-built"
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      <span>Rede Built</span>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" data-testid="toggle-rede-built-menu">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${redeBuiltOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/vitrine"} className="text-xs" data-testid="nav-vitrine">
                          <Link href="/vitrine">
                            <Store className="w-3 h-3" />
                            <span>Vitrine</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/area-membros"} className="text-xs" data-testid="nav-area-membros">
                          <Link href="/area-membros">
                            <Network className="w-3 h-3" />
                            <span>Área de Membros</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/built-capital"} className="text-xs" data-testid="nav-built-capital">
                          <Link href="/built-capital">
                            <Coins className="w-3 h-3" />
                            <span>Built Capital</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

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
                      {/* Diretoria da Aliança */}
                      <SidebarMenuSubItem>
                        <Collapsible open={diretoriaOpen} onOpenChange={setDiretoriaOpen}>
                          <div className="flex items-center w-full">
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === "/diretoria-alianca"}
                              className="flex-1 text-xs"
                              data-testid="nav-diretoria-alianca"
                            >
                              <Link href="/diretoria-alianca">
                                <Shield className="w-3 h-3" />
                                <span>Diretoria da Aliança</span>
                              </Link>
                            </SidebarMenuSubButton>
                            <CollapsibleTrigger asChild>
                              <button className="p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors mr-1" data-testid="toggle-diretoria-menu">
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${diretoriaOpen ? "rotate-180" : ""}`} />
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="pl-3">
                              <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton className="text-xs text-sidebar-foreground/40 cursor-not-allowed" data-testid="nav-diretoria-placeholder">
                                    <span className="italic">Em desenvolvimento</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </SidebarMenuSub>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      {/* Núcleo Técnico */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location === "/nucleo-tecnico"}
                          className="text-xs"
                          data-testid="nav-nucleo-tecnico"
                        >
                          <Link href="/nucleo-tecnico">
                            <Wrench className="w-3 h-3" />
                            <span>Núcleo Técnico</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Núcleo de Obra */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location === "/nucleo-obra"}
                          className="text-xs"
                          data-testid="nav-nucleo-obra"
                        >
                          <Link href="/nucleo-obra">
                            <HardHat className="w-3 h-3" />
                            <span>Núcleo de Obra</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Núcleo Comercial */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location === "/nucleo-comercial"}
                          className="text-xs"
                          data-testid="nav-nucleo-comercial"
                        >
                          <Link href="/nucleo-comercial">
                            <TrendingUp className="w-3 h-3" />
                            <span>Núcleo Comercial</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Núcleo de Capital */}
                      <SidebarMenuSubItem>
                        <Collapsible open={nucleoCapitalOpen} onOpenChange={setNucleoCapitalOpen}>
                          <div className="flex items-center w-full">
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === "/nucleo-capital"}
                              className="flex-1 text-xs"
                              data-testid="nav-nucleo-capital"
                            >
                              <Link href="/nucleo-capital">
                                <Landmark className="w-3 h-3" />
                                <span>Núcleo de Capital</span>
                              </Link>
                            </SidebarMenuSubButton>
                            <CollapsibleTrigger asChild>
                              <button className="p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors mr-1" data-testid="toggle-nucleo-capital-menu">
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${nucleoCapitalOpen ? "rotate-180" : ""}`} />
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

                      {/* Calculadora DM */}
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

              {/* Cadastro Geral */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/membros"} data-testid="nav-membros" className="text-sm">
                  <Link href="/membros">
                    <Users className="w-3.5 h-3.5" />
                    <span>Cadastro Geral</span>
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
        <div className="text-[11px] text-sidebar-foreground/60 text-center">BUILT Alliances Platform</div>
      </SidebarFooter>
    </Sidebar>
  );
}
