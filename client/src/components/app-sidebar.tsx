import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Target, Sparkles, Settings, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import builtLogo from "@assets/BUILT_Filosofia_selo_1769510016026.png";

const menuItems = [
  {
    title: "Meu Painel",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "BIAS - Projetos",
    url: "/bias",
    icon: Briefcase,
  },
  {
    title: "Oportunidades",
    url: "/oportunidades",
    icon: Target,
  },
  {
    title: "Membros",
    url: "/membros",
    icon: Users,
  },
  {
    title: "AURA Built",
    url: "/aura",
    icon: Sparkles,
  },
  {
    title: "Administração",
    url: "/admin",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img 
            src={builtLogo} 
            alt="Built Alliances" 
            className="h-14 w-auto"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "home"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
