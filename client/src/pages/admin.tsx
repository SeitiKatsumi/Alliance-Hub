import MembrosPage from "./membros";
import { useLocation } from "wouter";
import { BadgeDollarSign, Network, Users } from "lucide-react";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";
import { AdminCommercialPolicies } from "@/components/admin-commercial-policies";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const active = requestedTab === "estruturacao-bias" || requestedTab === "politicas" ? requestedTab : "membros";
  return (
    <div>
      <div className="mx-auto mt-5 grid max-w-6xl grid-cols-3 border-y bg-slate-50 px-4 sm:px-6">
        <button type="button" onClick={() => navigate("/admin?tab=membros")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "membros" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Users className="h-4 w-4" />Membros</button>
        <button type="button" onClick={() => navigate("/admin?tab=estruturacao-bias")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "estruturacao-bias" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Network className="h-4 w-4" />Estruturação de BIAs</button>
        <button type="button" onClick={() => navigate("/admin?tab=politicas")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "politicas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><BadgeDollarSign className="h-4 w-4" />Políticas</button>
      </div>
      {active === "estruturacao-bias" ? <BiaStructuringQueue /> : active === "politicas" ? <AdminCommercialPolicies /> : <MembrosPage />}
    </div>
  );
}
