import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Building2, CheckCircle2, Clock3, HandHeart, Loader2, MapPin, Search, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EnvironmentAccessDialog, environmentAccessFor } from "@/components/environment-access";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PublicDemand {
  id: string;
  titulo: string;
  resumo_publico?: string | null;
  urgencia: string;
  especialidades?: string[];
  status: string;
  publicada_em?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  tipo_imovel?: string | null;
  total_interesses: number;
  meu_interesse?: { id: string; status: string; mensagem?: string | null } | null;
}

interface PrivateDemandData {
  escopo?: string | null;
  documentos?: Array<{ file_id?: string; nome?: string }>;
  imovel?: Record<string, any>;
  contato?: { nome?: string | null; email?: string | null; telefone?: string | null };
}

function urgencyLabel(value: string) {
  if (value === "alta") return "Alta urgência";
  if (value === "baixa") return "Baixa urgência";
  return "Urgência normal";
}

function shortDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function VitrineCatalogNav({ active }: { active: "demandas" | "obas" }) {
  const [, navigate] = useLocation();
  return (
    <div className="grid grid-cols-2 border-y bg-slate-50">
      <button type="button" onClick={() => navigate("/vitrine/demandas")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "demandas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}>
        <Target className="h-4 w-4" />Demandas
      </button>
      <button type="button" onClick={() => navigate("/vitrine/obas")} className={`flex h-12 items-center justify-center gap-2 text-sm ${active === "obas" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-muted-foreground"}`}>
        <Building2 className="h-4 w-4" />OBAs
      </button>
    </div>
  );
}

export function VitrineDemandasPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const demandsQuery = useQuery<PublicDemand[]>({
    queryKey: ["/api/vitrine/demandas", search],
    queryFn: async () => {
      const response = await fetch(`/api/vitrine/demandas${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar as demandas.");
      return response.json();
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Target className="h-6 w-6 text-blue-600" />Demandas da Vitrine</h1>
        <p className="mt-1 text-sm text-muted-foreground">Necessidades reais de proprietários que procuram membros para resolver serviços imobiliários.</p>
      </div>
      <VitrineCatalogNav active="demandas" />
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por serviço, cidade ou especialidade..." />
      </div>
      {demandsQuery.isLoading ? (
        <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : (demandsQuery.data || []).length === 0 ? (
        <div className="border-y py-16 text-center"><Target className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma demanda publicada</p><p className="mt-1 text-sm text-muted-foreground">Novas necessidades aparecerão aqui após autorização do proprietário.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(demandsQuery.data || []).map((demand) => (
            <Card key={demand.id} className="overflow-hidden rounded-md">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline">{demand.tipo_imovel || "Imóvel"}</Badge>
                  <Badge variant="outline" className={demand.urgencia === "alta" ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>{urgencyLabel(demand.urgencia)}</Badge>
                </div>
                <h2 className="mt-4 text-lg font-semibold leading-snug">{demand.titulo}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{demand.resumo_publico || "Demanda de serviço imobiliário."}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">{(demand.especialidades || []).slice(0, 3).map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div>
                <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                  <div><p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[demand.cidade, demand.estado].filter(Boolean).join(" / ") || demand.pais}</p><p className="mt-1">Publicada em {shortDate(demand.publicada_em)}</p></div>
                  <Button size="sm" onClick={() => navigate(`/vitrine/demandas/${demand.id}`)}>Ver demanda</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function VitrineDemandaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [interestOpen, setInterestOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [message, setMessage] = useState("");
  const access = environmentAccessFor(user, "alliances");
  const demandQuery = useQuery<PublicDemand>({ queryKey: ["/api/vitrine/demandas", id] });
  const selected = demandQuery.data?.meu_interesse?.status === "selecionado";
  const privateQuery = useQuery<PrivateDemandData>({
    queryKey: ["/api/vitrine/demandas", id, "dados-privados"],
    queryFn: async () => (await apiRequest("GET", `/api/vitrine/demandas/${id}/dados-privados`)).json(),
    enabled: selected,
  });
  const interestMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vitrine/demandas/${id}/interesse`, { mensagem: message || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas"] });
      setInterestOpen(false);
      setMessage("");
      toast({ title: "Interesse registrado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível registrar interesse", description: error?.message, variant: "destructive" }),
  });
  const withdrawMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/vitrine/demandas/${id}/interesse`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas"] });
      toast({ title: "Interesse retirado" });
    },
  });
  const demand = demandQuery.data;

  if (demandQuery.isLoading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (!demand) return <div className="p-8 text-center text-muted-foreground">Demanda não encontrada.</div>;

  function handleInterest() {
    if (!access.canAccess) return setMembershipOpen(true);
    setInterestOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-0" onClick={() => navigate("/vitrine/demandas")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Demandas</Button>
      <VitrineCatalogNav active="demandas" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-5">
          <section className="border-y py-6">
            <div className="flex flex-wrap gap-2"><Badge variant="outline">Demanda de serviço</Badge><Badge variant="outline">{urgencyLabel(demand.urgencia)}</Badge></div>
            <h1 className="mt-4 text-2xl font-bold">{demand.titulo}</h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">{demand.resumo_publico}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{[demand.cidade, demand.estado, demand.pais].filter(Boolean).join(" / ")}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Tipo de ajuda</h2>
            <div className="mt-3 flex flex-wrap gap-2">{(demand.especialidades || []).length ? demand.especialidades!.map((item) => <Badge key={item} variant="secondary">{item}</Badge>) : <p className="text-sm text-muted-foreground">O proprietário ainda não definiu a especialidade necessária.</p>}</div>
          </section>
          {selected && privateQuery.data && (
            <section className="border-t pt-5">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-semibold">Dados liberados após seleção</h2></div>
              <p className="mt-3 text-sm leading-relaxed">{privateQuery.data.escopo}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs uppercase text-muted-foreground">Contato</p><p className="mt-1 text-sm">{privateQuery.data.contato?.nome || "Não informado"}<br />{privateQuery.data.contato?.email}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Endereço completo</p><p className="mt-1 text-sm">{[privateQuery.data.imovel?.endereco, privateQuery.data.imovel?.numero, privateQuery.data.imovel?.bairro, privateQuery.data.imovel?.cidade].filter(Boolean).join(", ")}</p></div>
              </div>
            </section>
          )}
        </main>
        <aside className="space-y-4">
          <Card className="rounded-md"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Interesses</span><span className="flex items-center gap-1 font-semibold"><Users className="h-4 w-4" />{demand.total_interesses}</span></div><div className="mt-4">{demand.meu_interesse && demand.meu_interesse.status !== "retirado" ? <Button variant="outline" className="w-full" onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending}>Retirar interesse</Button> : <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={handleInterest}><HandHeart className="mr-2 h-4 w-4" />Manifestar interesse</Button>}</div>{demand.meu_interesse?.status === "selecionado" && <p className="mt-3 text-xs text-emerald-700">Você foi selecionado. Os dados completos estão disponíveis ao lado.</p>}</CardContent></Card>
          <div className="border-y py-4 text-sm text-muted-foreground"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Publicada em {shortDate(demand.publicada_em)}</p><p className="mt-2">Endereço, documentos e contato permanecem protegidos até a seleção.</p></div>
        </aside>
      </div>
      <Dialog open={interestOpen} onOpenChange={setInterestOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Manifestar interesse</DialogTitle><DialogDescription>Apresente brevemente como você pode contribuir para esta demanda.</DialogDescription></DialogHeader><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Conte sua experiência ou disponibilidade..." /><DialogFooter><Button variant="outline" onClick={() => setInterestOpen(false)}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => interestMutation.mutate()} disabled={interestMutation.isPending}>{interestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar interesse</Button></DialogFooter></DialogContent>
      </Dialog>
      <EnvironmentAccessDialog access={access} open={membershipOpen} onOpenChange={setMembershipOpen} />
    </div>
  );
}

export default VitrineDemandasPage;
