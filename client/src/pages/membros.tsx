import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Users, Search, Mail, Phone, MapPin, Building2,
  Briefcase, Globe, Activity, Cpu, Wifi, X,
  Pencil, Camera, Loader2, Save, User
} from "lucide-react";

const DIRECTUS_URL = "https://app.builtalliances.com";

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  tipo_pessoa?: string;
  tipo_de_cadastro?: string;
  cpf_cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  rg_ie?: string;
  inscricao_municipal?: string;
  data_nascimento?: string;
  email?: string;
  whatsapp?: string;
  telefone?: string;
  telefone_secundario?: string;
  site?: string;
  instagram?: string;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  empresa?: string;
  cargo?: string;
  categoria?: string;
  especialidade?: string;
  especialidades?: string[];
  nucleo_alianca?: string;
  perfil_aliado?: string;
  observacoes?: string;
  foto?: string | null;
  ativo?: boolean;
}

function fotoUrl(foto?: string | null, size = 160): string | null {
  if (!foto) return null;
  return `${DIRECTUS_URL}/assets/${foto}?width=${size}&height=${size}&fit=cover`;
}

function getDisplayNome(m: Membro): string {
  return m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.Nome_de_usuario ||
    m.nome ||
    "—";
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function hashColor(str: string): string {
  const colors = [
    ["#0d2a43", "#D7BB7D"],
    ["#0d2a43", "#6fa8dc"],
    ["#1a0d33", "#b39ddb"],
    ["#0d2a1a", "#81c784"],
    ["#2a1a0d", "#ffb74d"],
    ["#2a0d1a", "#f48fb1"],
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length][1];
}

// ---- Membro Edit Sheet ----
function MembroEditSheet({ membro, onClose }: { membro: Membro; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nome = getDisplayNome(membro);
  const accentColor = hashColor(membro.id);
  const currentFoto = fotoUrl(membro.foto, 200);

  const [form, setForm] = useState<Partial<Membro>>({ ...membro });
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentFoto);
  const [uploading, setUploading] = useState(false);

  function setField(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    e.target.value = "";
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let fotoId: string | undefined;

      if (pendingPhoto) {
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append("files", pendingPhoto, pendingPhoto.name);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Falha no upload da foto");
          const data = await res.json();
          fotoId = data.fileIds?.[0];
        } finally {
          setUploading(false);
        }
      }

      const { id, especialidades, foto, ...rest } = form as Membro & { _nome?: string };
      const { _nome, ...cleanRest } = rest as any;
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(cleanRest)) {
        if (value !== "" && value !== null && value !== undefined) {
          payload[key] = value;
        }
      }
      if (fotoId) payload.foto_perfil = fotoId;

      return apiRequest("PATCH", `/api/membros/${membro.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      toast({ title: "Membro atualizado com sucesso!" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    },
  });

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 h-9 text-sm";
  const labelCls = "text-xs text-white/50 mb-1 block";

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0" style={{ background: "#020b16", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-4">
              {/* Avatar with upload */}
              <div className="relative shrink-0 cursor-pointer group/avatar" onClick={() => fileInputRef.current?.click()}>
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center font-bold text-xl font-mono border-2"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${accentColor}20, #030812)`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                  }}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt={nome} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(nome)
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 flex items-center justify-center"
                  style={{ background: "#020b16", borderColor: `${accentColor}40` }}
                >
                  <Camera className="w-3.5 h-3.5" style={{ color: accentColor }} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoSelect}
                  data-testid="input-foto-membro"
                />
              </div>
              <div>
                <SheetTitle className="text-brand-gold font-mono text-lg">{nome}</SheetTitle>
                <SheetDescription className="text-white/40 text-xs mt-0.5">
                  Clique no avatar para alterar a foto
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-5">

            {/* Identificação */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Identificação</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nome Completo (para Contrato)</label>
                  <Input value={form.nome || ""} onChange={e => setField("nome", e.target.value)} className={inputCls} data-testid="input-edit-nome" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nome de usuário (para visualização na plataforma)</label>
                  <Input value={form.Nome_de_usuario || ""} onChange={e => setField("Nome_de_usuario", e.target.value)} className={inputCls} data-testid="input-edit-nome-usuario" />
                </div>
                <div>
                  <label className={labelCls}>Tipo de Pessoa</label>
                  <Select value={form.tipo_pessoa || ""} onValueChange={v => setField("tipo_pessoa", v)}>
                    <SelectTrigger className={inputCls} data-testid="select-edit-tipo-pessoa">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>Tipo de Cadastro</label>
                  <Select value={form.tipo_de_cadastro || ""} onValueChange={v => setField("tipo_de_cadastro", v)}>
                    <SelectTrigger className={inputCls} data-testid="select-edit-tipo-cadastro">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CEO Built">CEO Built</SelectItem>
                      <SelectItem value="Aliado Built">Aliado Built</SelectItem>
                      <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="Investidor">Investidor</SelectItem>
                      <SelectItem value="Parceiro">Parceiro</SelectItem>
                      <SelectItem value="Consultor">Consultor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>CPF / CNPJ</label>
                  <Input value={form.cpf_cnpj || ""} onChange={e => setField("cpf_cnpj", e.target.value)} className={inputCls} placeholder="000.000.000-00" data-testid="input-edit-cpf-cnpj" />
                </div>
                <div>
                  <label className={labelCls}>Data de Nascimento</label>
                  <Input value={form.data_nascimento || ""} onChange={e => setField("data_nascimento", e.target.value)} type="date" className={inputCls} data-testid="input-edit-data-nascimento" />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Dados da Empresa */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Dados da Empresa</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Razão Social</label>
                  <Input value={form.razao_social || ""} onChange={e => setField("razao_social", e.target.value)} className={inputCls} data-testid="input-edit-razao-social" />
                </div>
                <div>
                  <label className={labelCls}>Nome Fantasia</label>
                  <Input value={form.nome_fantasia || ""} onChange={e => setField("nome_fantasia", e.target.value)} className={inputCls} data-testid="input-edit-nome-fantasia" />
                </div>
                <div>
                  <label className={labelCls}>Empresa</label>
                  <Input value={form.empresa || ""} onChange={e => setField("empresa", e.target.value)} className={inputCls} data-testid="input-edit-empresa" />
                </div>
                <div>
                  <label className={labelCls}>Cargo / Função</label>
                  <Input value={form.cargo || ""} onChange={e => setField("cargo", e.target.value)} className={inputCls} data-testid="input-edit-cargo" />
                </div>
                <div>
                  <label className={labelCls}>Categoria</label>
                  <Input value={form.categoria || ""} onChange={e => setField("categoria", e.target.value)} className={inputCls} data-testid="input-edit-categoria" />
                </div>
                <div>
                  <label className={labelCls}>RG / IE</label>
                  <Input value={form.rg_ie || ""} onChange={e => setField("rg_ie", e.target.value)} className={inputCls} data-testid="input-edit-rg-ie" />
                </div>
                <div>
                  <label className={labelCls}>Inscrição Municipal</label>
                  <Input value={form.inscricao_municipal || ""} onChange={e => setField("inscricao_municipal", e.target.value)} className={inputCls} data-testid="input-edit-inscricao-municipal" />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Contato */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Contato</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>E-mail</label>
                  <Input value={form.email || ""} onChange={e => setField("email", e.target.value)} type="email" className={inputCls} data-testid="input-edit-email" />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp</label>
                  <Input value={form.whatsapp || ""} onChange={e => setField("whatsapp", e.target.value)} className={inputCls} placeholder="+55..." data-testid="input-edit-whatsapp" />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <Input value={form.telefone || ""} onChange={e => setField("telefone", e.target.value)} className={inputCls} data-testid="input-edit-telefone" />
                </div>
                <div>
                  <label className={labelCls}>Telefone Secundário</label>
                  <Input value={form.telefone_secundario || ""} onChange={e => setField("telefone_secundario", e.target.value)} className={inputCls} data-testid="input-edit-telefone2" />
                </div>
                <div>
                  <label className={labelCls}>Site</label>
                  <Input value={form.site || ""} onChange={e => setField("site", e.target.value)} className={inputCls} placeholder="https://" data-testid="input-edit-site" />
                </div>
                <div>
                  <label className={labelCls}>Instagram</label>
                  <Input value={form.instagram || ""} onChange={e => setField("instagram", e.target.value)} className={inputCls} placeholder="@usuario" data-testid="input-edit-instagram" />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Endereço */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Endereço</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CEP</label>
                  <Input value={form.cep || ""} onChange={e => setField("cep", e.target.value)} className={inputCls} placeholder="00000-000" data-testid="input-edit-cep" />
                </div>
                <div>
                  <label className={labelCls}>Logradouro</label>
                  <Input value={form.logradouro || ""} onChange={e => setField("logradouro", e.target.value)} className={inputCls} data-testid="input-edit-logradouro" />
                </div>
                <div>
                  <label className={labelCls}>Número</label>
                  <Input value={form.numero || ""} onChange={e => setField("numero", e.target.value)} className={inputCls} data-testid="input-edit-numero" />
                </div>
                <div>
                  <label className={labelCls}>Complemento</label>
                  <Input value={form.complemento || ""} onChange={e => setField("complemento", e.target.value)} className={inputCls} data-testid="input-edit-complemento" />
                </div>
                <div>
                  <label className={labelCls}>Bairro</label>
                  <Input value={form.bairro || ""} onChange={e => setField("bairro", e.target.value)} className={inputCls} data-testid="input-edit-bairro" />
                </div>
                <div>
                  <label className={labelCls}>Cidade</label>
                  <Input value={form.cidade || ""} onChange={e => setField("cidade", e.target.value)} className={inputCls} data-testid="input-edit-cidade" />
                </div>
                <div>
                  <label className={labelCls}>Estado (UF)</label>
                  <Input value={form.estado || ""} onChange={e => setField("estado", e.target.value)} maxLength={2} className={inputCls} placeholder="SP" data-testid="input-edit-estado" />
                </div>
                <div>
                  <label className={labelCls}>País</label>
                  <Input value={form.pais || ""} onChange={e => setField("pais", e.target.value)} className={inputCls} placeholder="Brasil" data-testid="input-edit-pais" />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Aliança */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Aliança</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Núcleo de Aliança</label>
                  <Input value={form.nucleo_alianca || ""} onChange={e => setField("nucleo_alianca", e.target.value)} className={inputCls} data-testid="input-edit-nucleo" />
                </div>
                <div>
                  <label className={labelCls}>Perfil de Aliado</label>
                  <Input value={form.perfil_aliado || ""} onChange={e => setField("perfil_aliado", e.target.value)} className={inputCls} data-testid="input-edit-perfil" />
                </div>
                <div>
                  <label className={labelCls}>Especialidade</label>
                  <Input value={form.especialidade || ""} onChange={e => setField("especialidade", e.target.value)} className={inputCls} data-testid="input-edit-especialidade" />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Observações */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Observações</span>
              </div>
              <textarea
                value={form.observacoes || ""}
                onChange={e => setField("observacoes", e.target.value)}
                rows={3}
                placeholder="Observações sobre este membro..."
                className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 text-sm rounded-md px-3 py-2 resize-none outline-none"
                data-testid="textarea-edit-observacoes"
              />
            </div>

            {pendingPhoto && (
              <div className="flex items-center gap-2 rounded-md border border-brand-gold/20 bg-brand-gold/5 px-3 py-2">
                <Camera className="w-3.5 h-3.5 text-brand-gold/60 shrink-0" />
                <span className="text-xs text-brand-gold/70">Nova foto selecionada: {pendingPhoto.name}</span>
                <button
                  onClick={() => { setPendingPhoto(null); setPhotoPreview(currentFoto); }}
                  className="ml-auto text-white/30 hover:text-white/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/5 flex justify-end gap-2" style={{ background: "rgba(2,11,22,0.95)" }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending || uploading}
            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || uploading}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
            data-testid="btn-salvar-membro"
          >
            {(saveMutation.isPending || uploading) ? (
              <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{uploading ? "Enviando foto..." : "Salvando..."}</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-2" />Salvar alterações</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Membro Card ----
function MembroCard({ membro, index, onEdit }: { membro: Membro & { _nome?: string }; index: number; onEdit: (m: Membro) => void }) {
  const nome = getDisplayNome(membro);
  const initials = getInitials(nome);
  const accentColor = hashColor(membro.id);
  const location = [membro.cidade, membro.estado].filter(Boolean).join(", ");
  const contacto = membro.whatsapp || membro.telefone;
  const foto = fotoUrl(membro.foto);

  return (
    <div
      className="relative group rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-brand-gold/30 hover:shadow-lg"
      style={{ background: "linear-gradient(135deg, #050f1c 0%, #030812 100%)" }}
      data-testid={`card-membro-${membro.id}`}
    >
      {/* Scan line animation */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${accentColor}08 50%, transparent 100%)`,
          animation: "scanline 2s linear infinite",
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />

      {/* Node index */}
      <div className="absolute top-3 right-3 font-mono text-[9px] opacity-20" style={{ color: accentColor }}>
        NODE_{String(index + 1).padStart(3, "0")}
      </div>

      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(membro); }}
        className="absolute top-2 right-10 w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 hover:scale-110"
        style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
        data-testid={`btn-editar-membro-${membro.id}`}
        title="Editar membro"
      >
        <Pencil className="w-3.5 h-3.5" style={{ color: accentColor }} />
      </button>

      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
              style={{
                background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,
                transform: "scale(1.8)",
              }}
            />
            <div
              className="relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-lg font-mono border"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${accentColor}20, #030812)`,
                borderColor: `${accentColor}40`,
                color: accentColor,
                boxShadow: `0 0 12px ${accentColor}20`,
              }}
            >
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#030812]"
              style={{ background: accentColor }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-bold text-sm leading-tight truncate" style={{ color: accentColor }}>
              {nome}
            </h3>
            {(membro.especialidades?.length || membro.especialidade) && (
              <p className="text-xs text-white/50 truncate mt-0.5 flex items-center gap-1">
                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                {(membro.especialidades?.length ? membro.especialidades[0] : membro.especialidade)}
              </p>
            )}
            {membro.empresa && (
              <p className="text-xs text-white/40 truncate mt-0.5 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 shrink-0" />
                {membro.empresa}
              </p>
            )}
          </div>
        </div>

        {/* Divider line */}
        <div className="w-full h-px mb-4" style={{ background: `linear-gradient(90deg, ${accentColor}30, transparent)` }} />

        {/* Contact info */}
        <div className="space-y-1.5">
          {membro.email && (
            <div className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
              <Mail className="w-3 h-3 shrink-0 text-white/20" />
              <a href={`mailto:${membro.email}`} className="text-[11px] truncate hover:underline" onClick={e => e.stopPropagation()}>
                {membro.email}
              </a>
            </div>
          )}
          {contacto && (
            <div className="flex items-center gap-2 text-white/40">
              <Phone className="w-3 h-3 shrink-0 text-white/20" />
              <span className="text-[11px]">{contacto}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-white/40">
              <MapPin className="w-3 h-3 shrink-0 text-white/20" />
              <span className="text-[11px]">{location}</span>
            </div>
          )}
        </div>

        {/* Tags bottom */}
        {(() => {
          const esps = (membro.especialidades?.length ? membro.especialidades : membro.especialidade ? [membro.especialidade] : []);
          return (esps.length > 0 || membro.estado) ? (
            <div className="flex flex-wrap gap-1 mt-3">
              {esps.map((e) => (
                <span
                  key={e}
                  className="text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border"
                  style={{ color: `${accentColor}99`, borderColor: `${accentColor}20`, background: `${accentColor}08` }}
                >
                  {e}
                </span>
              ))}
              {membro.estado && (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border border-white/10 text-white/30">
                  {membro.estado}
                </span>
              )}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

// ---- Stats bar ----
function StatItem({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 border-r border-brand-gold/10 last:border-0">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-gold/50" />
        <span className="text-xl font-bold font-mono text-brand-gold tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] text-white/30 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function MembrosPage() {
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipoCadastro, setFilterTipoCadastro] = useState("");
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);

  const { data: membrosRaw = [], isLoading } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const membros = useMemo(
    () => membrosRaw.map(m => ({ ...m, _nome: getDisplayNome(m) })),
    [membrosRaw]
  );

  const especialidades = useMemo(() => {
    const all = new Set<string>();
    membros.forEach(m => {
      if (Array.isArray(m.especialidades)) m.especialidades.forEach(e => e && all.add(e));
      else if (m.especialidade) all.add(m.especialidade);
    });
    return [...all].sort();
  }, [membros]);

  const estados = useMemo(
    () => [...new Set(membros.map(m => m.estado).filter(Boolean))].sort() as string[],
    [membros]
  );

  const empresas = useMemo(
    () => [...new Set(membros.map(m => m.empresa).filter(Boolean))].sort() as string[],
    [membros]
  );

  const tiposCadastro = useMemo(
    () => [...new Set(membros.map(m => m.tipo_de_cadastro).filter(Boolean))].sort() as string[],
    [membros]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return membros.filter(m => {
      const allEsps = Array.isArray(m.especialidades) && m.especialidades.length > 0
        ? m.especialidades
        : m.especialidade ? [m.especialidade] : [];
      const matchSearch = !q || [
        m._nome, ...allEsps, m.empresa, m.cidade, m.estado, m.email
      ].some(f => f?.toLowerCase().includes(q));
      const matchEsp = !filterEspecialidade || allEsps.includes(filterEspecialidade);
      const matchEstado = !filterEstado || m.estado === filterEstado;
      const matchTipo = !filterTipoCadastro || m.tipo_de_cadastro === filterTipoCadastro;
      return matchSearch && matchEsp && matchEstado && matchTipo;
    });
  }, [membros, search, filterEspecialidade, filterEstado, filterTipoCadastro]);

  const stats = useMemo(() => ({
    total: membros.length,
    empresas: empresas.length,
    estados: estados.length,
    especialidades: especialidades.length,
  }), [membros, empresas, estados, especialidades]);

  const hasFilters = search || filterEspecialidade || filterEstado || filterTipoCadastro;

  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.4; }
          94% { opacity: 1; }
          97% { opacity: 0.8; }
          98% { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.3; }
        }
        @keyframes drift {
          0% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-8px) translateX(4px); }
          66% { transform: translateY(4px) translateX(-4px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
      `}</style>

      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, #001225 0%, #000c1f 40%, #020b16 100%)",
          minHeight: 220,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-8 right-20 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(215,187,125,0.06) 0%, transparent 70%)", animation: "drift 8s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-32 w-32 h-32 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(109,168,220,0.06) 0%, transparent 70%)", animation: "drift 11s ease-in-out infinite reverse" }} />
        <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)", animation: "scanline 4s linear infinite", top: "50%" }} />
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-brand-gold/40" />
        {[0.2, 0.5, 0.8].map((pos, i) => (
          <div key={i} className="absolute left-0 w-1 h-6 rounded-r" style={{ top: `${pos * 100}%`, background: "rgba(215,187,125,0.4)" }} />
        ))}
        {[0.3, 0.6].map((pos, i) => (
          <div key={i} className="absolute right-0 w-1 h-6 rounded-l" style={{ top: `${pos * 100}%`, background: "rgba(109,168,220,0.4)" }} />
        ))}

        <div className="relative z-10 px-6 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-1 rounded-full bg-brand-gold" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span className="text-[10px] font-mono text-brand-gold/50 tracking-[0.4em] uppercase">
              BUILT ALLIANCES // REDE DE PROFISSIONAIS
            </span>
          </div>
          <h1
            className="text-3xl font-bold font-mono text-brand-gold tracking-wide mb-1"
            style={{ animation: "flicker 6s ease-in-out infinite", textShadow: "0 0 20px rgba(215,187,125,0.3)" }}
          >
            MEMBROS
          </h1>
          <p className="text-sm text-white/30 font-mono mb-6">
            &gt; {isLoading ? "carregando perfis..." : `${membros.length} nós ativos na rede`}
          </p>
          <div className="inline-flex items-center rounded-lg border border-brand-gold/10 py-3" style={{ background: "rgba(0,10,20,0.6)", backdropFilter: "blur(8px)" }}>
            <StatItem label="Membros" value={stats.total} icon={Users} />
            <StatItem label="Empresas" value={stats.empresas} icon={Building2} />
            <StatItem label="Estados" value={stats.estados} icon={Globe} />
            <StatItem label="Especialidades" value={stats.especialidades} icon={Activity} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="sticky top-0 z-20 border-b border-white/5 px-6 py-3 flex flex-wrap gap-3 items-center" style={{ background: "rgba(2,11,22,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gold/40" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, especialidade, empresa, cidade..."
            className="pl-9 pr-8 h-8 text-sm bg-white/5 border-white/10 focus:border-brand-gold/40 placeholder:text-white/20 text-white font-mono"
            data-testid="input-busca-membros"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {especialidades.length > 0 && (
          <Select value={filterEspecialidade || "__all__"} onValueChange={v => setFilterEspecialidade(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-52 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40" data-testid="select-filter-especialidade">
              <SelectValue placeholder="Todas as especialidades" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todas as especialidades</SelectItem>
              {especialidades.map(e => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {estados.length > 0 && (
          <Select value={filterEstado || "__all__"} onValueChange={v => setFilterEstado(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40" data-testid="select-filter-estado">
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todos os estados</SelectItem>
              {estados.map(e => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {tiposCadastro.length > 0 && (
          <Select value={filterTipoCadastro || "__all__"} onValueChange={v => setFilterTipoCadastro(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-40 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40" data-testid="select-filter-tipo-cadastro">
              <SelectValue placeholder="Tipo de cadastro" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todos os tipos</SelectItem>
              {tiposCadastro.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterEspecialidade(""); setFilterEstado(""); setFilterTipoCadastro(""); }}
            className="h-8 px-3 text-xs rounded-md border border-red-500/20 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors font-mono flex items-center gap-1.5"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}

        <div className="ml-auto text-xs font-mono text-white/25 hidden sm:block">
          {filtered.length} / {membros.length} nós
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 p-5 space-y-4" style={{ background: "#050f1c" }}>
                <div className="flex items-start gap-3">
                  <Skeleton className="w-14 h-14 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-4 w-3/4 bg-white/5" />
                    <Skeleton className="h-3 w-1/2 bg-white/5" />
                  </div>
                </div>
                <Skeleton className="h-px w-full bg-white/5" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full bg-white/5" />
                  <Skeleton className="h-3 w-2/3 bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <Cpu className="w-16 h-16 text-white/10" />
              <Wifi className="w-6 h-6 text-brand-gold/20 absolute -top-1 -right-1" />
            </div>
            <p className="text-white/30 font-mono text-sm">
              {hasFilters ? "// nenhum nó encontrado para os filtros aplicados" : "// rede vazia"}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterEspecialidade(""); setFilterEstado(""); setFilterTipoCadastro(""); }}
                className="mt-3 text-xs text-brand-gold/40 hover:text-brand-gold/70 font-mono underline"
              >
                limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((membro, i) => (
              <MembroCard
                key={membro.id}
                membro={membro}
                index={i}
                onEdit={setEditingMembro}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      {editingMembro && (
        <MembroEditSheet
          membro={editingMembro}
          onClose={() => setEditingMembro(null)}
        />
      )}
    </div>
  );
}
