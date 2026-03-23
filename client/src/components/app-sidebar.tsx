import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Users, Sparkles, LayoutDashboard, Settings, Calculator, Wallet, Target, ChevronDown } from "lucide-react";
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

const adminSubItems = [
  { title: "Membros", url: "/membros", icon: Users },
  { title: "Calculadora DM", url: "/bias-calculadora", icon: Calculator },
];

const biasSubItems = [
  { title: "Financeiro", url: "/fluxo-caixa", icon: Wallet },
];

export function AppSidebar() {
  const [location] = useLocation();
  const isBiasSection = location === "/bias" || location === "/fluxo-caixa";
  const [biasOpen, setBiasOpen] = useState(isBiasSection);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img
            src={builtLogo}
            alt="Built Alliances"
            className="h-10 w-auto max-w-[160px]"
          />
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
              <Collapsible open={biasOpen} onOpenChange={setBiasOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/bias"}
                      className="flex-1 text-sm"
                      data-testid="nav-bias"
                    >
                      <Link href="/bias">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>BIAs</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                        data-testid="toggle-bias-menu"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${biasOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {biasSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === item.url}
                            data-testid={`nav-${item.url.replace("/", "")}`}
                            className="text-xs"
                          >
                            <Link href={item.url}>
                              <item.icon className="w-3 h-3" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
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

              {/* Aura */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/aura"} data-testid="nav-aura" className="text-sm">
                  <Link href="/aura">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aura</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Administração */}
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      className="flex-1 text-sm"
                      data-testid="nav-admin"
                    >
                      <Link href="/admin">
                        <Settings className="w-3.5 h-3.5" />
                        <span>Administração</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                        data-testid="toggle-admin-menu"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`} />
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
                            className="text-xs"
                          >
                            <Link href={item.url}>
                              <item.icon className="w-3 h-3" />
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

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="text-[11px] text-sidebar-foreground/60 text-center">
          Built Alliances Platform
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
