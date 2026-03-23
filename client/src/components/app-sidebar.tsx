import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Users, Sparkles, LayoutDashboard, Settings, Calculator, Wallet, Target, ChevronDown, Landmark } from "lucide-react";
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
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_1772135999372.png";

const nucleoSubItems = [
  { title: "Gestão Financeira", url: "/fluxo-caixa", icon: Wallet },
];

const adminSubItems = [
  { title: "Membros", url: "/membros", icon: Users },
  { title: "Calculadora DM", url: "/bias-calculadora", icon: Calculator },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [nucleoOpen, setNucleoOpen] = useState(location === "/fluxo-caixa");
  const [adminOpen, setAdminOpen] = useState(false);

  const isAdminActive = adminSubItems.some(i => location === i.url) || location === "/admin";
  const isNucleoActive = nucleoSubItems.some(i => location === i.url);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img
            src={builtLogo}
            alt="Built Alliances"
            className="h-12 w-auto max-w-[180px]"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/"}
                  data-testid="nav-dashboard"
                >
                  <Link href="/">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/bias"}
                  data-testid="nav-bias"
                >
                  <Link href="/bias">
                    <Briefcase className="w-4 h-4" />
                    <span>BIAs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/opas"}
                  data-testid="nav-opas"
                >
                  <Link href="/opas">
                    <Target className="w-4 h-4" />
                    <span>OPAs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible open={nucleoOpen} onOpenChange={setNucleoOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      isActive={isNucleoActive}
                      className="flex-1 cursor-default"
                      data-testid="nav-nucleo-capital"
                    >
                      <Landmark className="w-4 h-4" />
                      <span>Núcleo de Capital</span>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                        data-testid="toggle-nucleo-menu"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${nucleoOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {nucleoSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === item.url}
                            data-testid={`nav-${item.url.replace("/", "")}`}
                          >
                            <Link href={item.url}>
                              <item.icon className="w-3.5 h-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/aura"}
                  data-testid="nav-aura"
                >
                  <Link href="/aura">
                    <Sparkles className="w-4 h-4" />
                    <span>Aura</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible open={adminOpen} onOpenChange={setAdminOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      className="flex-1"
                      data-testid="nav-admin"
                    >
                      <Link href="/admin">
                        <Settings className="w-4 h-4" />
                        <span>Administração</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                        data-testid="toggle-admin-menu"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {adminSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === item.url}
                            data-testid={`nav-${item.url.replace("/", "")}`}
                          >
                            <Link href={item.url}>
                              <item.icon className="w-3.5 h-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60 text-center">
          Built Alliances Platform
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
