import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteQrCode } from "@/components/invite-qr-code";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  User, MapPin, Building2, Briefcase,
  Save, Loader2, Camera, CheckCircle, CheckCircle2, Globe, Navigation, Search,
  ImageIcon, X, Languages, Lock, Ticket, Copy, RefreshCw,
  Store, TrendingUp, Flag, FolderKanban, Scale, Lightbulb, ShieldCheck,
  CircleCheck, Truck, BriefcaseBusiness, Tags, Megaphone, Users,
  ChartNoAxesCombined, ReceiptText, CircleDollarSign, KeyRound
} from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
import { clampPhotoPosition, getPhotoObjectPosition } from "@/lib/photo-position";
import { RAMOS_SEGMENTOS, getSegmentosForRamo, getAllTipos, getNucleosForTipos, getTipoDisplayName } from "@/lib/ramos-segmentos";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

const INVITE_APP_URL = "https://built.dna11.com.br";
const FOTO_CROP_BOX = 320;
const FOTO_CROP_OUTPUT = 640;
const INVITE_TYPE_OPTIONS = [
  { value: "vitrine", label: "BUILT Vitrine" },
  { value: "capital", label: "BUILT Capital (Investidor)" },
  { value: "membros", label: "BUILT Alliances" },
];
const AREA_ATUACAO_OPTIONS = ["Local", "Regional", "Nacional", "Global"];
const INVITE_TYPE_LABELS: Record<string, string> = Object.fromEntries(INVITE_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const AREA_ICON_CONFIG: Record<string, { icon: typeof Flag; color: string; bg: string }> = {
  "Liderança": { icon: Flag, color: "text-amber-600", bg: "bg-amber-50" },
  "Projeto": { icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
  "Jurídicas": { icon: Scale, color: "text-blue-600", bg: "bg-blue-50" },
  "Inteligência": { icon: Lightbulb, color: "text-blue-600", bg: "bg-blue-50" },
  "Governança": { icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50" },
  "Execução": { icon: CircleCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Fornecimento": { icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Comerciais": { icon: BriefcaseBusiness, color: "text-purple-600", bg: "bg-purple-50" },
  "Vendas e Locação": { icon: Tags, color: "text-purple-600", bg: "bg-purple-50" },
  "Marketing": { icon: Megaphone, color: "text-purple-600", bg: "bg-purple-50" },
  "Operações e Facilities": { icon: Building2, color: "text-purple-600", bg: "bg-purple-50" },
  "Gestão de Relacionamento com Cliente": { icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  "Relacionamento": { icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  "Investimento": { icon: ChartNoAxesCombined, color: "text-orange-600", bg: "bg-orange-50" },
  "Contábeis e Tributárias": { icon: ReceiptText, color: "text-orange-600", bg: "bg-orange-50" },
  "Gestão Financeira": { icon: CircleDollarSign, color: "text-orange-600", bg: "bg-orange-50" },
};

function normalizeInviteLink(link?: string | null) {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `${INVITE_APP_URL}${link.startsWith("/") ?"" : "/"}${link}`;
}

function LocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (cidade: string, estado: string, pais: string, lat: number, lng: number) => void;
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
      if (!res.ok) throw new Error();
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
    const cidade = addr.city || addr.town || addr.municipality || addr.village || selected.display_name.split(",")[0];
    const estado = addr.state || "";
    const pais = addr.country || "";
    onSelect(cidade, estado, pais, parseFloat(selected.lat), parseFloat(selected.lon));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Localização
          </DialogTitle>
          <DialogDescription>
            Pesquise uma cidade, endereço ou ponto de referência para obter a localização exata com coordenadas GPS.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Ex: São Paulo, SP — Copacabana, RJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            data-testid="input-location-search"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="px-3 py-2 rounded-md bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 shrink-0"
            data-testid="btn-search-location"
          >
            {loading ?<Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-muted-foreground text-center py-2">{error}</p>}
        {results.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {results.map((r) => (
              <button
                key={r.place_id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                  selected?.place_id === r.place_id
                    ?"bg-brand-gold/10 border-brand-gold/40 text-brand-gold"
                    : "hover:bg-muted border-transparent"
                }`}
                data-testid={`location-result-${r.place_id}`}
              >
                <p className="font-medium leading-tight">{r.display_name}</p>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-input hover:bg-muted">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="px-4 py-2 rounded-md text-sm bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 flex items-center gap-2"
            data-testid="btn-confirm-location"
          >
            <MapPin className="w-3.5 h-3.5" />
            Confirmar localização
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EspecialidadeOption {
  id: string;
  nome_especialidade: string;
}

const REDES_DISPONIVEIS = [
  { value: "BUILT_PROUD_MEMBER", label: "BUILT Proud Member", badge: "/built-proud-member.png" },
  { value: "BUILT_FOUNDING_MEMBER", label: "BUILT Founding Member", badge: "/built-founding-member.png" },
  { value: "BUILT_ALLIANCE_PARTNER", label: "BUILT Alliance Partner", badge: "/built-alliance-partner.png" },
  { value: "BUILT_CAPITAL_PARTNER", label: "BUILT Capital Partner", badge: "/built-capital-partner.png" },
  { value: "BNI", label: "BNI", badge: "/bni-badge.png" },
];

const IDIOMAS_DISPONIVEIS = [
  "Português", "Inglês", "Espanhol", "Francês", "Alemão", "Italiano",
  "Mandarim", "Japonês", "Árabe", "Russo", "Hindi", "Coreano",
  "Holandês", "Sueco", "Norueguês", "Dinamarquês", "Finlandês",
  "Polonês", "Turco", "Hebraico", "Grego", "Tailandês", "Vietnamita",
  "Indonésio", "Malaio", "Húngaro", "Tcheco", "Romeno", "Búlgaro",
  "Ucraniano", "Croata", "Sérvio", "Eslovaco", "Catalão", "Persa",
];



interface Membro {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  latitude?: string | null;
  longitude?: string | null;
  empresa?: string;
  cargo?: string;
  especialidade?: string;
  especialidade_id?: string | null;
  foto?: string | null;
  foto_perfil?: string | null;
  foto_posicao_x?: number | string | null;
  foto_posicao_y?: number | string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  tipo_alianca?: string;
  nucleos_alianca?: string[] | null;
  tipos_alianca?: string[] | null;
  tipo_de_cadastro?: string;
  na_vitrine?: boolean;
  em_membros_built?: boolean;
  em_built_capital?: boolean;
  link_site?: string;
  logo_empresa?: string | null;
  especialidade_livre?: string;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  area_atuacao?: string | null;
  idiomas?: string[] | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=200&height=200&fit=cover`;
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function contributionKey(tipo: string): string {
  return getTipoDisplayName(tipo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function uniqueContributionAreas(tipos?: string[] | null): string[] {
  const seen = new Set<string>();
  return (tipos || []).filter((tipo) => {
    const label = String(tipo || "").trim();
    if (!label) return false;
    const key = contributionKey(label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function MeuPerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const [saved, setSaved] = useState(false);
  const [conviteTipo, setConviteTipo] = useState("vitrine");

  const membroId = user?.membro_directus_id;

  const { data: membro, isLoading } = useQuery<Membro>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  // All authenticated members may generate a personal invite link
  const hasConvitePermission = true;

  const [form, setForm] = useState<Partial<Membro>>({});
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [idiomaInput, setIdiomaInput] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fotoCropRef = useRef<HTMLDivElement>(null);
  const fotoCropImageRef = useRef<HTMLImageElement>(null);
  const fotoDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [fotoCropOpen, setFotoCropOpen] = useState(false);
  const [fotoCropSrc, setFotoCropSrc] = useState<string | null>(null);
  const [fotoCropFileName, setFotoCropFileName] = useState("foto-perfil.jpg");
  const [fotoCropNatural, setFotoCropNatural] = useState({ width: 1, height: 1 });
  const [fotoCropZoom, setFotoCropZoom] = useState(1);
  const [fotoCropOffset, setFotoCropOffset] = useState({ x: 0, y: 0 });

  function handleLocationSelect(cidade: string, estado: string, pais: string, lat: number, lng: number) {
    setForm(f => ({ ...f, cidade, estado, pais, latitude: String(lat), longitude: String(lng) }));
  }

  useEffect(() => {
    if (membro) setForm({ ...membro, tipos_alianca: uniqueContributionAreas(membro.tipos_alianca) });
  }, [membro]);

  useEffect(() => {
    return () => {
      if (fotoCropSrc) URL.revokeObjectURL(fotoCropSrc);
    };
  }, [fotoCropSrc]);

  const { data: especialidadesOptions = [] } = useQuery<EspecialidadeOption[]>({
    queryKey: ["/api/especialidades"],
    queryFn: () => fetch("/api/especialidades").then(r => r.json()),
  });

  const { data: meuConvite, refetch: refetchConvite } = useQuery<any>({
    queryKey: ["/api/meu-convite"],
    queryFn: async () => {
      const res = await fetch("/api/meu-convite", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });
  const meuConviteLink = normalizeInviteLink(meuConvite?.link);

  const gerarConviteMutation = useMutation({
    mutationFn: async ({ force = false, tipo = conviteTipo }: { force?: boolean; tipo?: string } = {}) => {
      const res = await fetch("/api/meu-convite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: !!force, tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar convite");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meu-convite"] });
    },
    onError: (err: any) => toast({ title: "Erro ao gerar convite", description: err.message, variant: "destructive" }),
  });

  function handleConviteTipoChange(tipo: string) {
    setConviteTipo(tipo);
    gerarConviteMutation.mutate({ force: true, tipo });
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Membro>) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao alterar senha");
      return data;
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Senha alterada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    },
  });

  function getCropDrawSize(zoom = fotoCropZoom, natural = fotoCropNatural) {
    const width = Math.max(1, natural.width);
    const height = Math.max(1, natural.height);
    const aspect = width / height;
    if (aspect >= 1) return { width: FOTO_CROP_BOX * zoom * aspect, height: FOTO_CROP_BOX * zoom };
    return { width: FOTO_CROP_BOX * zoom, height: (FOTO_CROP_BOX * zoom) / aspect };
  }

  function clampCropOffset(offset: { x: number; y: number }, zoom = fotoCropZoom, natural = fotoCropNatural) {
    const draw = getCropDrawSize(zoom, natural);
    const maxX = Math.max(0, (draw.width - FOTO_CROP_BOX) / 2);
    const maxY = Math.max(0, (draw.height - FOTO_CROP_BOX) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }

  function resetFotoCrop() {
    setFotoCropZoom(1);
    setFotoCropOffset({ x: 0, y: 0 });
    setFotoCropNatural({ width: 1, height: 1 });
    fotoDragRef.current = null;
    setIsDraggingFoto(false);
  }

  function closeFotoCropModal() {
    setFotoCropOpen(false);
    setFotoCropSrc((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    resetFotoCrop();
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !membroId) return;
    if (fotoCropSrc) URL.revokeObjectURL(fotoCropSrc);
    resetFotoCrop();
    setFotoCropFileName(file.name || "foto-perfil.jpg");
    setFotoCropSrc(URL.createObjectURL(file));
    setFotoCropOpen(true);
  }

  async function uploadCroppedFoto() {
    if (!membroId || !fotoCropImageRef.current) return;
    setUploadingFoto(true);
    try {
      const img = fotoCropImageRef.current;
      const draw = getCropDrawSize();
      const canvas = document.createElement("canvas");
      canvas.width = FOTO_CROP_OUTPUT;
      canvas.height = FOTO_CROP_OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = FOTO_CROP_OUTPUT / FOTO_CROP_BOX;
      const dx = (FOTO_CROP_BOX / 2 - draw.width / 2 + fotoCropOffset.x) * ratio;
      const dy = (FOTO_CROP_BOX / 2 - draw.height / 2 + fotoCropOffset.y) * ratio;
      ctx.drawImage(img, dx, dy, draw.width * ratio, draw.height * ratio);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível recortar a foto")), "image/jpeg", 0.92);
      });
      const fd = new FormData();
      const safeName = fotoCropFileName.replace(/\.[^.]+$/, "") || "foto-perfil";
      fd.append("files", blob, `${safeName}-recortada.jpg`);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload falhou");
      const uuid = json.fileIds[0];
      await apiRequest("PATCH", `/api/membros/${membroId}`, { foto_perfil: uuid, foto_posicao_x: 50, foto_posicao_y: 50 });
      setForm(f => ({ ...f, foto_perfil: uuid, foto: uuid, foto_posicao_x: 50, foto_posicao_y: 50 }));
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros-built"] });
      toast({ title: "Foto de perfil atualizada!" });
      closeFotoCropModal();
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !membroId) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload falhou");
      const uuid = json.fileIds[0];
      await apiRequest("PATCH", `/api/membros/${membroId}`, { logo_empresa: uuid });
      setForm(f => ({ ...f, logo_empresa: uuid }));
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      toast({ title: "Logo da empresa atualizado!" });
    } catch {
      toast({ title: "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function set(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function togglePapelBuilt(roleId: "prestador" | "capital") {
    setForm((current) => {
      const prestadorSelecionado = current.em_membros_built !== false;
      const capitalSelecionado = !!current.em_built_capital;

      if (roleId === "prestador") {
        const nextPrestador = !prestadorSelecionado;
        if (!nextPrestador && !capitalSelecionado) return current;
        return { ...current, em_membros_built: nextPrestador };
      }

      const nextCapital = !capitalSelecionado;
      if (!prestadorSelecionado && !nextCapital) return current;
      return { ...current, em_built_capital: nextCapital };
    });
  }

  function handleSave() {
    if (!String(form.email || "").trim()) {
      toast({ title: "E-mail obrigatório", description: "Informe um e-mail para salvar o perfil.", variant: "destructive" });
      return;
    }
    if (!String(form.telefone || "").trim()) {
      toast({ title: "Telefone obrigatório", description: "Informe um telefone para salvar o perfil.", variant: "destructive" });
      return;
    }
    const { id, nome, especialidade_id, especialidade, ...rest } = form as Membro;
    const tiposAlianca = uniqueContributionAreas(form.tipos_alianca);
    const payload: Record<string, any> = { ...rest, tipos_alianca: tiposAlianca, nucleos_alianca: getNucleosForTipos(tiposAlianca) };
    // Send Especialidades as Directus M2M array
    payload.Especialidades = especialidade_id
      ?[{ especialidades_id: especialidade_id }]
      : [];
    updateMutation.mutate(payload as any);
  }

  function handleChangePassword() {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Campos obrigatórios", description: "Preencha a senha atual, a nova senha e a confirmação.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Senha muito curta", description: "A nova senha deve ter pelo menos 4 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "A confirmação precisa ser igual à nova senha.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  }

  if (!membroId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <User className="w-16 h-16 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-mono text-sm">
            // seu usuário não está vinculado a um cadastro
          </p>
          <p className="text-slate-400 text-xs">Peça ao administrador para vincular seu perfil.</p>
        </div>
      </div>
    );
  }

  const foto = fotoUrl(membro?.foto);
  const nome = form.nome || membro?.nome || user?.nome || "";
  const fotoPosition = getPhotoObjectPosition(form);
  const fotoCropDraw = getCropDrawSize();
  const prestadorSelecionado = form.em_membros_built !== false;
  const capitalSelecionado = !!form.em_built_capital;
  const tiposAliancaSelecionados = uniqueContributionAreas(form.tipos_alianca);
  const papeisBuilt = [
    prestadorSelecionado ? "Prestador de serviços, fornecedor ou profissional independente" : "",
    capitalSelecionado ? "Parceiro de Capital" : "",
  ].filter(Boolean);
  const profileSummary = (
    <section className="profile-section p-4">
      <p className="text-sm font-bold text-[#001D34]">Resumo do seu perfil</p>
      <div className="mt-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-lg font-bold text-[#001D34]">
          {foto ? <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: fotoPosition }} /> : getInitials(nome || "BU")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#001D34]">{nome || "Seu nome"}</p>
          <p className="mt-1 text-xs text-slate-500">{form.cargo || form.especialidade || "Área de Alianças"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-xs">
        <div>
          <p className="font-bold text-slate-700">Papel na BUILT</p>
          <p className="mt-1 break-words text-slate-600">{papeisBuilt.join(" + ") || "-"}</p>
        </div>
        <div>
          <p className="font-bold text-slate-700">Áreas de contribuição ({tiposAliancaSelecionados.length})</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tiposAliancaSelecionados.length > 0 ? tiposAliancaSelecionados.map(tipo => (
              <span key={tipo} className="max-w-full rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700">{getTipoDisplayName(tipo)}</span>
            )) : <span className="text-slate-500">-</span>}
          </div>
        </div>
        <div className="grid grid-cols-[minmax(88px,110px)_minmax(0,1fr)] gap-2">
          <p className="font-bold text-slate-700">Ramo</p><p className="break-words text-slate-600">{form.ramo_atuacao || "-"}</p>
          <p className="font-bold text-slate-700">Segmento</p><p className="break-words text-slate-600">{form.segmento || "-"}</p>
          <p className="font-bold text-slate-700">Área de atuação</p><p className="break-words text-slate-600">{form.area_atuacao || "-"}</p>
          <p className="font-bold text-slate-700">Localização</p><p className="break-words text-slate-600">{[form.cidade, form.estado].filter(Boolean).join(", ") || "-"}</p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="profile-light-page min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-brand-navy">
      <style>{`
        .profile-light-page { background: #f8fafc !important; color: #001d34 !important; }
        .profile-light-page * { min-width: 0; }
        .profile-light-page .profile-aside { background: #001d34; }
        .profile-light-page .profile-onboarding-card,
        .profile-light-page .profile-section {
          border: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
          border-radius: 0.75rem !important;
          box-shadow: none !important;
        }
        .profile-light-page .profile-media-row,
        .profile-light-page .profile-onboarding-card .rounded-xl[style],
        .profile-light-page .profile-onboarding-card .rounded-lg[style] {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        .profile-light-page input,
        .profile-light-page textarea,
        .profile-light-page button[role="combobox"] {
          background: #f8fafc !important;
          border-color: #d8dee8 !important;
          color: #001d34 !important;
          font-family: inherit !important;
          min-height: 2.5rem;
          box-shadow: none !important;
        }
        .profile-light-page label,
        .profile-light-page .profile-section,
        .profile-light-page .profile-onboarding-card,
        .profile-light-page .profile-section .font-mono,
        .profile-light-page .profile-onboarding-card .font-mono {
          font-family: inherit !important;
          letter-spacing: 0 !important;
        }
        .profile-light-page .profile-section .uppercase,
        .profile-light-page .profile-onboarding-card .uppercase {
          text-transform: none !important;
        }
        .profile-light-page input::placeholder,
        .profile-light-page textarea::placeholder { color: #94a3b8 !important; }
        .profile-light-page input:focus,
        .profile-light-page textarea:focus,
        .profile-light-page button[role="combobox"]:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12) !important;
        }
        .profile-light-page [class*="text-white"] { color: #475569 !important; }
        .profile-light-page .profile-aside [class*="text-white"] { color: inherit !important; }
        .profile-light-page h1,
        .profile-light-page h2,
        .profile-light-page h3,
        .profile-light-page .font-bold { color: #001d34 !important; }
        .profile-light-page [class*="text-brand-gold"],
        .profile-light-page [data-testid^="chip-"],
        .profile-light-page [data-testid^="btn-rede-"] span { color: #1d4ed8 !important; }
        .profile-light-page [data-testid="btn-salvar-perfil"] { color: #ffffff !important; }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"] {
          background: #cbd5e1 !important;
          border: 1px solid #94a3b8 !important;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.12) !important;
        }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"][data-state="checked"] {
          background: #d7bb7d !important;
          border-color: #9a7430 !important;
        }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"] span {
          background: #ffffff !important;
          border: 1px solid rgba(15, 23, 42, 0.12) !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24) !important;
        }
        .profile-light-page .bg-black\\/60,
        .profile-light-page .bg-black\\/50 { background: rgba(0, 29, 52, 0.68) !important; }
        .profile-light-page .bg-black\\/60 svg,
        .profile-light-page .bg-black\\/50 svg { color: #ffffff !important; }
        .profile-light-page > .mx-auto > .absolute { display: none !important; }
        .profile-light-page > .mx-auto > .relative.z-10 > .relative.shrink-0 { display: none; }
        @media (max-width: 640px) {
          .profile-light-page .profile-section,
          .profile-light-page .profile-onboarding-card {
            border-radius: 0.625rem !important;
          }
        }
      `}</style>
      {/* Header */}
      <div
        className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8"
        style={{ background: "transparent" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40" />

        <p className="relative z-10 text-xs text-slate-500">Início / Meu perfil</p>
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Avatar — click to upload */}
          <div className="relative shrink-0">
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleFotoChange}
              data-testid="input-foto-perfil"
            />
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto}
              className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-blue-100 text-[#001D34] group/avatar"
              style={{ background: "#dbeafe", boxShadow: "none" }}
              title="Clique para trocar a foto"
              data-testid="btn-trocar-foto"
            >
              {uploadingFoto ?(
                <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
              ) : foto ?(
                <img src={foto} alt={nome} className="w-full h-full object-cover" style={{ objectPosition: fotoPosition }} />
              ) : (
                <span className="text-lg font-bold text-[#001D34]">{getInitials(nome)}</span>
              )}
              {/* Hover overlay */}
              {!uploadingFoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </button>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-blue-200 flex items-center justify-center pointer-events-none">
              {uploadingFoto
                ?<Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                : <Camera className="w-3 h-3 text-blue-600" />
              }
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="flex items-start gap-2 text-xl font-bold leading-tight text-[#001D34] sm:items-center sm:gap-3 sm:text-2xl"><span aria-hidden="true" className="text-2xl sm:text-3xl">👋</span><span>Vamos personalizar sua experiência</span></h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Atualize suas informações para melhorar recomendações, conexões e oportunidades na BUILT.
            </p>
            <p className="mt-2 break-words text-base font-semibold text-[#001D34]">{nome || "—"}</p>
            {(form.especialidade || form.cargo) && (
              <p className="mt-0.5 break-words text-sm text-slate-500">{form.especialidade || form.cargo}</p>
            )}
            {form.empresa && (
              <p className="mt-0.5 flex items-start gap-1 break-words text-xs text-slate-500">
                <Building2 className="w-3 h-3" />{form.empresa}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {isLoading ?(
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 bg-white/5" />)}
          </div>
        ) : (
          <>
            <div className="xl:hidden">
              {profileSummary}
            </div>
            <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,330px)]">
              <div className="min-w-0 space-y-4">
                <section className="profile-section p-4">
                  <h3 className="text-sm font-bold text-[#001D34]">1. Qual o seu papel na BUILT?</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      {
                        id: "prestador" as const,
                        title: "Prestador de serviços, fornecedor ou profissional independente",
                        desc: "Atuo oferecendo serviços, insumos ou experiência profissional.",
                        selected: prestadorSelecionado,
                      },
                      {
                        id: "capital" as const,
                        title: "Parceiro de Capital",
                        desc: "Atuo como investidor ou parceiro de capital.",
                        selected: capitalSelecionado,
                      },
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => togglePapelBuilt(role.id)}
                        className={`flex min-h-24 gap-3 rounded-lg border p-3 text-left transition-colors ${
                          role.selected ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                          role.id === "capital" ? "bg-emerald-50 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {role.id === "capital" ? <TrendingUp className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-bold text-[#001D34]">{role.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-slate-600">{role.desc}</span>
                        </span>
                        {role.selected && <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="profile-section p-4">
                  <h3 className="text-sm font-bold text-[#001D34]">2. Áreas de Contribuição</h3>
                  <p className="mt-1 text-xs text-slate-500">Selecione as áreas em que você pode contribuir.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {getAllTipos().map((tipo) => {
                      const currentTipos = uniqueContributionAreas(form.tipos_alianca);
                      const selected = currentTipos.some((current) => contributionKey(current) === contributionKey(tipo.nome));
                      const label = getTipoDisplayName(tipo.nome);
                      const iconConfig = AREA_ICON_CONFIG[label] || { icon: FolderKanban, color: "text-slate-600", bg: "bg-slate-50" };
                      const AreaIcon = iconConfig.icon;
                      return (
                        <button
                          key={tipo.nome}
                          type="button"
                          onClick={() => {
                            const current = uniqueContributionAreas(form.tipos_alianca);
                            const tipoKey = contributionKey(tipo.nome);
                            const novos = selected ? current.filter(x => contributionKey(x) !== tipoKey) : [...current, tipo.nome];
                            setForm(f => ({ ...f, tipos_alianca: novos, nucleos_alianca: getNucleosForTipos(novos) }));
                          }}
                          className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                            selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:border-blue-300"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${iconConfig.bg} ${iconConfig.color}`}>
                              <AreaIcon className="h-4 w-4" />
                            </span>
                            <span className="truncate">{label}</span>
                          </span>
                          {selected && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Áreas selecionadas: {tiposAliancaSelecionados.length}</p>
                </section>

            {/* Dados pessoais */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={User} label="Dados Pessoais" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nome completo">
                    <Input
                      value={form.nome || ""}
                      onChange={e => set("nome", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-nome"
                    />
                  </Field>
                  <Field label="E-mail *">
                    <Input
                      value={form.email || ""}
                      onChange={e => set("email", e.target.value)}
                      type="email"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-email"
                    />
                  </Field>
                  <Field label="Telefone *">
                    <Input
                      value={form.telefone || ""}
                      onChange={e => set("telefone", e.target.value)}
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-telefone"
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <Input
                      value={form.whatsapp || ""}
                      onChange={e => set("whatsapp", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-whatsapp"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Localização */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={MapPin} label="Localização" />
                <div
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all hover:border-brand-gold/30"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                  onClick={() => setLocationPickerOpen(true)}
                  data-testid="btn-pick-location"
                >
                  <MapPin className="w-4 h-4 text-brand-gold/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {form.cidade ?(
                      <p className="text-sm text-white truncate">
                        {[form.cidade, form.estado, form.pais].filter(Boolean).join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-white/25">Selecionar localização…</p>
                    )}
                  </div>
                  <Navigation className="w-3.5 h-3.5 text-brand-gold/40 shrink-0" />
                </div>
                {form.latitude && form.longitude && (
                  <p className="text-[10px] text-white/20 font-mono px-1">
                    GPS: {parseFloat(form.latitude as string).toFixed(5)}, {parseFloat(form.longitude as string).toFixed(5)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Profissional */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={Briefcase} label="Dados complementares" />

                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                  data-testid="input-foto-perfil"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                  data-testid="input-logo-empresa"
                />

                <div className="profile-media-row flex flex-wrap items-center gap-3 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-sm font-bold text-[#001D34]"
                    title="Clique para trocar a foto"
                    data-testid="btn-trocar-foto"
                  >
                    {uploadingFoto ?(
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : foto ?(
                      <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: fotoPosition }} />
                    ) : (
                      <Camera className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#001D34]">Foto de perfil</p>
                    <p className="text-[11px] text-slate-500">Adicione uma imagem para aparecer no seu perfil.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="shrink-0 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  >
                    {uploadingFoto ? "Enviando..." : foto ? "Trocar foto" : "Adicionar foto"}
                  </Button>
                </div>

                <div className="profile-media-row flex flex-wrap items-center gap-3 rounded-lg p-3">
                  <button
                    type="button"
                    className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white"
                    onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                    title="Clique para enviar a logo"
                    data-testid="btn-upload-logo-empresa"
                  >
                    {uploadingLogo ?(
                      <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
                    ) : form.logo_empresa ?(
                      <>
                        <img
                          src={`/api/assets/${form.logo_empresa}?width=160&height=160&fit=contain`}
                          alt="Logo da empresa"
                          className="w-full h-full object-contain p-1"
                        />
                      </>
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#001D34]">Marca da empresa</p>
                    <p className="text-[11px] text-slate-500">Adicione o logo que aparecera junto ao nome da empresa.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40"
                      data-testid="btn-trocar-logo-empresa"
                    >
                      {uploadingLogo ? "Enviando..." : form.logo_empresa ?"Trocar marca" : "Adicionar marca"}
                    </button>
                    {form.logo_empresa && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, logo_empresa: null }));
                          apiRequest("PATCH", `/api/membros/${membroId}`, { logo_empresa: null });
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-500 hover:border-red-200 hover:text-red-600"
                        data-testid="btn-remover-logo-empresa"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Empresa">
                    <Input
                      value={form.empresa || ""}
                      onChange={e => set("empresa", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-empresa"
                    />
                  </Field>
                  <Field label="Ramo de Atuação">
                    <Select
                      value={form.ramo_atuacao || ""}
                      onValueChange={v => {
                        setForm(f => ({ ...f, ramo_atuacao: v, segmento: null }));
                      }}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                        data-testid="select-perfil-ramo"
                      >
                        <SelectValue placeholder="Selecione o ramo" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001428] border-white/10 text-white max-h-72">
                        {RAMOS_SEGMENTOS.map(r => (
                          <SelectItem
                            key={r.codigo}
                            value={r.nome}
                            className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                          >
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cargo">
                    <Input
                      value={form.cargo || ""}
                      onChange={e => set("cargo", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cargo"
                    />
                  </Field>
                  <Field label="Segmento">
                    <Select
                      value={form.segmento || ""}
                      onValueChange={v => setForm(f => ({ ...f, segmento: v }))}
                      disabled={!form.ramo_atuacao}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40 disabled:opacity-40"
                        data-testid="select-perfil-segmento"
                      >
                        <SelectValue placeholder={form.ramo_atuacao ?"Selecione o segmento" : "Selecione o ramo primeiro"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001428] border-white/10 text-white max-h-72">
                        {getSegmentosForRamo(form.ramo_atuacao || "").map(s => (
                          <SelectItem
                            key={s.codigo}
                            value={s.nome}
                            className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                          >
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Área de atuação">
                    <Select
                      value={form.area_atuacao || ""}
                      onValueChange={v => setForm(f => ({ ...f, area_atuacao: v }))}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                        data-testid="select-perfil-area-atuacao"
                      >
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001428] border-white/10 text-white">
                        {AREA_ATUACAO_OPTIONS.map(option => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Especialidade livre */}
                <Field label="Especialidade (texto livre)">
                  <Input
                    value={form.especialidade_livre || ""}
                    onChange={e => set("especialidade_livre", e.target.value)}
                    placeholder="Ex: Gestão de contratos, Retrofit, BIM..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                    data-testid="input-perfil-especialidade-livre"
                  />
                </Field>

                {/* Idiomas Falados */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40 font-mono flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" />
                    Idiomas Falados
                  </Label>
                  {/* Chips de idiomas selecionados */}
                  {(form.idiomas || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(form.idiomas || []).map(idioma => (
                        <span
                          key={idioma}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border"
                          style={{ background: "rgba(215,187,125,0.12)", borderColor: "rgba(215,187,125,0.35)", color: "#D7BB7D" }}
                          data-testid={`chip-idioma-${idioma}`}
                        >
                          {idioma}
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, idiomas: (f.idiomas || []).filter(i => i !== idioma) }))}
                            className="ml-0.5 rounded-full hover:text-white transition-colors"
                            data-testid={`btn-remover-idioma-${idioma}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Input + sugestões */}
                  <div className="relative">
                    <Input
                      value={idiomaInput}
                      onChange={e => setIdiomaInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && idiomaInput.trim()) {
                          const val = idiomaInput.trim();
                          if (!(form.idiomas || []).includes(val)) {
                            setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), val] }));
                          }
                          setIdiomaInput("");
                          e.preventDefault();
                        }
                      }}
                      placeholder="Buscar ou digitar idioma..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-idioma-busca"
                    />
                    {/* Dropdown de sugestões */}
                    {idiomaInput.length > 0 && (
                      <div
                        className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-white/10 overflow-hidden"
                        style={{ background: "#001428", maxHeight: "180px", overflowY: "auto" }}
                      >
                        {[
                          ...IDIOMAS_DISPONIVEIS.filter(i =>
                            i.toLowerCase().includes(idiomaInput.toLowerCase()) && !(form.idiomas || []).includes(i)
                          ),
                          ...(IDIOMAS_DISPONIVEIS.some(i => i.toLowerCase() === idiomaInput.trim().toLowerCase()) || (form.idiomas || []).includes(idiomaInput.trim())
                            ?[]
                            : [idiomaInput.trim()]
                          ),
                        ].map(sugestao => (
                          <button
                            key={sugestao}
                            type="button"
                            onClick={() => {
                              if (!(form.idiomas || []).includes(sugestao)) {
                                setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), sugestao] }));
                              }
                              setIdiomaInput("");
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-brand-gold/10 hover:text-white transition-colors font-mono"
                            data-testid={`opt-idioma-${sugestao}`}
                          >
                            {sugestao === idiomaInput.trim() && !IDIOMAS_DISPONIVEIS.some(i => i.toLowerCase() === sugestao.toLowerCase())
                              ?`+ Adicionar "${sugestao}"`
                              : sugestao}
                          </button>
                        ))}
                        {IDIOMAS_DISPONIVEIS.filter(i =>
                          i.toLowerCase().includes(idiomaInput.toLowerCase()) && !(form.idiomas || []).includes(i)
                        ).length === 0 && (form.idiomas || []).includes(idiomaInput.trim()) && (
                          <p className="px-3 py-2 text-xs text-white/30 font-mono">Idioma já adicionado</p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Atalhos rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    {IDIOMAS_DISPONIVEIS.slice(0, 6).filter(i => !(form.idiomas || []).includes(i)).map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), i] }))}
                        className="px-2 py-0.5 rounded text-[11px] font-mono border border-white/10 text-white/40 hover:border-brand-gold/30 hover:text-white/70 transition-colors"
                        data-testid={`btn-quick-idioma-${i}`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/20 font-mono">
                    Digite para buscar, pressione Enter para adicionar qualquer idioma.
                  </p>
                </div>

                <Field label="Site / Portfólio">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input
                      value={form.link_site || ""}
                      onChange={e => set("link_site", e.target.value)}
                      type="url"
                      placeholder="https://www.seusite.com.br"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 pl-10"
                      data-testid="input-perfil-link-site"
                    />
                  </div>
                </Field>
                <Field label="Biografia">
                  <Textarea
                    value={form.perfil_aliado || ""}
                    onChange={e => set("perfil_aliado", e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                    data-testid="input-perfil-aliado"
                  />
                </Field>

                {/* Selos */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40 font-mono">Selos</Label>
                  <div className="flex flex-wrap gap-3">
                    {REDES_DISPONIVEIS.map(rede => {
                      const redes = form.Outras_redes_as_quais_pertenco || [];
                      const selected = redes.includes(rede.value);
                      const isBuiltSeal = rede.value.startsWith("BUILT_");
                      const locked = isBuiltSeal && !isSuperAdmin;
                      return (
                        <button
                          key={rede.value}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (locked) return;
                            const current = form.Outras_redes_as_quais_pertenco || [];
                            setForm(f => ({
                              ...f,
                              Outras_redes_as_quais_pertenco: selected
                                ?current.filter(r => r !== rede.value)
                                : [...current, rede.value],
                            }));
                          }}
                          data-testid={`btn-rede-${rede.value.toLowerCase()}`}
                          className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                          style={{
                            background: selected ?"rgba(215,187,125,0.1)" : "rgba(255,255,255,0.03)",
                            borderColor: selected ?"rgba(215,187,125,0.4)" : "rgba(255,255,255,0.08)",
                            boxShadow: selected ?"0 0 12px rgba(215,187,125,0.1)" : "none",
                            cursor: locked ?"not-allowed" : "pointer",
                            opacity: locked && !selected ?0.4 : 1,
                          }}
                        >
                          <img
                            src={rede.badge}
                            alt={rede.label}
                            className="h-10 w-auto object-contain rounded"
                            style={{ opacity: selected ?1 : 0.4, filter: selected ?"none" : "grayscale(0.5)" }}
                          />
                          {/* Badge de estado */}
                          {selected ?(
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "#D7BB7D" }}>
                              <CheckCircle2 className="w-3 h-3 text-[#001D34]" />
                            </span>
                          ) : locked ?(
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              <Lock className="w-2.5 h-2.5 text-white/50" />
                            </span>
                          ) : null}
                          <span className="text-[10px] font-mono" style={{ color: selected ?"#D7BB7D" : "rgba(255,255,255,0.3)" }}>
                            {rede.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/20 font-mono">
                    Selecione selos para exibir no seu perfil.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Vitrine BUILT */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={Globe} label="Vitrine BUILT" />
                <div
                  className="flex flex-col gap-4 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">Aparecer na Vitrine</p>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Quando ativo, os dados deste perfil serao usados no seu card publico da Vitrine.
                    </p>
                  </div>
                  <Switch
                    checked={!!form.na_vitrine}
                    onCheckedChange={checked => setForm(f => ({ ...f, na_vitrine: checked }))}
                    className="data-[state=checked]:bg-brand-gold data-[state=unchecked]:bg-white/15"
                    data-testid="switch-perfil-na-vitrine"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Meu Convite */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="w-3.5 h-3.5 text-brand-gold/50" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white/30">Meu Convite</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  Escolha o tipo de acesso e compartilhe seu link de convite. O link é válido por 1 dia.
                </p>
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-white/30">Tipo de convite</Label>
                  <Select value={conviteTipo} onValueChange={handleConviteTipoChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white/70" data-testid="select-perfil-tipo-convite">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {meuConvite?.tipo && (
                    <p className="text-[10px] font-mono text-white/25">
                      Link ativo: {INVITE_TYPE_LABELS[meuConvite.tipo] || "BUILT Vitrine"}
                    </p>
                  )}
                </div>
                {meuConviteLink ?(
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <span className="flex-1 text-xs font-mono text-white/60 truncate" data-testid="text-convite-link">{meuConviteLink}</span>
                      <button
                        onClick={async () => {
                          const copied = await copyTextToClipboard(formatBuiltInviteMessage(meuConviteLink));
                          if (copied) {
                            toast({ title: "Convite copiado!", description: "A mensagem completa está pronta para compartilhar." });
                          } else {
                            toast({ title: "Não foi possível copiar", description: "Selecione o link e copie manualmente.", variant: "destructive" });
                          }
                        }}
                        className="text-brand-gold hover:text-brand-gold/70 transition-colors"
                        data-testid="btn-copiar-convite"
                        title="Copiar link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {meuConvite.expires_at && (
                      <p className="text-[10px] font-mono text-white/25">
                        Expira em: {new Date(meuConvite.expires_at).toLocaleDateString("pt-BR")}
                        {meuConvite.status === "usado" && <span className="ml-2 text-amber-400/60">· utilizado</span>}
                      </p>
                    )}
                    <InviteQrCode link={meuConviteLink} />
                    <button
                      onClick={() => gerarConviteMutation.mutate({ force: true, tipo: conviteTipo })}
                      disabled={gerarConviteMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-mono text-white/30 hover:text-white/50 transition-colors"
                      data-testid="btn-renovar-convite"
                    >
                      <RefreshCw className={`w-3 h-3 ${gerarConviteMutation.isPending ?"animate-spin" : ""}`} />
                      Gerar novo link
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => gerarConviteMutation.mutate({ force: false, tipo: conviteTipo })}
                    disabled={gerarConviteMutation.isPending}
                    size="sm"
                    className="gap-2 font-mono text-xs"
                    style={{ background: "rgba(215,187,125,0.15)", color: "#D7BB7D", border: "1px solid rgba(215,187,125,0.3)" }}
                    data-testid="btn-gerar-convite"
                  >
                    {gerarConviteMutation.isPending ?(
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ticket className="w-3.5 h-3.5" />
                    )}
                    Gerar link de convite
                  </Button>
                )}
              </CardContent>
            </Card>

              </div>

              <aside className="min-w-0 space-y-4">
                <div className="hidden xl:block">
                  {profileSummary}
                </div>

                <section className="profile-section p-4">
                  <p className="text-sm font-bold text-[#001D34]">Informações atuais</p>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    {[
                      form.email && `E-mail: ${form.email}`,
                      form.whatsapp && `WhatsApp: ${form.whatsapp}`,
                      form.empresa && `Empresa: ${form.empresa}`,
                      form.link_site && `Site: ${form.link_site}`,
                    ].filter(Boolean).map(item => (
                      <p key={String(item)} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="break-all">{item}</span>
                      </p>
                    ))}
                  </div>
                </section>

                <section className="profile-section p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-bold text-[#001D34]">Alterar senha</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Field label="Senha atual">
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                        className="bg-slate-50 border-slate-200 text-[#001D34]"
                        data-testid="input-senha-atual"
                      />
                    </Field>
                    <Field label="Nova senha">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                        className="bg-slate-50 border-slate-200 text-[#001D34]"
                        data-testid="input-nova-senha"
                      />
                    </Field>
                    <Field label="Confirmar nova senha">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        className="bg-slate-50 border-slate-200 text-[#001D34]"
                        data-testid="input-confirmar-nova-senha"
                      />
                    </Field>
                    <Button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending}
                      className="w-full gap-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      data-testid="btn-alterar-senha"
                    >
                      {changePasswordMutation.isPending ?(
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {changePasswordMutation.isPending ? "Alterando..." : "Alterar senha"}
                    </Button>
                  </div>
                </section>
              </aside>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="gap-2 px-6"
                style={{
                  background: saved ?"rgba(74,222,128,0.15)" : "#0f62fe",
                  color: saved ?"#16a34a" : "#ffffff",
                  border: saved ?"1px solid rgba(74,222,128,0.3)" : "none",
                }}
                data-testid="btn-salvar-perfil"
              >
                {updateMutation.isPending ?(
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ?(
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saved ?"Salvo!" : updateMutation.isPending ?"Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </>
        )}
      </div>

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

      <Dialog open={fotoCropOpen} onOpenChange={(open) => { if (!open && !uploadingFoto) closeFotoCropModal(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-brand-gold" />
              Ajustar foto de perfil
            </DialogTitle>
            <DialogDescription>
              Arraste a imagem até encaixar a parte importante dentro do círculo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={fotoCropRef}
              className={`relative mx-auto overflow-hidden rounded-xl bg-slate-950 ${isDraggingFoto ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ width: FOTO_CROP_BOX, height: FOTO_CROP_BOX, maxWidth: "100%", touchAction: "none" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                fotoDragRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  offsetX: fotoCropOffset.x,
                  offsetY: fotoCropOffset.y,
                };
                setIsDraggingFoto(true);
              }}
              onPointerMove={(e) => {
                const start = fotoDragRef.current;
                if (!start) return;
                setFotoCropOffset(clampCropOffset({
                  x: start.offsetX + e.clientX - start.x,
                  y: start.offsetY + e.clientY - start.y,
                }));
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                fotoDragRef.current = null;
                setIsDraggingFoto(false);
              }}
              onPointerCancel={() => {
                fotoDragRef.current = null;
                setIsDraggingFoto(false);
              }}
              onWheel={(e) => {
                e.preventDefault();
                const direction = e.deltaY > 0 ? -1 : 1;
                const nextZoom = Math.max(1, Math.min(3, fotoCropZoom + direction * 0.08));
                setFotoCropZoom(nextZoom);
                setFotoCropOffset((offset) => clampCropOffset(offset, nextZoom));
              }}
              data-testid="modal-crop-foto"
            >
              {fotoCropSrc && (
                <img
                  ref={fotoCropImageRef}
                  src={fotoCropSrc}
                  alt="Prévia da foto"
                  draggable={false}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setFotoCropNatural({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
                    setFotoCropOffset({ x: 0, y: 0 });
                  }}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: fotoCropDraw.width,
                    height: fotoCropDraw.height,
                    transform: `translate(-50%, -50%) translate(${fotoCropOffset.x}px, ${fotoCropOffset.y}px)`,
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-black/45" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
                  style={{ width: FOTO_CROP_BOX - 28, height: FOTO_CROP_BOX - 28 }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-45">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="border border-white/35" />
                ))}
              </div>
              <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-white" />
              <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-white" />
              <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-white" />
              <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-white" />
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Use o scroll do mouse sobre a imagem para aproximar ou afastar.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeFotoCropModal} disabled={uploadingFoto}>
              Cancelar
            </Button>
            <Button
              onClick={uploadCroppedFoto}
              disabled={uploadingFoto || !fotoCropSrc}
              className="gap-2 bg-brand-navy text-white hover:bg-brand-navy/90"
              data-testid="btn-confirmar-recorte-foto"
            >
              {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {uploadingFoto ? "Salvando..." : "Salvar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-3.5 h-3.5 text-[#9a7430]" />
      <span className="text-sm font-semibold text-[#001D34]">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
