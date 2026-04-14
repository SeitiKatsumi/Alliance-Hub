import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Store, Search, MapPin, Building2,
  Users, X, Plus, Pencil, Trash2, Loader2
} from "lucide-react";

interface MembroVitrine {
  id: string;
  nome?: string;
  cargo?: string;
  especialidade?: string;
  empresa?: string;
  cidade?: string;
  estado?: string;
  whatsapp?: string;
  email?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  na_vitrine?: boolean;
}

interface CardForm {
  nome: string;
  cargo: string;
  empresa: string;
  especialidade_id: string;
  cidade: string;
  estado: string;
  whatsapp: string;
  email: string;
  perfil_aliado: string;
  nucleo_alianca: string;
}

interface EspecialidadeOption {
  id: string;
  nome_especialidade: string;
  categoria?: string;
}

function fotoUrl(m: MembroVitrine): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=200&height=200&fit=cover`;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

export default function VitrinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("all");
  const [filterEstado, setFilterEstado] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CardForm>({
    nome: "", cargo: "", empresa: "", especialidade_id: "",
    cidade: "", estado: "", whatsapp: "", email: "",
    perfil_aliado: "", nucleo_alianca: ""
  });

  const membroId = user?.membro_directus_id;

  // Fetch all vitrine members
  const { data: membros = [], isLoading } = useQuery<MembroVitrine[]>({
    queryKey: ["/api/vitrine"],
    queryFn: async () => {
      const r = await fetch("/api/vitrine");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch current user's membro data to pre-fill form and check card status
  const { data: myMembro } = useQuery<MembroVitrine & { [key: string]: any }>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  // Fetch especialidades options from Directus
  const { data: especialidadesOptions = [] } = useQuery<EspecialidadeOption[]>({
    queryKey: ["/api/especialidades"],
    queryFn: () => fetch("/api/especialidades").then(r => r.json()),
  });

  const myCardExists = !!myMembro?.na_vitrine;

  // Pre-fill form when dialog opens
  function openDialog() {
    if (myMembro) {
      // myMembro.Especialidades is the M2M junction array from Directus fields=*
      const espArr = Array.isArray(myMembro.Especialidades) ? myMembro.Especialidades : [];
      const espId = espArr[0]?.Especialidade_id ?? "";
      setForm({
        nome: myMembro.nome || "",
        cargo: myMembro.cargo || myMembro.responsavel_cargo || "",
        empresa: myMembro.empresa || myMembro.nome_fantasia || "",
        especialidade_id: typeof espId === "string" ? espId : (espId?.id ?? ""),
        cidade: myMembro.cidade || "",
        estado: myMembro.estado || "",
        whatsapp: myMembro.whatsapp || myMembro.whatsapp_e164 || "",
        email: myMembro.email || "",
        perfil_aliado: myMembro.perfil_aliado || "",
        nucleo_alianca: myMembro.nucleo_alianca || "",
      });
    }
    setDialogOpen(true);
  }

  // Save card mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<CardForm> & { na_vitrine: boolean }) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      setDialogOpen(false);
      toast({ title: myCardExists ? "Card atualizado na Vitrine!" : "Card criado na Vitrine!" });
    },
    onError: () => toast({ title: "Erro ao salvar card", variant: "destructive" }),
  });

  // Remove card mutation
  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/membros/${membroId}`, { na_vitrine: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      toast({ title: "Card removido da Vitrine." });
    },
    onError: () => toast({ title: "Erro ao remover card", variant: "destructive" }),
  });

  function handleSubmit() {
    const { especialidade_id, ...rest } = form;
    const payload: Record<string, any> = { ...rest, na_vitrine: true };
    // Send Especialidades as Directus M2M array (replaces existing)
    payload.Especialidades = especialidade_id
      ? [{ Especialidade_id: especialidade_id }]
      : [];
    saveMutation.mutate(payload as any);
  }

  const especialidades = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.especialidade) set.add(m.especialidade); });
    return Array.from(set).sort();
  }, [membros]);

  const estados = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.estado) set.add(m.estado.toUpperCase()); });
    return Array.from(set).sort();
  }, [membros]);

  const filtered = useMemo(() => {
    return membros.filter(m => {
      const nome = (m.nome || "").toLowerCase();
      const empresa = (m.empresa || "").toLowerCase();
      const esp = (m.especialidade || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || esp.includes(q);
      const matchEsp = filterEspecialidade === "all" || m.especialidade === filterEspecialidade;
      const matchEstado = filterEstado === "all" || (m.estado || "").toUpperCase() === filterEstado;
      return matchSearch && matchEsp && matchEstado;
    });
  }, [membros, search, filterEspecialidade, filterEstado]);

  const hasFilters = search || filterEspecialidade !== "all" || filterEstado !== "all";

  function clearFilters() {
    setSearch("");
    setFilterEspecialidade("all");
    setFilterEstado("all");
  }

  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10 px-6 py-8"
        style={{ background: "radial-gradient(ellipse at 30% 50%, #001428 0%, #000c1f 50%, #020b16 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40" />

        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border border-brand-gold/20 flex items-center justify-center"
                style={{ background: "rgba(215,187,125,0.08)" }}>
                <Store className="w-5 h-5 text-brand-gold/70" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.35em] uppercase">// Rede BUILT</p>
                <h1 className="text-xl font-bold font-mono text-brand-gold">VITRINE BUILT</h1>
              </div>
            </div>

            <p className="text-sm text-white/40 max-w-2xl leading-relaxed">
              Área de acesso livre — encontre fornecedores, prestadores de serviços e empresas da rede BUILT.
              Presença, divulgação de ofertas e conexões estratégicas.
            </p>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5"
                style={{ background: "rgba(215,187,125,0.06)" }}>
                <Users className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-xs font-mono text-white/50">
                  {isLoading ? "..." : `${membros.length} cadastro${membros.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {hasFilters && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5"
                  style={{ background: "rgba(215,187,125,0.04)" }}>
                  <span className="text-xs font-mono text-white/40">{filtered.length} exibindo</span>
                </div>
              )}
            </div>
          </div>

          {/* My card actions */}
          {membroId && (
            <div className="flex items-center gap-2 shrink-0">
              {myCardExists ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openDialog}
                    className="gap-2 border-brand-gold/20 text-brand-gold/70 hover:bg-brand-gold/10 hover:text-brand-gold font-mono text-xs"
                    data-testid="btn-editar-meu-card"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar meu card
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                    className="gap-2 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 font-mono text-xs"
                    data-testid="btn-remover-meu-card"
                  >
                    {removeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Remover
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={openDialog}
                  className="gap-2 font-mono text-xs"
                  style={{
                    background: "linear-gradient(135deg, #D7BB7D, #b89a50)",
                    color: "#001D34",
                  }}
                  data-testid="btn-criar-meu-card"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar meu card
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-3"
        style={{ background: "#030d1a" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            placeholder="Buscar por nome, empresa ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 h-9 text-sm"
            data-testid="input-vitrine-search"
          />
        </div>

        <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
          <SelectTrigger className="w-44 h-9 bg-white/5 border-white/10 text-sm text-white" data-testid="select-vitrine-especialidade">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent className="bg-[#030d1a] border-white/10">
            <SelectItem value="all" className="text-white/60">Todas especialidades</SelectItem>
            {especialidades.map(e => (
              <SelectItem key={e} value={e} className="text-white">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-32 h-9 bg-white/5 border-white/10 text-sm text-white" data-testid="select-vitrine-estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-[#030d1a] border-white/10">
            <SelectItem value="all" className="text-white/60">Todos estados</SelectItem>
            {estados.map(e => (
              <SelectItem key={e} value={e} className="text-white">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 transition-colors"
            data-testid="btn-vitrine-clear-filters"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Store className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/30 font-mono text-sm">
              {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum membro na Vitrine ainda"}
            </p>
            <p className="text-white/15 text-xs mt-1 font-mono">
              {hasFilters ? "Tente ajustar os filtros" : "Crie seu card usando o botão acima"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(m => (
              <MembroCard key={m.id} membro={m} isOwn={m.id === membroId} />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Card Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg border-white/10 text-white"
          style={{ background: "#050f1c" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              {myCardExists ? "Editar card na Vitrine" : "Criar card na Vitrine"}
            </DialogTitle>
            <p className="text-xs text-white/40 font-mono mt-1">
              Preencha as informações que aparecerão no seu card público. Os campos são pré-preenchidos com seu perfil.
            </p>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome / Razão Social">
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Seu nome ou empresa"
                  data-testid="input-card-nome"
                />
              </Field>
              <Field label="Cargo / Função">
                <Input
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Ex: Diretor, Engenheiro"
                  data-testid="input-card-cargo"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Empresa">
                <Input
                  value={form.empresa}
                  onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Nome da empresa"
                  data-testid="input-card-empresa"
                />
              </Field>
              <Field label="Especialidade">
                <Select
                  value={form.especialidade_id}
                  onValueChange={v => setForm(f => ({ ...f, especialidade_id: v }))}
                >
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                    data-testid="select-card-especialidade"
                  >
                    <SelectValue placeholder="Selecione uma especialidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                    {especialidadesOptions.map(e => (
                      <SelectItem
                        key={e.id}
                        value={e.id}
                        className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                      >
                        {e.nome_especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="Cidade">
                  <Input
                    value={form.cidade}
                    onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                    placeholder="Sua cidade"
                    data-testid="input-card-cidade"
                  />
                </Field>
              </div>
              <Field label="Estado">
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-card-estado">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050f1c] border-white/10">
                    {ESTADOS_BR.map(uf => (
                      <SelectItem key={uf} value={uf} className="text-white">{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="27 99999-9999"
                  data-testid="input-card-whatsapp"
                />
              </Field>
              <Field label="E-mail público">
                <Input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="contato@empresa.com"
                  data-testid="input-card-email"
                />
              </Field>
            </div>

            <Field label="Núcleo de Aliança">
              <Input
                value={form.nucleo_alianca}
                onChange={e => setForm(f => ({ ...f, nucleo_alianca: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                placeholder="Ex: Núcleo Técnico, Núcleo Comercial"
                data-testid="input-card-nucleo"
              />
            </Field>

            <Field label="Perfil / Descrição">
              <Textarea
                value={form.perfil_aliado}
                onChange={e => setForm(f => ({ ...f, perfil_aliado: e.target.value }))}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                placeholder="Descreva sua atuação, serviços ou diferenciais..."
                data-testid="input-card-perfil"
              />
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-white/40 hover:text-white/70"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending || !form.nome.trim()}
              className="gap-2 font-mono"
              style={{
                background: "linear-gradient(135deg, #D7BB7D, #b89a50)",
                color: "#001D34",
              }}
              data-testid="btn-salvar-card"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
              {myCardExists ? "Salvar alterações" : "Publicar na Vitrine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembroCard({ membro: m, isOwn }: { membro: MembroVitrine; isOwn: boolean }) {
  const foto = fotoUrl(m);
  const nome = m.nome || "—";
  const [, navigate] = useLocation();

  return (
    <div
      className="relative rounded-xl border overflow-hidden group transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-[1.01]"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        borderColor: isOwn ? "rgba(215,187,125,0.3)" : "rgba(255,255,255,0.06)",
      }}
      onClick={() => navigate(`/vitrine/${m.id}`)}
      data-testid={`card-vitrine-${m.id}`}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: isOwn
          ? "linear-gradient(90deg, transparent, rgba(215,187,125,0.6), transparent)"
          : "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)"
        }} />

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-brand-gold/20" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-brand-gold/20" />

      {isOwn && (
        <div className="absolute top-2 right-2">
          <span className="text-[9px] font-mono text-brand-gold/60 bg-brand-gold/10 border border-brand-gold/15 px-1.5 py-0.5 rounded">
            MEU CARD
          </span>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Avatar */}
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-brand-gold/20"
            style={{
              background: foto ? "transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))",
              boxShadow: "0 0 16px rgba(215,187,125,0.1)",
            }}
          >
            {foto ? (
              <img src={foto} alt={nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
            )}
          </div>
        </div>

        {/* Name + info */}
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-white font-mono leading-tight">{nome}</p>

          {m.especialidade && (
            <p className="text-xs text-brand-gold/60 font-mono truncate">{m.especialidade}</p>
          )}

          {m.empresa && (
            <div className="flex items-center justify-center gap-1">
              <Building2 className="w-3 h-3 text-white/25 shrink-0" />
              <span className="text-xs text-white/40 truncate">{m.empresa}</span>
            </div>
          )}

          {m.cidade && (
            <div className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-xs text-white/35 truncate">{m.cidade}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/40 font-mono">{label}</Label>
      {children}
    </div>
  );
}
