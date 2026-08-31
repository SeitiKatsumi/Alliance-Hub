import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, MapPin, Video } from "lucide-react";
import { useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface RoGuestInvitation {
  nome: string;
  confirmacao: string;
  guest_terms_accepted_at?: string | null;
  titulo: string;
  codigo: string;
  data: string;
  hora?: string | null;
  timezone: string;
  location_type: "online" | "presencial" | "hibrida";
  address?: string | null;
  link?: string | null;
  pauta?: string | null;
  community_name: string;
  strategic_cell_name?: string | null;
}

export default function RoGuestConfirmationPage() {
  const [, params] = useRoute("/ro-convite/:token");
  const token = params?.token || "";
  const [termsAccepted, setTermsAccepted] = useState(false);
  const invitation = useQuery<RoGuestInvitation>({
    queryKey: ["/api/reunioes-oportunidades/convidado", token],
    queryFn: async () => {
      const response = await fetch(`/api/reunioes-oportunidades/convidado/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível abrir o convite.");
      return payload;
    },
    enabled: Boolean(token),
  });
  const confirm = useMutation({
    mutationFn: async (confirmacao: "confirmado" | "recusado") => {
      const response = await fetch(`/api/reunioes-oportunidades/convidado/${encodeURIComponent(token)}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao, termos_aceitos: termsAccepted }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível confirmar a resposta.");
      return payload;
    },
    onSuccess: () => invitation.refetch(),
  });

  if (invitation.isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando convite...</div>;
  if (invitation.isError || !invitation.data) return <div className="grid min-h-screen place-items-center px-5 text-center text-sm text-red-700">{invitation.error?.message || "Convite não encontrado."}</div>;
  const ro = invitation.data;
  const responded = Boolean(ro.guest_terms_accepted_at);
  const formattedDate = new Date(`${ro.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><CalendarDays className="h-5 w-5" /></span><div><Badge variant="outline">RO — Reunião de Oportunidades</Badge><h1 className="mt-2 text-2xl font-bold">{ro.titulo}</h1><p className="mt-1 text-sm text-muted-foreground">{ro.community_name}{ro.strategic_cell_name ? ` · Célula ${ro.strategic_cell_name}` : " · Geral da Comunidade"}</p></div></div>
          <div className="grid gap-3 rounded-lg border bg-white p-4 text-sm sm:grid-cols-2"><p><strong>Quando</strong><br />{formattedDate}{ro.hora ? `, ${ro.hora.slice(0, 5)}` : ""}<br /><span className="text-xs text-muted-foreground">{ro.timezone}</span></p><p><strong>Formato</strong><br />{ro.location_type === "online" ? "On-line" : ro.location_type === "hibrida" ? "Híbrida" : "Presencial"}{ro.address && <span className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{ro.address}</span>}</p></div>
          {ro.pauta && <div><h2 className="font-semibold">Pauta</h2><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{ro.pauta}</p></div>}
          {responded ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Resposta registrada: {ro.confirmacao === "confirmado" ? "presença confirmada" : "não participará"}.</p>{ro.confirmacao === "confirmado" && ro.link && <Button asChild className="mt-4"><a href={ro.link} target="_blank" rel="noreferrer"><Video className="mr-2 h-4 w-4" />Abrir reunião</a></Button>}</div> : <div className="space-y-4 border-t pt-5"><label className="flex items-start gap-3 text-sm"><Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} /><span>Li e aceito os termos de participação como convidado desta RO. Entendo que esta confirmação não cria automaticamente uma conta ou vínculo de membro na BUILT.</span></label>{confirm.isError && <p className="text-sm text-red-700">{confirm.error?.message}</p>}<div className="flex flex-col gap-2 sm:flex-row"><Button disabled={!termsAccepted || confirm.isPending} onClick={() => confirm.mutate("confirmado")}>Confirmar presença</Button><Button variant="outline" disabled={!termsAccepted || confirm.isPending} onClick={() => confirm.mutate("recusado")}>Não participarei</Button></div></div>}
        </CardContent>
      </Card>
    </main>
  );
}
