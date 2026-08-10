import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, FileText, Lightbulb, Loader2, MapPin, Plus, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PropertyOpportunity {
  id: string;
  qualificacao: string;
  tipo?: string;
  descricao?: string;
  tese_inicial?: string;
  category: string;
  origem_tipo: string;
  visibilidade: string;
  estagio: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  valor?: string | number;
  moeda?: string;
  can_edit?: boolean;
}

const stageLabels: Record<string, string> = {
  identificada: "Identificada",
  em_analise: "Em análise",
  complementos_solicitados: "Complementos solicitados",
  pre_viabilidade_aprovada: "Pré-viabilidade aprovada",
  estruturacao_solicitada: "Estruturação solicitada",
  bia_em_formacao: "BIA em formação",
  convertida_bia: "Convertida em BIA",
  rejeitada: "Rejeitada",
  arquivada: "Arquivada",
};

const initialForm = {
  category: "land-bank",
  origem_tipo: "oportunidade_externa",
  qualificacao: "",
  tipo: "",
  area: "",
  valor: "",
  moeda: "BRL",
  origem_contato: "",
  quem_esta_vendendo: "",
  situacao_negociacao: "",
  tese_inicial: "",
  finalidade: "ainda_nao_sei",
  urgencia: "normal",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  autorizacao_compartilhamento: false,
  publicar: false,
};

function money(value?: string | number, currency = "BRL") {
  const amount = Number(String(value || "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return "Valor em análise";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export function OportunidadesImobiliariasPanel({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const opportunitiesQuery = useQuery<PropertyOpportunity[]>({
    queryKey: ["/api/land-bank-assets", "mine"],
    queryFn: async () => (await apiRequest("GET", "/api/land-bank-assets?mine=1")).json(),
  });
  const opportunities = (opportunitiesQuery.data || []).filter((item) => [item.qualificacao, item.tipo, item.cidade, item.estado].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Lightbulb className="h-6 w-6 text-amber-500" />Oportunidades</h1><p className="mt-1 text-sm text-muted-foreground">Imóveis ou negócios imobiliários identificados para análise, sem incluí-los no seu patrimônio.</p></div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate("/oportunidades/nova")}><Plus className="mr-2 h-4 w-4" />Cadastrar oportunidade</Button>
      </div>
      {!embedded && (
        <div className="grid gap-3 border-y py-4 sm:grid-cols-2">
          <button type="button" onClick={() => navigate("/?tab=carteira&view=imoveis")} className="flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"><Building2 className="h-5 w-5 text-blue-600" /><span><strong className="block text-sm">Meus Imóveis</strong><span className="text-xs text-muted-foreground">Patrimônio que já pertence a você</span></span></button>
          <button type="button" className="flex items-center gap-3 border-l px-3 py-2 text-left"><Lightbulb className="h-5 w-5 text-amber-500" /><span><strong className="block text-sm">Oportunidades externas</strong><span className="text-xs text-muted-foreground">Ativos que você identificou ou recebeu autorização para analisar</span></span></button>
        </div>
      )}
      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar oportunidade..." /></div>
      {opportunitiesQuery.isLoading ? <div className="flex min-h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div> : opportunities.length === 0 ? (
        <div className="border-y py-16 text-center"><Lightbulb className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma oportunidade cadastrada</p><p className="mt-1 text-sm text-muted-foreground">Cadastre um imóvel externo ou explore o potencial de um imóvel da sua carteira.</p><Button className="mt-5" onClick={() => navigate("/oportunidades/nova")}><Plus className="mr-2 h-4 w-4" />Cadastrar oportunidade</Button></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{opportunities.map((item) => <Card key={item.id} className="rounded-md"><CardContent className="p-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.category === "land-bank" ? "Land Bank" : "Ativo Edificado"}</Badge><Badge variant="outline">{stageLabels[item.estagio] || item.estagio}</Badge></div><h2 className="mt-4 text-lg font-semibold">{item.qualificacao}</h2><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.tese_inicial || item.descricao || "Tese inicial ainda não informada."}</p><div className="mt-4 border-t pt-4 text-sm"><p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" />{[item.cidade, item.estado, item.pais].filter(Boolean).join(" / ") || "Localização em análise"}</p><p className="mt-2 font-medium">{money(item.valor, item.moeda)}</p></div><Button variant="outline" className="mt-4 w-full" onClick={() => navigate(`/oportunidades/${item.id}`)}>Acompanhar oportunidade</Button></CardContent></Card>)}</div>
      )}
    </div>
  );
}

export function OportunidadesImobiliariasPage() {
  return <OportunidadesImobiliariasPanel />;
}

export function NovaOportunidadeImobiliariaPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [document, setDocument] = useState<File | null>(null);
  const setField = (field: keyof typeof initialForm, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const createMutation = useMutation({
    mutationFn: async () => {
      let documentos: Array<{ file_id: string; nome: string }> = [];
      if (document) {
        const body = new FormData();
        body.append("files", document);
        const response = await fetch("/api/upload", { method: "POST", credentials: "include", body });
        const upload = await response.json().catch(() => ({}));
        if (!response.ok || !upload.fileIds?.[0]) throw new Error(upload.error || "Não foi possível enviar o documento.");
        documentos = [{ file_id: upload.fileIds[0], nome: document.name }];
      }
      const response = await apiRequest("POST", "/api/land-bank-assets", {
        ...form,
        area_m2: form.area,
        descricao: form.tese_inicial,
        documentos,
        visibilidade: form.publicar ? "publicada" : "privada",
      });
      return response.json();
    },
    onSuccess: (data: PropertyOpportunity) => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      toast({ title: "Oportunidade cadastrada" });
      navigate(`/oportunidades/${data.id}`);
    },
    onError: (error: any) => toast({ title: "Erro ao cadastrar oportunidade", description: error?.message, variant: "destructive" }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-0" onClick={() => navigate("/oportunidades")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Oportunidades</Button>
      <div><h1 className="text-2xl font-bold">Cadastrar oportunidade imobiliária</h1><p className="mt-1 text-sm text-muted-foreground">Registre informações preliminares. A oportunidade não será incluída em Meu Patrimônio.</p></div>
      <section className="space-y-5 border-y py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Origem da oportunidade *</Label><Select value={form.origem_tipo} onValueChange={(value) => setField("origem_tipo", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oportunidade_externa">Oportunidade externa</SelectItem><SelectItem value="terceiro_autorizado">Ativo de terceiro autorizado</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Natureza física *</Label><Select value={form.category} onValueChange={(value) => setField("category", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="land-bank">Terreno, lote, gleba ou área</SelectItem><SelectItem value="built-asset-bank">Ativo edificado</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 sm:col-span-2"><Label>Nome da oportunidade *</Label><Input value={form.qualificacao} onChange={(event) => setField("qualificacao", event.target.value)} placeholder="Ex.: Edifício comercial no Centro" /></div>
          <div className="space-y-2"><Label>Tipo do imóvel</Label><Input value={form.tipo} onChange={(event) => setField("tipo", event.target.value)} placeholder="Prédio, terreno, galpão..." /></div>
          <div className="space-y-2"><Label>Área aproximada (m²)</Label><Input inputMode="decimal" value={form.area} onChange={(event) => setField("area", event.target.value)} /></div>
          <div className="space-y-2"><Label>Preço pedido</Label><Input inputMode="decimal" value={form.valor} onChange={(event) => setField("valor", event.target.value)} /></div>
          <div className="space-y-2"><Label>Moeda</Label><Select value={form.moeda} onValueChange={(value) => setField("moeda", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BRL">BRL</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Origem do contato</Label><Input value={form.origem_contato} onChange={(event) => setField("origem_contato", event.target.value)} placeholder="Corretor, proprietário, anúncio..." /></div>
          <div className="space-y-2"><Label>Quem está vendendo</Label><Input value={form.quem_esta_vendendo} onChange={(event) => setField("quem_esta_vendendo", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Situação da negociação</Label><Input value={form.situacao_negociacao} onChange={(event) => setField("situacao_negociacao", event.target.value)} placeholder="Sem contato, contato iniciado, proposta em análise..." /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Por que você acredita que é uma oportunidade? *</Label><Textarea rows={4} value={form.tese_inicial} onChange={(event) => setField("tese_inicial", event.target.value)} placeholder="Descreva a tese econômica inicial e o potencial percebido." /></div>
          <div className="space-y-2"><Label>Finalidade imaginada</Label><Select value={form.finalidade} onValueChange={(value) => setField("finalidade", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comprar">Comprar</SelectItem><SelectItem value="desenvolver_parceria">Desenvolver em parceria</SelectItem><SelectItem value="retrofit">Reformar ou retrofit</SelectItem><SelectItem value="construir">Construir</SelectItem><SelectItem value="renda">Operar para renda</SelectItem><SelectItem value="revender">Revender</SelectItem><SelectItem value="ainda_nao_sei">Ainda não sei</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Urgência</Label><Select value={form.urgencia} onValueChange={(value) => setField("urgencia", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
        </div>
      </section>
      <section className="space-y-4"><h2 className="font-semibold">Localização</h2><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>CEP</Label><Input value={form.cep} onChange={(event) => setField("cep", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(event) => setField("endereco", event.target.value)} /></div><div className="space-y-2"><Label>Bairro</Label><Input value={form.bairro} onChange={(event) => setField("bairro", event.target.value)} /></div><div className="space-y-2"><Label>Cidade *</Label><Input value={form.cidade} onChange={(event) => setField("cidade", event.target.value)} /></div><div className="space-y-2"><Label>Estado *</Label><Input value={form.estado} onChange={(event) => setField("estado", event.target.value)} /></div></div></section>
      <section className="space-y-4 border-y py-5"><label className="flex cursor-pointer items-center gap-3"><Button type="button" variant="outline" asChild><span><Upload className="mr-2 h-4 w-4" />Documento disponível</span></Button><input className="hidden" type="file" onChange={(event) => setDocument(event.target.files?.[0] || null)} />{document && <span className="flex items-center gap-1 text-sm text-muted-foreground"><FileText className="h-4 w-4" />{document.name}</span>}</label><label className="flex cursor-pointer items-start gap-3"><Checkbox checked={form.autorizacao_compartilhamento} onCheckedChange={(checked) => setField("autorizacao_compartilhamento", checked === true)} /><span className="text-sm leading-relaxed"><strong>Autorizo a análise e o compartilhamento desta oportunidade.</strong><br /><span className="text-muted-foreground">Os dados privados permanecem protegidos e serão liberados somente aos membros selecionados.</span></span></label><label className="flex cursor-pointer items-start gap-3"><Checkbox checked={form.publicar} onCheckedChange={(checked) => setField("publicar", checked === true)} disabled={!form.autorizacao_compartilhamento} /><span className="text-sm">Publicar o resumo no Banco de Ativos para receber manifestações de interesse.</span></label></section>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate("/oportunidades")}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!form.qualificacao.trim() || !form.tese_inicial.trim() || !form.cidade.trim() || !form.estado.trim() || !form.autorizacao_compartilhamento || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cadastrar oportunidade</Button></div>
    </div>
  );
}

export default OportunidadesImobiliariasPage;
