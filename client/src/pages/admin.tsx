import MembrosPage from "./membros";
import { Link, useSearch } from "wouter";
import { BadgeDollarSign, Landmark, Network, Users } from "lucide-react";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";
import { AdminCommercialPolicies } from "@/components/admin-commercial-policies";
import { AdminAsaas } from "@/components/asaas-status";
import { useAuth } from "@/hooks/use-auth";
import { canReadAsaasAdmin } from "@shared/asaas";

const sections = [
  { id: "membros", label: "Membros", icon: Users },
  { id: "estruturacao-bias", label: "Estruturação de BIAs", icon: Network },
  { id: "politicas", label: "Políticas", icon: BadgeDollarSign },
  { id: "asaas", label: "Asaas", icon: Landmark },
] as const;

export default function AdminPage() {
  const { user } = useAuth();
  const canReadAsaas = canReadAsaasAdmin(user ? { id: user.id, role: user.role, employee: !!user.company_employee } : null);
  const requestedTab = new URLSearchParams(useSearch()).get("tab");
  const active = requestedTab === "asaas" || requestedTab === "estruturacao-bias" || requestedTab === "politicas" ? requestedTab : "membros";
  return (
    <div>
      <nav aria-label="Seções da administração" className={`mx-4 my-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 sm:mx-6 ${canReadAsaas ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {sections.filter(section => section.id !== "asaas" || canReadAsaas).map(({ id, label, icon: Icon }) => (
          <Link key={id} href={`/admin?tab=${id}`} aria-current={active === id ? "page" : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-2 py-2 text-center text-sm leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!canReadAsaas && id === "politicas" ? "col-span-2 sm:col-span-1" : ""} ${active === id ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0">{label}</span>
          </Link>
        ))}
      </nav>
      {active === "asaas" ? canReadAsaas ? <AdminAsaas /> : <p className="p-6" role="alert">Área exclusiva para administradores.</p> : active === "estruturacao-bias" ? <BiaStructuringQueue /> : active === "politicas" ? <AdminCommercialPolicies /> : <MembrosPage />}
    </div>
  );
}
