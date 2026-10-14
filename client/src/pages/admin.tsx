import MembrosPage from "./membros";
import { useLocation, useSearch } from "wouter";
import { BadgeDollarSign, Network, Users } from "lucide-react";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";
import { AdminCommercialPolicies } from "@/components/admin-commercial-policies";
import { AdminAsaas } from "@/components/asaas-status";
import { useAuth } from "@/hooks/use-auth";
import { canReadAsaasAdmin } from "@shared/asaas";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canReadAsaas = canReadAsaasAdmin(user ? { id: user.id, role: user.role, employee: !!user.company_employee } : null);
  const requestedTab = new URLSearchParams(useSearch()).get("tab");
  const active = requestedTab === "asaas" || requestedTab === "estruturacao-bias" || requestedTab === "politicas" ? requestedTab : "membros";
  return (
    <div>
      <div className={`mx-auto mt-5 grid max-w-6xl grid-cols-2 border-y bg-slate-50 px-4 sm:px-6 ${canReadAsaas ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <button type="button" onClick={() => navigate("/admin?tab=membros")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "membros" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Users className="h-4 w-4" />Membros</button>
        <button type="button" onClick={() => navigate("/admin?tab=estruturacao-bias")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "estruturacao-bias" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Network className="h-4 w-4" />Estruturação de BIAs</button>
        <button type="button" onClick={() => navigate("/admin?tab=politicas")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "politicas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><BadgeDollarSign className="h-4 w-4" />Políticas</button>
        {canReadAsaas && <button type="button" onClick={() => navigate("/admin?tab=asaas")} className={`flex h-12 items-center justify-center text-sm ${active === "asaas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}>Asaas</button>}
      </div>
      {active === "asaas" ? canReadAsaas ? <AdminAsaas /> : <p className="p-6" role="alert">Área exclusiva para administradores.</p> : active === "estruturacao-bias" ? <BiaStructuringQueue /> : active === "politicas" ? <AdminCommercialPolicies /> : <MembrosPage />}
    </div>
  );
}
