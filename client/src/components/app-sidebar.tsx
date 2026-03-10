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

const dashboardSubItems = [
  { title: "Minhas BIAs", url: "/bias", icon: Briefcase },
  { title: "Minhas OPAs", url: "/opas", icon: Target },
  { title: "Fluxo de Caixa", url: "/fluxo-caixa", icon: Wallet },
  { title: "Minha Aura", url: "/aura", icon: Sparkles },
];

const adminSubItems = [
  { title: "Membros", url: "/membros", icon: Users },
  { title: "Calculadora DM", url: "/bias-calculadora", icon: Calculator },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isDashboardActive = location === "/" || dashboardSubItems.some(i => location === i.url);
  const isAdminActive = adminSubItems.some(i => location === i.url) || location === "/admin";

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
              <Collapsible open={dashboardOpen} onOpenChange={setDashboardOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/"}
                      className="flex-1"
                      data-testid="nav-dashboard"
                    >
                      <Link href="/">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Meu Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                        data-testid="toggle-dashboard-menu"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dashboardOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {dashboardSubItems.map((item) => (
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
