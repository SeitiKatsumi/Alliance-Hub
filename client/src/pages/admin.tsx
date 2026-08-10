import MembrosPage from "./membros";
import { useLocation } from "wouter";
import { Network, Users } from "lucide-react";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const active = new URLSearchParams(window.location.search).get("tab") === "estruturacao-bias" ? "estruturacao-bias" : "membros";
  return (
    <div>
      <div className="mx-auto mt-5 grid max-w-6xl grid-cols-2 border-y bg-slate-50 px-4 sm:px-6">
        <button type="button" onClick={() => navigate("/admin?tab=membros")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "membros" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Users className="h-4 w-4" />Membros</button>
        <button type="button" onClick={() => navigate("/admin?tab=estruturacao-bias")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "estruturacao-bias" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}><Network className="h-4 w-4" />Estruturação de BIAs</button>
      </div>
      {active === "estruturacao-bias" ? <BiaStructuringQueue /> : <MembrosPage />}
    </div>
  );
}
