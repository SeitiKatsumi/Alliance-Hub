import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Mail } from "lucide-react";
import builtLogo from "@assets/Logo_BUILT_3_Horizontal_Negativo_1776817526930.png";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function AguardandoAprovacaoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/logout", {});
      queryClient.setQueryData(["/api/me"], null);
      queryClient.clear();
      navigate("/");
    } catch {
      toast({ title: "Erro ao sair", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-full max-w-md px-4 flex flex-col items-center">
        <img src={builtLogo} alt="BUILT Alliances" className="w-52 mb-10" />

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#D7BB7D]/10 border border-[#D7BB7D]/30 flex items-center justify-center">
            <Clock className="w-8 h-8 text-[#D7BB7D]" />
          </div>

          <div>
            <h1 className="text-white text-xl font-semibold mb-2">Aguardando aprovação</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Olá, <span className="text-[#D7BB7D]">{user?.nome || "membro"}</span>! Seu cadastro foi recebido com sucesso.
            </p>
            <p className="text-white/50 text-sm leading-relaxed mt-2">
              O Aliado BUILT da sua comunidade irá revisar seu perfil em breve. Você receberá um e-mail quando o acesso for liberado.
            </p>
          </div>

          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3 text-left">
            <Mail className="w-5 h-5 text-[#D7BB7D] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/70 text-sm font-medium">E-mail de contato</p>
              <p className="text-white/40 text-xs mt-0.5">{user?.email || "—"}</p>
              <p className="text-white/40 text-xs mt-1">Fique atento à sua caixa de entrada.</p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="text-white/40 hover:text-white/70 text-sm gap-2"
            onClick={handleLogout}
            data-testid="button-logout-pending"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </Button>
        </div>

        <p className="text-white/20 text-xs mt-6">
          &copy; {new Date().getFullYear()} BUILT Alliances. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
