import MembrosPage from "./membros";
import { useLocation, useSearch } from "wouter";
import { BadgeDollarSign, Network, Users } from "lucide-react";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";
import { AdminCommercialPolicies } from "@/components/admin-commercial-policies";
import { AdminPinbank } from "@/components/admin-pinbank";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canHomologate = !!user && !user.company_employee && ["admin", "superadmin"].includes(user.role);
  const requestedTab = new URLSearchParams(useSearch()).get("tab");
  const active = requestedTab === "pinbank" || requestedTab === "estruturacao-bias" || requestedTab === "politicas" ? requestedTab : "membros";
  return (
    <div>
      <div className="mx-auto mt-5 grid max-w-6xl grid-cols-2 border-y bg-slate-50 px-4 sm:grid-cols-4 sm:px-6">
        <button type="button" onClick={() => navigate("/admin?tab=membros")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "membros" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Users className="h-4 w-4" />Membros</button>
        <button type="button" onClick={() => navigate("/admin?tab=estruturacao-bias")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "estruturacao-bias" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Network className="h-4 w-4" />Estruturação de BIAs</button>
        <button type="button" onClick={() => navigate("/admin?tab=politicas")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "politicas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><BadgeDollarSign className="h-4 w-4" />Políticas</button>
        {canHomologate && <button type="button" onClick={() => navigate("/admin?tab=pinbank")} className={`h-12 text-sm ${active === "pinbank" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}>Pinbank — DEV</button>}
      </div>
      {active === "pinbank" ? canHomologate ? <AdminPinbank /> : <p className="p-6">Área exclusiva para administradores.</p> : active === "estruturacao-bias" ? <BiaStructuringQueue /> : active === "politicas" ? <AdminCommercialPolicies /> : <MembrosPage />}
    </div>
  );
}
