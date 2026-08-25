import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ConviteImovelPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ nome: "", password: "", aceite_termos: false, aceite_privacidade: false });
  const invite = useQuery<any>({
    queryKey: ["/api/carteira/convites", token],
    queryFn: async () => {
      const response = await fetch(`/api/carteira/convites/${encodeURIComponent(token)}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Convite indisponível.");
      return data;
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/carteira/convites/${encodeURIComponent(token)}/aceitar`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível confirmar.");
      return data;
    },
    onSuccess: (data) => navigate(data.redirect_url || "/?tab=carteira"),
    onError: (error: any) => toast({ title: "Não foi possível confirmar", description: error.message, variant: "destructive" }),
  });
  const reject = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/carteira/convites/${encodeURIComponent(token)}/recusar`, { method: "POST", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível recusar.");
      return data;
    },
    onSuccess: () => { toast({ title: "Convite recusado" }); navigate("/login"); },
    onError: (error: any) => toast({ title: "Não foi possível recusar", description: error.message, variant: "destructive" }),
  });

  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <Card className="mx-auto max-w-lg"><CardContent className="space-y-5 p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Building2 className="h-6 w-6" /></div>
      <div><h1 className="text-2xl font-bold text-slate-900">Confirme sua participação no imóvel</h1><p className="mt-2 text-sm text-slate-600">Este convite é individual, expira e pode ser usado uma única vez.</p></div>
      {invite.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}
      {invite.error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(invite.error as Error).message}</p>}
      {invite.data && <>
        <div className="rounded-md border bg-white p-4"><p className="font-semibold">{invite.data.imovel_nome}</p><p className="mt-1 text-sm text-slate-600">{invite.data.nome} · {Number(invite.data.map_percentual).toLocaleString("pt-BR")}% do MAP</p></div>
        {!invite.data.conta_existente && <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder={invite.data.nome} /></div>}
        <div className="space-y-2"><Label>{invite.data.conta_existente ? "Senha da sua conta BUILT" : "Crie uma senha"}</Label><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
        {!invite.data.conta_existente && <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={form.aceite_termos} onCheckedChange={(checked) => setForm({ ...form, aceite_termos: checked === true })} /><span>Li e aceito os termos básicos de uso da conta limitada.</span></label>
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={form.aceite_privacidade} onCheckedChange={(checked) => setForm({ ...form, aceite_privacidade: checked === true })} /><span>Li e aceito a política de privacidade.</span></label>
        </div>}
        <p className="text-xs leading-relaxed text-slate-500">A participação registrada é uma declaração econômica dos usuários e não substitui escritura, matrícula ou outro documento de titularidade.</p>
        <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" disabled={accept.isPending || reject.isPending} onClick={() => window.confirm("Recusar este convite de copropriedade?") && reject.mutate()}>{reject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}Recusar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={accept.isPending || reject.isPending || form.password.length < 4 || (!invite.data.conta_existente && (!form.aceite_termos || !form.aceite_privacidade))} onClick={() => accept.mutate()}>{accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar participação</Button></div>
      </>}
    </CardContent></Card>
  </main>;
}
