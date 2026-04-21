import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { capitalizeWords } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import {
  MessageCircle, Plus, Pencil, Trash2, Search, Users,
  Briefcase, MapPin, Shield, ChevronRight, Loader2, X,
  Navigation, Globe, UserCheck, UserX, Bell, Clock,
  Eye, FileText, Phone, Mail, Building, Calendar, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

function abbrevTerritory(nome: string): string {
  const words = nome.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map(w => w[0]).join("").slice(0, 4).toUpperCase();
  }
  return nome.replace(/[aeiouAEIOU\s]/g, "").slice(0, 3).toUpperCase() ||
    nome.slice(0, 3).toUpperCase();
}

const COUNTRY_CODES: Record<string, string> = {
  "brasil": "BR", "brazil": "BR",
  "portugal": "PT",
  "estados unidos": "US", "eua": "US", "usa": "US",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "mexico": "MX", "méxico": "MX",
  "peru": "PE",
  "uruguai": "UY",
  "paraguai": "PY",
  "bolívia": "BO", "bolivia": "BO",
  "espanha": "ES",
  "alemanha": "DE",
  "frança": "FR", "franca": "FR",
  "itália": "IT", "italia": "IT",
  "reino unido": "GB",
  "canada": "CA", "canadá": "CA",
  "austrália": "AU", "australia": "AU",
  "japão": "JP", "japao": "JP",
  "china": "CN",
  "angola": "AO",
  "moçambique": "MZ", "mocambique": "MZ",
  "cabo verde": "CV",
};

function abbrevCountry(nome: string): string {
  const key = nome.toLowerCase().trim();
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];
  const words = nome.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return nome.replace(/[aeiouAEIOU\s]/g, "").slice(0, 2).toUpperCase() ||
    nome.slice(0, 2).toUpperCase();
}

function ComunidadeLocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (pais: string, siglaPais: string, territorio: string, siglaTerritorio: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) { setSearch(""); setResults([]); setSelected(null); setError(""); }
  }, [open]);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true); setError(""); setResults([]); setSelected(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!res.ok) throw new Error("Erro na busca");
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) setError("Nenhum resultado encontrado. Tente um nome mais específico.");
      setResults(data);
    } catch {
      setError("Falha ao buscar localização. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!selected) return;
    const addr = selected.address || {};
    const pais = (addr.country || "").trim();
    const siglaPais = (addr.country_code || "").toUpperCase().slice(0, 2).trim();
    const territorio = (addr.city || addr.town || addr.village || addr.municipality ||
      addr.county || addr.state || selected.display_name.split(",")[0]).trim();
    const siglaTerritorio = abbrevTerritory(territorio);
    onSelect(pais, siglaPais, territorio, siglaTerritorio);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" style={{ background: "#001428", border: "1px solid rgba(215,187,125,0.2)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-brand-gold">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Território
          </DialogTitle>
          <DialogDescription className="text-white/40 text-xs">
            Pesquise uma cidade ou região — os campos País e Território serão preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Ex: Belo Horizonte, São Paulo, Lisboa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/20"
            data-testid="input-comunidade-location-search"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 shrink-0"
            data-testid="btn-comunidade-search-location"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {results.length > 0 && (
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            {results.map((r) => {
              const addr = r.address || {};
              const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || r.display_name.split(",")[0];
              return (
                <button
                  key={r.place_id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${selected?.place_id === r.place_id ? "bg-brand-gold/20 border border-brand-gold/40" : "hover:bg-white/5 border border-transparent"}`}
                  data-testid={`comunidade-location-result-${r.place_id}`}
                >
                  <p className="font-medium text-white leading-tight">{city}</p>
                  <p className="text-xs text-white/40 mt-0.5 truncate">{r.display_name}</p>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-brand-gold/30 p-3" style={{ background: "rgba(215,187,125,0.07)" }}>
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest mb-1.5">Localização selecionada</p>
            <p className="text-sm text-white font-medium">{selected.display_name}</p>
            <div className="flex gap-4 mt-2 text-xs text-white/50 font-mono">
              {selected.address?.country && <span>🌎 {selected.address.country}</span>}
              {(selected.address?.city || selected.address?.town) && (
                <span>📍 {selected.address.city || selected.address.town}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            data-testid="btn-comunidade-confirm-location"
          >
            <Globe className="w-4 h-4 mr-1.5" />
            Usar esta localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Membro { id: string; nome?: string; cargo?: string; empresa?: string; foto_perfil?: string | null; }
interface Bia { id: string; nome_bia?: string; }

// M2M junction shapes returned by Directus
interface MembroJunction { cadastro_geral_id: Membro | string | null; }
interface BiaJunction { bias_projetos_id: Bia | string | null; }

interface Comunidade {
  id: string;
  nome?: string;
  sigla?: string;
  pais?: string;
  sigla_pais?: string;
  territorio?: string;
  sigla_territorio?: string;
  codigo_sequencial?: string;
  // M2O
  aliado?: Membro | string | null;
  // M2M
  membros?: MembroJunction[];
  bias?: BiaJunction[];
  status?: string;
  date_created?: string;
}

// Helpers to extract objects from M2O/M2M fields
function resolveAliado(c: Comunidade): Membro | null {
  if (!c.aliado) return null;
  if (typeof c.aliado === "string") return null;
  return c.aliado as Membro;
}
function resolveMembros(c: Comunidade): Membro[] {
  return (c.membros || []).map(j => {
    const m = j.cadastro_geral_id;
    if (!m || typeof m === "string") return null;
    return m as Membro;
  }).filter(Boolean) as Membro[];
}
function resolveBias(c: Comunidade): Bia[] {
  return (c.bias || []).map(j => {
    const b = j.bias_projetos_id;
    if (!b || typeof b === "string") return null;
    return b as Bia;
  }).filter(Boolean) as Bia[];
}
function resolveAliadoId(c: Comunidade): string {
  if (!c.aliado) return "";
  if (typeof c.aliado === "string") return c.aliado;
  return (c.aliado as Membro).id || "";
}
function resolveMembrosIds(c: Comunidade): string[] {
  return (c.membros || []).map(j => {
    const m = j.cadastro_geral_id;
    if (!m) return null;
    if (typeof m === "string") return m;
    return (m as Membro).id || null;
  }).filter(Boolean) as string[];
}
function resolveBiasIds(c: Comunidade): string[] {
  return (c.bias || []).map(j => {
    const b = j.bias_projetos_id;
    if (!b) return null;
    if (typeof b === "string") return b;
    return (b as Bia).id || null;
  }).filter(Boolean) as string[];
}

interface ComunidadeForm {
  pais: string;
  sigla_pais: string;
  territorio: string;
  sigla_territorio: string;
  codigo_sequencial: string;
  nome: string;
  sigla: string;
  aliado_id: string;
  membros_ids: string[];
  bias_ids: string[];
  status: string;
}

const emptyForm = (): ComunidadeForm => ({
  pais: "",
  sigla_pais: "",
  territorio: "",
  sigla_territorio: "",
  codigo_sequencial: "",
  nome: "",
  sigla: "",
  aliado_id: "",
  membros_ids: [],
  bias_ids: [],
  status: "ativa",
});

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=64&height=64&fit=cover`;
}
function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function ComunidadePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comunidade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comunidade | null>(null);
  const [form, setForm] = useState<ComunidadeForm>(emptyForm());
  const [codigoLoading, setCodigoLoading] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [selectedConvite, setSelectedConvite] = useState<any | null>(null);

  const { data: comunidades = [], isLoading } = useQuery<Comunidade[]>({
    queryKey: ["/api/comunidades"],
    queryFn: () => fetch("/api/comunidades").then(r => { if (!r.ok) throw new Error("Erro ao buscar comunidades"); return r.json(); }),
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
    queryFn: () => fetch("/api/membros").then(r => { if (!r.ok) throw new Error("Erro ao buscar membros"); return r.json(); }),
  });

  const { data: bias = [] } = useQuery<Bia[]>({
    queryKey: ["/api/bias"],
    queryFn: () => fetch("/api/bias").then(r => { if (!r.ok) throw new Error("Erro ao buscar BIAs"); return r.json(); }),
  });

  // Open edit dialog when ?edit=:id is in the URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const editId = params.get("edit");
    if (editId && comunidades.length > 0 && !dialogOpen) {
      const c = comunidades.find(x => String(x.id) === editId);
      if (c) { openEdit(c); navigate("/comunidade", { replace: true }); }
    }
  }, [searchParams, comunidades]);

  // Auto-generate nome and sigla
  useEffect(() => {
    const { pais, territorio, sigla_pais, sigla_territorio, codigo_sequencial } = form;
    if (pais && territorio) {
      const nome = `BUILT ${pais} | ${territorio} | Comunidade ${codigo_sequencial || ""}`.trim();
      const sigla = sigla_pais && sigla_territorio && codigo_sequencial
        ? `${sigla_pais.toUpperCase()}-${sigla_territorio.toUpperCase()}-COM-${codigo_sequencial}`
        : "";
      setForm(f => ({ ...f, nome, sigla }));
    }
  }, [form.pais, form.territorio, form.sigla_pais, form.sigla_territorio, form.codigo_sequencial]);

  // Auto-suggest next code when pais+territorio change
  useEffect(() => {
    const { pais, territorio } = form;
    if (!pais?.trim() || !territorio?.trim() || editing) return;
    setCodigoLoading(true);
    fetch(`/api/comunidades/proximo-codigo?pais=${encodeURIComponent(pais)}&territorio=${encodeURIComponent(territorio)}`)
      .then(r => r.json())
      .then(d => setForm(f => ({
        ...f,
        codigo_sequencial: d.codigo,
        ...(d.sigla_territorio ? { sigla_territorio: d.sigla_territorio } : {}),
      })))
      .catch(() => {})
      .finally(() => setCodigoLoading(false));
  }, [form.pais, form.territorio]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/comunidades", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade criada com sucesso!" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao criar comunidade", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/comunidades/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade atualizada!" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/comunidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade removida." });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm(), aliado_id: user?.membro_directus_id || "" });
    setDialogOpen(true);
  }

  function openEdit(c: Comunidade) {
    setEditing(c);
    setForm({
      pais: c.pais || "",
      sigla_pais: c.sigla_pais || "",
      territorio: c.territorio || "",
      sigla_territorio: c.sigla_territorio || "",
      codigo_sequencial: c.codigo_sequencial || "",
      nome: c.nome || "",
      sigla: c.sigla || "",
      aliado_id: resolveAliadoId(c),
      membros_ids: resolveMembrosIds(c),
      bias_ids: resolveBiasIds(c),
      status: c.status || "ativa",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      nome: form.nome,
      sigla: form.sigla,
      pais: form.pais,
      sigla_pais: form.sigla_pais,
      territorio: form.territorio,
      sigla_territorio: form.sigla_territorio,
      codigo_sequencial: form.codigo_sequencial,
      aliado_id: form.aliado_id || null,
      membros_ids: form.membros_ids || [],
      bias_ids: form.bias_ids || [],
      status: form.status || "ativa",
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleMembro(id: string) {
    setForm(f => {
      const ids = f.membros_ids || [];
      return { ...f, membros_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] };
    });
  }

  function toggleBia(id: string) {
    setForm(f => {
      const ids = f.bias_ids || [];
      return { ...f, bias_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] };
    });
  }

  const filtered = comunidades.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.nome?.toLowerCase().includes(q) || c.sigla?.toLowerCase().includes(q) ||
      c.pais?.toLowerCase().includes(q) || c.territorio?.toLowerCase().includes(q) ||
      resolveAliado(c)?.nome?.toLowerCase().includes(q);
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Communities where the current user is the Aliado BUILT
  const minhasComunidadesComoAliado = comunidades.filter(c => {
    const aId = typeof c.aliado === "string" ? c.aliado : (c.aliado as any)?.id;
    return aId && aId === user?.membro_directus_id;
  });

  // Fetch convites for all communities where user is Aliado BUILT
  const { data: convitesPorComunidade } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/convites/aliado", user?.membro_directus_id, minhasComunidadesComoAliado.map(c => c.id).join(",")],
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      for (const com of minhasComunidadesComoAliado) {
        const r = await fetch(`/api/convites?comunidade_id=${com.id}`);
        if (r.ok) result[com.id] = await r.json();
      }
      return result;
    },
    enabled: minhasComunidadesComoAliado.length > 0,
    refetchInterval: 30000,
  });

  const decisaoMutation = useMutation({
    mutationFn: ({ token, decisao }: { token: string; decisao: string }) =>
      apiRequest("PATCH", `/api/convites/${token}/decisao`, { decisao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/convites/aliado"] });
      toast({ title: "Decisão registrada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao processar decisão", variant: "destructive" }),
  });

  const confirmarPagamentoMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("PATCH", `/api/convites/${token}/pagamento`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/convites/aliado"] });
      toast({ title: "Pagamento confirmado! Membro ativado." });
    },
    onError: () => toast({ title: "Erro ao confirmar pagamento", variant: "destructive" }),
  });

  const lembretesMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("POST", `/api/convites/${token}/lembrete`, {}),
    onSuccess: () => toast({ title: "Lembrete enviado!" }),
    onError: () => toast({ title: "Erro ao enviar lembrete", variant: "destructive" }),
  });

  const todosCandidatos = Object.values(convitesPorComunidade || {}).flat();
  const candidatosPendentes = todosCandidatos.filter(c => c.status === "candidato");
  const outrosConvites = todosCandidatos.filter(c => c.status !== "candidato" && c.status !== "convidado");

  // ── Notificações de novos candidatos ──────────────────────────────
  const prevCandidatosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (minhasComunidadesComoAliado.length === 0) return;

    // Request browser notification permission once
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [minhasComunidadesComoAliado.length]);

  useEffect(() => {
    if (!convitesPorComunidade) return;
    const novosIds = candidatosPendentes.map((c: any) => c.id as string);
    const novos = novosIds.filter(id => !prevCandidatosRef.current.has(id));

    if (prevCandidatosRef.current.size > 0 && novos.length > 0) {
      // In-app toast
      const nomes = novos.map(id => candidatosPendentes.find((c: any) => c.id === id)?.candidato_nome || "Novo candidato").join(", ");
      toast({
        title: `📋 ${novos.length === 1 ? "Novo candidato" : `${novos.length} novos candidatos`}`,
        description: nomes,
      });

      // Browser notification (works even when tab is not focused)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("BUILT Alliances — Novo candidato", {
          body: `${nomes} aguarda sua decisão.`,
          icon: "/favicon.ico",
          tag: "built-candidato",
        });
      }
    }

    prevCandidatosRef.current = new Set(novosIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convitesPorComunidade]);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    convidado: { label: "Convidado", color: "text-blue-400" },
    candidato: { label: "Aguardando decisão", color: "text-amber-400" },
    aprovado: { label: "Aprovado", color: "text-green-400" },
    rejeitado: { label: "Rejeitado", color: "text-red-400" },
    termos_enviados: { label: "Termos enviados", color: "text-purple-400" },
    termos_aceitos: { label: "Termos aceitos", color: "text-cyan-400" },
    pagamento_pendente: { label: "Pagamento pendente", color: "text-amber-400" },
    membro: { label: "Membro ativo", color: "text-emerald-400" },
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-comunidade-title">Comunidades</h1>
            <p className="text-sm text-white/40 font-mono mt-0.5">{comunidades.length} comunidade{comunidades.length !== 1 ? "s" : ""} ativa{comunidades.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="font-mono"
          style={{ background: "linear-gradient(135deg, #D7BB7D, #b89a50)", color: "#001D34" }}
          data-testid="btn-nova-comunidade"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Comunidade
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, sigla, país, território..."
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
          data-testid="input-busca-comunidade"
        />
      </div>

      {/* Candidatos Panel — visible only to Aliados BUILT */}
      {minhasComunidadesComoAliado.length > 0 && todosCandidatos.length > 0 && (
        <div className="rounded-2xl border border-brand-gold/15 overflow-hidden" style={{ background: "linear-gradient(145deg,#071626,#040e1c)" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/10" style={{ background: "rgba(215,187,125,0.04)" }}>
            <Bell className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-brand-gold/80 uppercase tracking-widest">Candidatos & Convites</span>
            {candidatosPendentes.length > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {candidatosPendentes.length} pendente{candidatosPendentes.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="divide-y divide-white/5">
            {todosCandidatos.map(convite => {
              const statusInfo = STATUS_LABELS[convite.status] || { label: convite.status, color: "text-white/50" };
              const dados = convite.dados_contratuais as any;
              const comNome = comunidades.find(c => String(c.id) === String(convite.comunidade_id))?.nome || `Comunidade #${convite.comunidade_id}`;
              return (
                <div key={convite.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-mono font-bold text-white">
                        {convite.candidato_nome || dados?.nome_completo || "—"}
                      </p>
                      <span className={`text-[10px] font-mono ${statusInfo.color}`}>
                        • {statusInfo.label}
                      </span>
                    </div>
                    {convite.candidato_email && (
                      <p className="text-xs font-mono text-white/40">{convite.candidato_email}</p>
                    )}
                    {dados && (
                      <div className="flex flex-wrap gap-3 mt-1">
                        {(dados.cpf || dados.cpf_cnpj) && <span className="text-[10px] font-mono text-white/30">CPF: {dados.cpf || dados.cpf_cnpj}</span>}
                        {dados.cnpj && <span className="text-[10px] font-mono text-white/30">CNPJ: {dados.cnpj}</span>}
                        {dados.telefone && <span className="text-[10px] font-mono text-white/30">Tel: {dados.telefone}</span>}
                        {dados.cidade && <span className="text-[10px] font-mono text-white/30">📍 {dados.cidade}, {dados.estado}</span>}
                      </div>
                    )}
                    {dados?.mensagem && (
                      <p className="text-[11px] font-mono text-white/50 italic mt-1 leading-relaxed">"{dados.mensagem}"</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedConvite({ ...convite, comNome })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-white/50 border border-white/10 hover:bg-white/5 transition-colors"
                      data-testid={`btn-ver-candidato-${convite.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver detalhes
                    </button>
                    {convite.status === "candidato" && (
                      <>
                        <button
                          onClick={() => decisaoMutation.mutate({ token: convite.token, decisao: "aprovado" })}
                          disabled={decisaoMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                          data-testid={`btn-aprovar-${convite.id}`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => decisaoMutation.mutate({ token: convite.token, decisao: "rejeitado" })}
                          disabled={decisaoMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                          data-testid={`btn-rejeitar-${convite.id}`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Rejeitar
                        </button>
                      </>
                    )}
                    {["aprovado", "termos_enviados"].includes(convite.status) && (
                      <button
                        onClick={() => lembretesMutation.mutate(convite.token)}
                        disabled={lembretesMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
                        data-testid={`btn-lembrete-${convite.id}`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Reenviar Termos
                      </button>
                    )}
                    {["termos_aceitos", "pagamento_pendente"].includes(convite.status) && (
                      <button
                        onClick={() => confirmarPagamentoMutation.mutate(convite.token)}
                        disabled={confirmarPagamentoMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/10 transition-colors"
                        data-testid={`btn-confirmar-pagamento-${convite.id}`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Confirmar Pagamento
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-white/8 p-12 flex flex-col items-center justify-center text-center"
          style={{ background: "linear-gradient(145deg, #071626, #040e1c)", minHeight: 280 }}
        >
          <MessageCircle className="w-10 h-10 text-brand-gold/20 mb-4" />
          <p className="text-brand-gold/40 font-mono text-xs tracking-[0.3em] uppercase mb-1">
            {search ? "// Nenhum resultado" : "// Sem comunidades"}
          </p>
          <p className="text-white/20 font-mono text-sm">
            {search ? "Tente outro termo de busca." : "Crie a primeira comunidade BUILT."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ComunidadeCard
              key={c.id}
              comunidade={c}
              canEdit={isAdmin || user?.membro_directus_id === resolveAliadoId(c)}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="border-brand-gold/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: "#001428" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-lg">
              {editing ? "Editar Comunidade" : "Nova Comunidade"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Location Picker Button */}
            <Button
              type="button"
              onClick={() => setLocationPickerOpen(true)}
              variant="outline"
              className="w-full border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 hover:border-brand-gold/50 font-mono text-sm gap-2"
              data-testid="btn-comunidade-pick-location"
            >
              <Navigation className="w-4 h-4" />
              Selecionar Localização no Mapa
              {form.pais && form.territorio && (
                <span className="ml-auto text-xs text-white/40 font-mono">
                  {form.sigla_pais} · {form.sigla_territorio}
                </span>
              )}
            </Button>

            {/* País */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">País *</Label>
              <Input
                value={form.pais || ""}
                onChange={e => {
                  const pais = capitalizeWords(e.target.value);
                  const sigla_pais = pais.trim() ? abbrevCountry(pais) : "";
                  setForm(f => ({ ...f, pais, sigla_pais }));
                }}
                placeholder="Ex: Brasil"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                data-testid="input-comunidade-pais"
              />
            </div>

            {/* Território */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Território *</Label>
              <Input
                value={form.territorio || ""}
                onChange={e => {
                  const territorio = capitalizeWords(e.target.value);
                  const sigla_territorio = territorio.trim() ? abbrevTerritory(territorio) : "";
                  setForm(f => ({ ...f, territorio, sigla_territorio }));
                }}
                placeholder="Ex: Belo Horizonte"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                data-testid="input-comunidade-territorio"
              />
            </div>

            {/* Código Sequencial — hidden, calculated automatically on backend */}

            {/* Auto-generated preview */}
            {(form.nome || form.sigla) && (
              <div className="rounded-xl border border-brand-gold/20 p-4" style={{ background: "rgba(215,187,125,0.05)" }}>
                <p className="text-[10px] font-mono text-brand-gold/40 uppercase tracking-widest mb-2">Prévia gerada automaticamente</p>
                {form.nome && <p className="text-sm text-white font-mono">{form.nome}</p>}
                {form.sigla && <p className="text-xs text-brand-gold/60 font-mono mt-1">{form.sigla}</p>}
              </div>
            )}

            {/* Aliado BUILT */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Aliado BUILT</Label>
              <Select value={form.aliado_id || ""} onValueChange={v => setForm(f => ({ ...f, aliado_id: v === "_none" ? "" : v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-comunidade-aliado">
                  <SelectValue placeholder="Selecione o Aliado BUILT" />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="_none">— Nenhum —</SelectItem>
                  {membros.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Membros Associados */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                Membros Associados ({(form.membros_ids || []).length} selecionados)
              </Label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {membros.map(m => {
                  const selected = (form.membros_ids || []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMembro(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? "bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-membro-${m.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{m.nome}</span>
                      {m.empresa && <span className="text-xs text-white/30 font-mono ml-auto truncate">{m.empresa}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BIAs Associadas */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                BIAs Associadas ({(form.bias_ids || []).length} selecionadas)
              </Label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {bias.map(b => {
                  const selected = (form.bias_ids || []).includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBia(b.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? "bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-bia-${b.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{b.nome_bia || b.id}</span>
                    </button>
                  );
                })}
                {bias.length === 0 && (
                  <p className="text-xs text-white/20 font-mono p-3">Nenhuma BIA disponível</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Status</Label>
              <Select value={form.status || "ativa"} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-comunidade-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-white/50 hover:text-white">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !form.pais?.trim() || !form.territorio?.trim() || !form.codigo_sequencial?.trim()}
              className="font-mono"
              style={{ background: "#D7BB7D", color: "#001D34" }}
              data-testid="btn-salvar-comunidade"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Salvar alterações" : "Criar Comunidade")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ComunidadeLocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(pais, siglaPais, territorio, siglaTerritorio) => {
          setForm(f => ({ ...f, pais, sigla_pais: siglaPais, territorio, sigla_territorio: siglaTerritorio }));
        }}
      />

      {/* Candidate Details Dialog */}
      {selectedConvite && (() => {
        const sc = selectedConvite;
        const dados = sc.dados_contratuais as any;
        const statusInfo = STATUS_LABELS[sc.status] || { label: sc.status, color: "text-white/50" };
        return (
          <Dialog open={!!selectedConvite} onOpenChange={open => !open && setSelectedConvite(null)}>
            <DialogContent className="max-w-lg border-brand-gold/15 text-white p-0 overflow-hidden" style={{ background: "linear-gradient(145deg,#071626,#040e1c)" }}>
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/5" style={{ background: "rgba(215,187,125,0.04)" }}>
                <p className="text-[10px] font-mono text-brand-gold/60 uppercase tracking-widest mb-1">Candidato</p>
                <h2 className="text-lg font-bold text-white font-mono">{sc.candidato_nome || dados?.nome_completo || "—"}</h2>
                <span className={`text-xs font-mono ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
                {/* Community */}
                <div className="rounded-lg border border-brand-gold/15 bg-brand-gold/5 px-4 py-3">
                  <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest mb-1">Comunidade pretendida</p>
                  <p className="text-sm font-mono font-bold text-brand-gold/90">{sc.comNome}</p>
                </div>

                {/* Convidado por */}
                {(() => {
                  const invitadorId = sc.invitador_membro_id;
                  if (!invitadorId) return null;
                  const comunidadeDoConvite = comunidades.find(c => String(c.id) === String(sc.comunidade_id));
                  const aliadoId = typeof comunidadeDoConvite?.aliado === "object"
                    ? comunidadeDoConvite?.aliado?.id
                    : comunidadeDoConvite?.aliado;
                  const ehOProprioAliado = aliadoId && String(aliadoId) === String(invitadorId);
                  const invitadorMembro = membros.find(m => String(m.id) === String(invitadorId));
                  const nomeInvitador = ehOProprioAliado
                    ? (invitadorMembro?.nome || "Aliado BUILT")
                    : (invitadorMembro?.nome || invitadorId);
                  const labelInvitador = ehOProprioAliado ? "Aliado BUILT (próprio)" : "Membro";
                  return (
                    <div className="rounded-lg border border-white/8 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <UserCheck className="w-4 h-4 text-brand-gold/50 shrink-0" />
                      <div>
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-0.5">Convidado por</p>
                        <p className="text-sm font-mono font-semibold text-white">{nomeInvitador}</p>
                        <p className="text-[10px] font-mono text-white/30">{labelInvitador}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Contact */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Contato</p>
                  <div className="grid grid-cols-1 gap-2">
                    {sc.candidato_email && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{sc.candidato_email}</span>
                      </div>
                    )}
                    {dados?.telefone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{dados.telefone}</span>
                      </div>
                    )}
                    {(dados?.cidade || dados?.estado) && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{[dados?.cidade, dados?.estado, dados?.pais].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {dados?.endereco && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Building className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{dados.endereco}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document */}
                {(dados?.cpf || dados?.cnpj || dados?.cpf_cnpj) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Documentos</p>
                    {(dados.cpf || dados.cpf_cnpj) && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Hash className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-[10px] font-mono text-white/40 uppercase w-10">CPF</span>
                        <span className="font-mono text-white/70">{dados.cpf || dados.cpf_cnpj}</span>
                      </div>
                    )}
                    {dados.cnpj && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Hash className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-[10px] font-mono text-white/40 uppercase w-10">CNPJ</span>
                        <span className="font-mono text-white/70">{dados.cnpj}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                {dados?.mensagem && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Mensagem do candidato</p>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                      <p className="text-sm font-mono text-white/60 italic leading-relaxed">"{dados.mensagem}"</p>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Datas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2 text-xs">
                      <Calendar className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white/30 font-mono">Candidatura</p>
                        <p className="text-white/60 font-mono">{sc.criado_em ? new Date(sc.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                      </div>
                    </div>
                    {sc.expires_at && (
                      <div className="flex items-start gap-2 text-xs">
                        <Clock className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/30 font-mono">Expira em</p>
                          <p className="text-white/60 font-mono">{new Date(sc.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t border-white/5 flex flex-wrap gap-2">
                {sc.status === "candidato" && (
                  <>
                    <button
                      onClick={() => { decisaoMutation.mutate({ token: sc.token, decisao: "aprovado" }); setSelectedConvite(null); }}
                      disabled={decisaoMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Aprovar candidatura
                    </button>
                    <button
                      onClick={() => { decisaoMutation.mutate({ token: sc.token, decisao: "rejeitado" }); setSelectedConvite(null); }}
                      disabled={decisaoMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                  </>
                )}
                {["aprovado", "termos_enviados"].includes(sc.status) && (
                  <button
                    onClick={() => { lembretesMutation.mutate(sc.token); setSelectedConvite(null); }}
                    disabled={lembretesMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Reenviar Termos
                  </button>
                )}
                {["termos_aceitos", "pagamento_pendente"].includes(sc.status) && (
                  <button
                    onClick={() => { confirmarPagamentoMutation.mutate(sc.token); setSelectedConvite(null); }}
                    disabled={confirmarPagamentoMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/10 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Confirmar Pagamento
                  </button>
                )}
                <button
                  onClick={() => setSelectedConvite(null)}
                  className="ml-auto px-4 py-2 rounded-lg text-xs font-mono text-white/40 hover:text-white/60 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-red-900/30 text-white" style={{ background: "#001428" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-white">Remover comunidade?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-white/50 font-mono">
            A comunidade <span className="text-white">{deleteTarget?.sigla || deleteTarget?.nome}</span> será removida permanentemente.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/50 hover:text-white bg-transparent">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComunidadeCard({ comunidade: c, canEdit, onEdit, onDelete }: {
  comunidade: Comunidade;
  canEdit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [, navigate] = useLocation();
  const aliado = resolveAliado(c);
  const membros = resolveMembros(c);
  const bias = resolveBias(c);
  const foto = fotoUrl(aliado?.foto_perfil);
  return (
    <div
      className="relative rounded-2xl overflow-hidden border transition-all duration-200 hover:border-brand-gold/25 cursor-pointer"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        borderColor: "rgba(255,255,255,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
      onClick={() => navigate(`/comunidade/${c.id}`)}
      data-testid={`card-comunidade-${c.id}`}
    >
      {/* Top gold line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.4), transparent)" }} />

      <div className="p-5 space-y-4">
        {/* Sigla + Status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            {c.sigla && (
              <p className="text-[10px] font-mono text-brand-gold/50 tracking-[0.2em] uppercase mb-1">{c.sigla}</p>
            )}
            <h3 className="text-sm font-bold text-white font-mono leading-snug" data-testid={`text-nome-${c.id}`}>
              {c.nome || "—"}
            </h3>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono border ${c.status === "ativa" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-white/30"}`}>
            {c.status || "ativa"}
          </span>
        </div>

        {/* Localidade */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 font-mono">
          <MapPin className="w-3 h-3 text-brand-gold/40" />
          {[c.territorio, c.pais].filter(Boolean).join(", ")}
        </div>

        {/* Aliado */}
        {aliado && (
          <div className="flex items-center gap-2.5 py-2 border-t border-white/5">
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-brand-gold/20"
              style={{ background: foto ? "transparent" : "rgba(215,187,125,0.08)" }}>
              {foto ? (
                <img src={foto} alt={aliado.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-brand-gold/60">{getInitials(aliado.nome)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Aliado BUILT</p>
              <p className="text-xs text-white/70 font-mono truncate">{aliado.nome}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-white/30 font-mono">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-brand-gold/30" />
            {membros.length} membro{membros.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-brand-gold/30" />
            {bias.length} BIA{bias.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Actions — only visible to the Aliado Built or admin */}
      {canEdit && (
        <div className="flex border-t border-white/5">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-white/40 hover:text-brand-gold hover:bg-white/5 transition-colors"
            data-testid={`btn-edit-comunidade-${c.id}`}
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
          <div className="w-px bg-white/5" />
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-white/40 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            data-testid={`btn-delete-comunidade-${c.id}`}
          >
            <Trash2 className="w-3 h-3" />
            Remover
          </button>
        </div>
      )}
    </div>
  );
}
