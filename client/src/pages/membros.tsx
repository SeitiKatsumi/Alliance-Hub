import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { capitalizeWords } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { RAMOS_SEGMENTOS, getSegmentosForRamo, getAllTipos, getTipoDisplayName, getNucleoForTipo } from "@/lib/ramos-segmentos";
import {
  Users, Search, Mail, Phone, MapPin, Building2,
  Briefcase, Globe, Activity, Cpu, Wifi, X,
  Pencil, Camera, Loader2, Save, User, Plus, Shield, Eye, EyeOff, KeyRound, UserPlus, Lock, AlertCircle,
  CheckCircle2, FileText, Trash2, Settings
} from "lucide-react";
import { AuraBadge } from "@/components/aura-score";
import { getPhotoObjectPosition } from "@/lib/photo-position";
import { PhoneInput } from "@/components/phone-input";

const DIRECTUS_URL = "https://databases.builtalliances.com";

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
  cnpj?: string;
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
  ramo_atuacao?: string | null;
  segmento?: string | null;
  nucleo_alianca?: string;
  tipo_alianca?: string;
  perfil_aliado?: string;
  observacoes?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  foto_posicao_x?: number | string | null;
  foto_posicao_y?: number | string | null;
  logo_empresa?: string | { id?: string } | null;
  ativo?: boolean;
  na_vitrine?: boolean;
  em_membros_built?: boolean;
  em_built_capital?: boolean;
  Outras_redes_as_quais_pertenco?: string[];
  convidado_por_id?: string | null;
  convidado_por_nome?: string | null;
  convite_origem_status?: string | null;
  convite_origem_tipo?: string | null;
  codigo_etica_aceito_em?: string | null;
  codigo_etica_versao?: string | null;
  politicas_participacao_aceito_em?: string | null;
  politicas_participacao_versao?: string | null;
  vitrine_termo_aceito_em?: string | null;
  vitrine_termo_versao?: string | null;
  area_aliancas_termo_aceito_em?: string | null;
  area_aliancas_termo_versao?: string | null;
  built_capital_termo_aceito_em?: string | null;
  built_capital_termo_versao?: string | null;
}

function fotoUrl(foto?: string | null, size = 160): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=${size}&height=${size}&fit=cover`;
}

function logoEmpresaUrl(logo?: string | { id?: string } | null): string | null {
  const id = typeof logo === "string" ?logo : logo?.id;
  if (!id) return null;
  return `/api/assets/${id}?width=160&height=80&fit=contain`;
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
const ROLE_OPTIONS = [
  { value: "user", label: "BUILT Vitrine", desc: "Acesso ao ambiente de vitrine", color: "#facc15" },
  { value: "membro", label: "BUILT Alliances", desc: "Acesso ao ambiente de alianças", color: "#22c55e" },
  { value: "investidor", label: "BUILT Capital", desc: "Acesso ao ambiente de capital", color: "#2563eb" },
  { value: "aliado", label: "Aliado", desc: "Acesso de parceiro de alianças", color: "#a855f7" },
  { value: "admin", label: "Super Admin", desc: "Acesso total à plataforma", color: "#D7BB7D" },
];

const ROLE_AUTO_SELOS: Record<string, string[]> = {
  membro: ["BUILT_PROUD_MEMBER"],
  investidor: ["BUILT_CAPITAL_PARTNER"],
  aliado: ["BUILT_ALLIANCE_PARTNER"],
  admin: [
    "BUILT_PROUD_MEMBER",
    "BUILT_FOUNDING_MEMBER",
    "BUILT_ALLIANCE_PARTNER",
    "BUILT_CAPITAL_PARTNER",
  ],
};

const ROLE_MANAGED_SELOS = new Set(
  Object.values(ROLE_AUTO_SELOS).flat(),
);

const ROLE_PRIORITY = ["admin", "aliado", "membro", "investidor", "user"];

const TERM_ACCEPTANCE_FIELDS = [
  {
    key: "codigo_etica",
    label: "Código de Ética BUILT",
    acceptedAt: "codigo_etica_aceito_em",
    version: "codigo_etica_versao",
  },
  {
    key: "politicas_participacao",
    label: "Políticas de Participação e Proteção",
    acceptedAt: "politicas_participacao_aceito_em",
    version: "politicas_participacao_versao",
  },
  {
    key: "vitrine",
    label: "Termo de Acesso e Uso da Vitrine P\u00fablica BUILT",
    acceptedAt: "vitrine_termo_aceito_em",
    version: "vitrine_termo_versao",
  },
  {
    key: "area_aliancas",
    label: "Termo de Acesso \u00e0 \u00c1rea de Alian\u00e7as BUILT",
    acceptedAt: "area_aliancas_termo_aceito_em",
    version: "area_aliancas_termo_versao",
  },
  {
    key: "built_capital",
    label: "Termo de Acesso \u00e0 \u00c1rea de Parceiros de Capital BUILT",
    acceptedAt: "built_capital_termo_aceito_em",
    version: "built_capital_termo_versao",
  },
] as const;

const TERM_ACCEPTANCE_FIELD_NAMES = new Set<string>(
  TERM_ACCEPTANCE_FIELDS.flatMap(term => [term.acceptedAt, term.version])
);

function formatAcceptanceDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TermAcceptanceReadOnly({ membro }: { membro: Membro }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-3.5 h-3.5 text-brand-gold/70" />
        <span className="text-[11px] font-mono text-brand-gold/70 uppercase tracking-widest">Aceites de termos</span>
      </div>
      <div className="rounded-xl border border-brand-gold/25 bg-slate-50 divide-y divide-slate-200 overflow-hidden" data-testid="readonly-termos-aceitos">
        {TERM_ACCEPTANCE_FIELDS.map(term => {
          const acceptedAt = (membro as any)[term.acceptedAt] as string | null | undefined;
          const version = (membro as any)[term.version] as string | null | undefined;
          const formattedDate = formatAcceptanceDate(acceptedAt);
          return (
            <div key={term.key} className="flex items-start gap-3 px-3 py-3">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${formattedDate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}>
                {formattedDate ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-navy">{term.label}</p>
                <p className={`mt-0.5 text-xs ${formattedDate ? "text-slate-600" : "text-slate-400"}`}>
                  {formattedDate ? `Aceito em ${formattedDate}` : "Não aceito"}
                </p>
                {version && (
                  <p className="mt-0.5 text-[11px] text-slate-400">Versão: {version}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MembroEditSheet({ membro, onClose }: { membro: Membro; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nome = getDisplayNome(membro);
  const accentColor = hashColor(membro.id || "");
  const currentFoto = fotoUrl(membro.foto, 200);

  const [form, setForm] = useState<Partial<Membro>>({ ...membro });
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentFoto);
  const [uploading, setUploading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [newAccEmail, setNewAccEmail] = useState(membro.email || "");
  const [newAccUsername, setNewAccUsername] = useState("");
  const [newAccPassword, setNewAccPassword] = useState("");
  const [newAccPassword2, setNewAccPassword2] = useState("");
  const [changePassword, setChangePassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [selectedComunidadeId, setSelectedComunidadeId] = useState<string>("");
  const [originalComunidadeId, setOriginalComunidadeId] = useState<string>("");
  const [selectedConvidadorId, setSelectedConvidadorId] = useState<string>(membro.convidado_por_id || "");

  const { data: comunidades = [] } = useQuery<{ id: string; nome?: string; sigla?: string }[]>({
    queryKey: ["/api/comunidades"],
    queryFn: () => fetch("/api/comunidades").then(r => r.json()),
    staleTime: 60000,
  });

  const { data: membrosParaConvidador = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
    queryFn: () => fetch("/api/membros").then(r => r.json()),
    staleTime: 60000,
  });

  const { data: membroComunidade } = useQuery<{ id: string; nome?: string; sigla?: string } | null>({
    queryKey: ["/api/membros", membro.id, "comunidade"],
    queryFn: () => membro.id ?fetch(`/api/membros/${membro.id}/comunidade`).then(r => r.json()) : Promise.resolve(null),
    enabled: !!membro.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (membroComunidade?.id) {
      setSelectedComunidadeId(String(membroComunidade.id));
      setOriginalComunidadeId(String(membroComunidade.id));
    }
  }, [membroComunidade?.id]);

  useEffect(() => {
    setSelectedConvidadorId(membro.convidado_por_id || "");
  }, [membro.convidado_por_id]);

  type LinkedUser = { id: string; role: string; username: string; email?: string; membro_directus_id?: string | null };
  const fetchLinkedUser = async (url: string): Promise<LinkedUser | null> => {
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Não foi possível carregar a conta de acesso");
    }
    const data = await res.json();
    return data?.id ? data : null;
  };

  const { data: linkedUser, refetch: refetchLinkedUser, isError: linkedUserError } = useQuery<LinkedUser | null>({
    queryKey: ["/api/users/by-membro", membro.id],
    queryFn: () => membro.id ?fetchLinkedUser(`/api/users/by-membro/${membro.id}`) : Promise.resolve(null),
    enabled: !!membro.id,
    staleTime: 30000,
    retry: false,
  });

  // When there's no linked account, search for an unlinked user by the membro's email
  const membroEmail = (membro as any).email || "";
  const { data: matchedByEmail, isError: matchedByEmailError } = useQuery<LinkedUser | null>({
    queryKey: ["/api/users/by-email", membroEmail],
    queryFn: () => membroEmail ?fetchLinkedUser(`/api/users/by-email?email=${encodeURIComponent(membroEmail)}`) : Promise.resolve(null),
    enabled: !linkedUser && !!membroEmail,
    staleTime: 30000,
    retry: false,
  });

  const accountLookupUnavailable = linkedUserError || matchedByEmailError;

  // Only show the match suggestion if the found user is not linked to another membro
  const suggestedLink = !linkedUser && matchedByEmail && !matchedByEmail.membro_directus_id ?matchedByEmail : null;

  const linkAccountMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/users/${userId}`, { membro_directus_id: membro.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/by-membro", membro.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/by-email", membroEmail] });
      refetchLinkedUser();
      toast({ title: "Conta vinculada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao vincular conta", variant: "destructive" }),
  });

  // Set initial role and email when linkedUser first loads (must be useEffect, not render body)
  useEffect(() => {
    if (!linkedUser) return;
    if (selectedRole === null) {
      const selos: string[] = (form as any).Outras_redes_as_quais_pertenco || [];
      const initialRoles = new Set<string>([linkedUser.role || "user"]);
      if (selos.includes("BUILT_PROUD_MEMBER")) initialRoles.add("membro");
      if (selos.includes("BUILT_CAPITAL_PARTNER")) initialRoles.add("investidor");
      if (selos.includes("BUILT_ALLIANCE_PARTNER")) initialRoles.add("aliado");
      setSelectedRole(linkedUser.role);
      setSelectedRoles(Array.from(initialRoles));
    }
    if (linkedUser.email) setNewAccEmail(prev => prev === (membro.email || "") ?linkedUser.email! : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedUser?.id]);

  function setField(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function setBool(field: keyof Membro, value: boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleSelo(selo: string) {
    setForm(f => {
      const current: string[] = (f as any).Outras_redes_as_quais_pertenco || [];
      const next = current.includes(selo) ?current.filter(s => s !== selo) : [...current, selo];
      return { ...f, Outras_redes_as_quais_pertenco: next };
    });
  }

  function getPrimaryRole(roles: string[]) {
    return ROLE_PRIORITY.find(role => roles.includes(role)) || "user";
  }

  function mergeRolePermissions(roles: string[], rolePerms: Record<string, Record<string, string>>) {
    const levels: Record<string, number> = { none: 0, view: 1, edit: 2 };
    const byLevel: Record<number, string> = { 0: "none", 1: "view", 2: "edit" };
    const merged: Record<string, string> = { ...rolePerms.user };
    roles.forEach(role => {
      const perms = rolePerms[role] || {};
      Object.entries(perms).forEach(([key, value]) => {
        const currentLevel = levels[merged[key] || "none"] ?? 0;
        const nextLevel = levels[value] ?? 0;
        if (nextLevel > currentLevel) merged[key] = byLevel[nextLevel];
      });
    });
    return merged;
  }

  function applyRoleSelection(role: string) {
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter(item => item !== role)
      : [...selectedRoles, role];
    const normalizedRoles = nextRoles.length > 0 ? nextRoles : ["user"];
    setSelectedRoles(normalizedRoles);
    setSelectedRole(getPrimaryRole(normalizedRoles));
    const automaticSelos = normalizedRoles.flatMap(item => ROLE_AUTO_SELOS[item] || []);
    setForm(f => {
      const current: string[] = (f as any).Outras_redes_as_quais_pertenco || [];
      const manualSelos = current.filter(selo => !ROLE_MANAGED_SELOS.has(selo));
      return {
        ...f,
        Outras_redes_as_quais_pertenco: Array.from(new Set([...manualSelos, ...automaticSelos])),
      };
    });
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
      const selosForm: string[] = (form as any).Outras_redes_as_quais_pertenco || [];
      if (selosForm.includes("BUILT_PROUD_MEMBER") && (!selectedComunidadeId || selectedComunidadeId === "none")) {
        throw new Error("Todo membro com o selo BUILT Proud Member deve estar vinculado a uma comunidade. Selecione uma comunidade antes de salvar.");
      }

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
      const computedFields = new Set(["convidado_por_id", "convidado_por_nome", "convite_origem_status", "convite_origem_tipo"]);
      for (const [key, value] of Object.entries(cleanRest)) {
        if (TERM_ACCEPTANCE_FIELD_NAMES.has(key)) continue;
        if (computedFields.has(key)) continue;
        if (typeof value === "boolean") {
          payload[key] = value;
        } else if (Array.isArray(value)) {
          payload[key] = value;
        } else if (value !== "" && value !== null && value !== undefined) {
          payload[key] = value;
        }
      }
      if (fotoId) payload.foto_perfil = fotoId;

      // Save membro
      if (membro.id) {
        await apiRequest("PATCH", `/api/membros/${membro.id}`, payload);
      } else {
        await apiRequest("POST", "/api/membros", payload);
      }

      const rolePerms: Record<string, Record<string, string>> = {
        admin: { aura: "edit", bias: "edit", admin: "edit", painel: "edit", membros: "edit", calculadora: "edit", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" },
        membro: { aura: "view", bias: "edit", admin: "none", painel: "view", membros: "view", calculadora: "view", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "view" },
        investidor: { aura: "view", bias: "view", admin: "none", painel: "view", membros: "view", calculadora: "view", fluxo_caixa: "view", oportunidades: "view", cadastro_geral: "view" },
        aliado: { aura: "view", bias: "edit", admin: "none", painel: "view", membros: "edit", calculadora: "view", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" },
        user: { aura: "view", bias: "view", admin: "none", painel: "view", membros: "none", calculadora: "none", fluxo_caixa: "none", oportunidades: "none", cadastro_geral: "none" },
      };

      if (linkedUser?.id) {
        // Update role, email and/or password if changed
        const roleUpdate: Record<string, any> = {};
        const rolesToSave = selectedRoles.length > 0 ? selectedRoles : [selectedRole || linkedUser.role || "user"];
        const primaryRole = getPrimaryRole(rolesToSave);
        if (selectedRole || selectedRoles.length > 0) {
          roleUpdate.role = primaryRole;
          roleUpdate.permissions = mergeRolePermissions(rolesToSave, rolePerms);
        }
        // Update email if it changed
        if (newAccEmail && newAccEmail !== linkedUser.email) {
          roleUpdate.email = newAccEmail;
        }
        // Update password if filled
        if (changePassword.length >= 4) {
          roleUpdate.password = changePassword;
        }
        if (Object.keys(roleUpdate).length > 0) {
          await apiRequest("PATCH", `/api/users/${linkedUser.id}`, roleUpdate);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        refetchLinkedUser();
      } else if (newAccEmail && newAccPassword.length >= 4) {
        // Create new user account linked to this membro
        if (newAccPassword !== newAccPassword2) throw new Error("As senhas não coincidem");
        const username = newAccUsername || newAccEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();
        const rolesToSave = selectedRoles.length > 0 ? selectedRoles : [selectedRole || "user"];
        const role = getPrimaryRole(rolesToSave);
        await apiRequest("POST", "/api/users", {
          username,
          password: newAccPassword,
          nome: (form as any).nome || (form as any).Nome_de_usuario || nome,
          email: newAccEmail,
          membro_directus_id: membro.id,
          role,
          permissions: mergeRolePermissions(rolesToSave, rolePerms),
          ativo: true,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        refetchLinkedUser();
      } else if (changePassword.length >= 4 || newAccPassword.length >= 4 || selectedRoles.length > 0 || selectedRole) {
        if (accountLookupUnavailable) {
          throw new Error("Dados do membro salvos, mas a senha/permissões não foram alteradas porque o banco local de usuários está indisponível.");
        }
      }
      if (membro.id && selectedConvidadorId !== (membro.convidado_por_id || "")) {
        await apiRequest("PATCH", `/api/membros/${membro.id}/convidador`, {
          convidador_membro_id: selectedConvidadorId || null,
          comunidade_id: selectedComunidadeId || null,
        });
      }
    },
    onSuccess: async () => {
      // Save community link if changed
      if (membro.id && selectedComunidadeId !== originalComunidadeId) {
        try {
          await apiRequest("POST", `/api/membros/${membro.id}/comunidade`, {
            comunidade_id: selectedComunidadeId || null,
            old_comunidade_id: originalComunidadeId || null,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/membros", membro.id, "comunidade"] });
          queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
        } catch {
          // Non-fatal: warn but don't block
          toast({ title: "Dados salvos, mas erro ao vincular comunidade", variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/area-membros"] });
      toast({ title: membro.id ?"Membro atualizado com sucesso!" : "Membro criado com sucesso!" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    },
  });

  const inputCls = "bg-white border-slate-300 text-brand-navy placeholder:text-slate-400 focus:border-brand-gold/60 h-9 text-sm";
  const labelCls = "text-xs text-slate-500 mb-1 block";

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="membro-edit-light w-full sm:max-w-xl flex flex-col p-0 bg-white text-brand-navy border-l border-brand-gold/30">
        <style>{`
          .membro-edit-light [class*="text-white"] {
            color: #475569 !important;
          }
          .membro-edit-light [class*="text-brand-gold"] {
            color: #9a7430 !important;
          }
          .membro-edit-light .font-semibold,
          .membro-edit-light .font-bold {
            color: #001d34 !important;
          }
          .membro-edit-light input,
          .membro-edit-light textarea,
          .membro-edit-light button[role="combobox"] {
            background: #ffffff !important;
            border-color: #d8dee8 !important;
            color: #001d34 !important;
          }
          .membro-edit-light input::placeholder,
          .membro-edit-light textarea::placeholder {
            color: #94a3b8 !important;
          }
          .membro-edit-light [style*="rgba(255,255,255"] {
            background: #ffffff !important;
            border-color: rgba(215, 187, 125, 0.28) !important;
          }
        `}</style>
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-brand-gold/20 bg-slate-50">
            <div className="flex items-center gap-4">
              {/* Avatar with upload */}
              <div className="relative shrink-0 cursor-pointer group/avatar" onClick={() => fileInputRef.current?.click()}>
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center font-bold text-xl font-mono border-2"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${accentColor}18, #ffffff)`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                  }}
                >
                  {photoPreview ?(
                    <img src={photoPreview} alt={nome} className="w-full h-full object-cover" style={{ objectPosition: getPhotoObjectPosition(form as Membro) }} />
                  ) : (
                    getInitials(nome)
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 flex items-center justify-center"
                  style={{ background: "#ffffff", borderColor: `${accentColor}40` }}
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
                <SheetTitle className="text-brand-navy font-mono text-lg">{membro.id ?nome : "Novo Membro"}</SheetTitle>
                <SheetDescription className="text-slate-500 text-xs mt-0.5">
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
                  <label className={labelCls}>CPF</label>
                  <Input value={form.cpf_cnpj || ""} onChange={e => setField("cpf_cnpj", e.target.value)} className={inputCls} placeholder="000.000.000-00" data-testid="input-edit-cpf" />
                </div>
                <div>
                  <label className={labelCls}>Data de Nascimento</label>
                  <Input value={form.data_nascimento || ""} onChange={e => setField("data_nascimento", e.target.value)} type="date" className={inputCls} data-testid="input-edit-data-nascimento" />
                </div>
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            {/* Vínculo à Comunidade */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Vínculo à Comunidade</span>
              </div>
              <div>
                <label className={labelCls}>Comunidade</label>
                <Select
                  value={selectedComunidadeId}
                  onValueChange={v => setSelectedComunidadeId(v === "none" ?"" : v)}
                >
                  <SelectTrigger className={inputCls} data-testid="select-edit-comunidade">
                    <SelectValue placeholder="Selecione uma comunidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem comunidade</SelectItem>
                    {comunidades.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome || c.sigla || `Comunidade #${c.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedComunidadeId && selectedComunidadeId !== originalComunidadeId && (
                  <p className="text-[10px] font-mono text-amber-400/70 mt-1.5">
                    ⚠ Ao salvar, o membro será transferido para esta comunidade.
                  </p>
                )}
                {((form as any).Outras_redes_as_quais_pertenco || []).includes("BUILT_PROUD_MEMBER") && (!selectedComunidadeId || selectedComunidadeId === "none") && (
                  <p className="text-[10px] font-mono text-red-400/80 mt-1.5">
                    ✕ Obrigatório: membros com o selo BUILT Proud Member devem pertencer a uma comunidade.
                  </p>
                )}
              </div>
              <div className="mt-3" data-testid="field-convidado-por">
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-brand-gold" />
                    Convidado por
                  </span>
                </label>
                <Select
                  value={selectedConvidadorId || "none"}
                  onValueChange={v => setSelectedConvidadorId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className={inputCls} data-testid="select-edit-convidado-por">
                    <SelectValue placeholder="Selecione quem convidou..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem registro de convite —</SelectItem>
                    {membrosParaConvidador
                      .filter(item => item.id && item.id !== membro.id)
                      .map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {getDisplayNome(item)}{item.empresa ? ` · ${item.empresa}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            <TermAcceptanceReadOnly membro={membro} />

            <Separator className="bg-brand-gold/20" />

            {/* Dados da Empresa */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Dados da Empresa</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome da Empresa</label>
                  <Input value={form.empresa || ""} onChange={e => setField("empresa", e.target.value)} className={inputCls} data-testid="input-edit-empresa" />
                </div>
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <Input value={form.cnpj || ""} onChange={e => setField("cnpj", e.target.value)} className={inputCls} placeholder="00.000.000/0000-00" data-testid="input-edit-cnpj-empresa" />
                </div>
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

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
                  <PhoneInput value={form.whatsapp || ""} onChange={value => setField("whatsapp", value)} className="border-brand-gold/20 bg-white/5" inputClassName={`${inputCls} !text-brand-navy`} selectClassName="!bg-brand-navy !text-white border-brand-gold/20" data-testid="input-edit-whatsapp" />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <PhoneInput value={form.telefone || ""} onChange={value => setField("telefone", value)} className="border-brand-gold/20 bg-white/5" inputClassName={`${inputCls} !text-brand-navy`} selectClassName="!bg-brand-navy !text-white border-brand-gold/20" data-testid="input-edit-telefone" />
                </div>
                <div>
                  <label className={labelCls}>Telefone Secundário</label>
                  <PhoneInput value={form.telefone_secundario || ""} onChange={value => setField("telefone_secundario", value)} className="border-brand-gold/20 bg-white/5" inputClassName={`${inputCls} !text-brand-navy`} selectClassName="!bg-brand-navy !text-white border-brand-gold/20" data-testid="input-edit-telefone2" />
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

            <Separator className="bg-brand-gold/20" />

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
                  <Input value={form.cidade || ""} onChange={e => setField("cidade", capitalizeWords(e.target.value))} className={inputCls} data-testid="input-edit-cidade" />
                </div>
                <div>
                  <label className={labelCls}>Estado (UF)</label>
                  <Input value={form.estado || ""} onChange={e => setField("estado", e.target.value)} maxLength={2} className={inputCls} placeholder="SP" data-testid="input-edit-estado" />
                </div>
                <div>
                  <label className={labelCls}>País</label>
                  <Input value={form.pais || ""} onChange={e => setField("pais", capitalizeWords(e.target.value))} className={inputCls} placeholder="Brasil" data-testid="input-edit-pais" />
                </div>
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            {/* Aliança */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Aliança</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Área de Contribuição</label>
                  <Select
                    value={(form as any).tipo_alianca || undefined}
                    onValueChange={v => setForm((f: any) => ({
                      ...f,
                      tipo_alianca: v,
                      nucleo_alianca: getNucleoForTipo(v) || f.nucleo_alianca,
                    }))}
                  >
                    <SelectTrigger className={inputCls} data-testid="select-edit-tipo-alianca">
                      <SelectValue placeholder="Selecionar tipo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                      {getAllTipos().map(t => (
                        <SelectItem key={t.nome} value={t.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                          {getTipoDisplayName(t.nome)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>Perfil de Aliado</label>
                  <Input value={form.perfil_aliado || ""} onChange={e => setField("perfil_aliado", e.target.value)} className={inputCls} data-testid="input-edit-perfil" />
                </div>
                <div>
                  <label className={labelCls}>Ramo de Atuação</label>
                  <Select
                    value={form.ramo_atuacao || ""}
                    onValueChange={v => setForm((f: any) => ({ ...f, ramo_atuacao: v, segmento: null }))}
                  >
                    <SelectTrigger className={inputCls} data-testid="select-edit-ramo">
                      <SelectValue placeholder="Selecione o ramo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#001428] border-white/10 text-white max-h-72">
                      {RAMOS_SEGMENTOS.map(r => (
                        <SelectItem key={r.codigo} value={r.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                          {r.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>Segmento</label>
                  <Select
                    value={form.segmento || ""}
                    onValueChange={v => setForm((f: any) => ({ ...f, segmento: v }))}
                    disabled={!form.ramo_atuacao}
                  >
                    <SelectTrigger className={`${inputCls} disabled:opacity-40`} data-testid="select-edit-segmento">
                      <SelectValue placeholder={form.ramo_atuacao ?"Selecione o segmento" : "Selecione o ramo primeiro"} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#001428] border-white/10 text-white max-h-72">
                      {getSegmentosForRamo(form.ramo_atuacao || "").map(s => (
                        <SelectItem key={s.codigo} value={s.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            {/* Presença na Rede */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Presença na Rede</span>
              </div>
              <div className="space-y-2">
                {[
                  { field: "na_vitrine" as keyof Membro, label: "BUILT Vitrine", desc: "Aparece na página de Vitrine pública" },
                  { field: "em_membros_built" as keyof Membro, label: "BUILT Alliances", desc: "Área de alianças" },
                  { field: "em_built_capital" as keyof Membro, label: "BUILT Capital", desc: "Aparece na seção de capital" },
                ].map(({ field, label, desc }) => {
                  const active = !!(form as any)[field];
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => setBool(field, !active)}
                      data-testid={`toggle-${field}`}
                      className="w-full flex items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-all"
                      style={{
                        borderColor: active ?"rgba(215,187,125,0.3)" : "rgba(255,255,255,0.07)",
                        background: active ?"rgba(215,187,125,0.06)" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div>
                        <div className="text-xs font-semibold text-white/70">{label}</div>
                        <div className="text-[10px] text-white/25">{desc}</div>
                      </div>
                      <div
                        className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
                        style={{ background: active ?"#D7BB7D" : "rgba(255,255,255,0.1)" }}
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: active ?"calc(100% - 18px)" : "2px" }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            {/* Selos */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Selos</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "BUILT_PROUD_MEMBER", label: "Proud Member", img: "/built-proud-member.png" },
                  { value: "BUILT_FOUNDING_MEMBER", label: "Founding Member", img: "/built-founding-member.png" },
                  { value: "BUILT_ALLIANCE_PARTNER", label: "Alliance Partner", img: "/built-alliance-partner.png" },
                  { value: "BUILT_CAPITAL_PARTNER", label: "Capital Partner", img: "/built-capital-partner.png" },
                  { value: "BNI", label: "BNI", img: "/bni-badge.png" },
                ].map(selo => {
                  const selosAtivos: string[] = (form as any).Outras_redes_as_quais_pertenco || [];
                  const active = selosAtivos.includes(selo.value);
                  return (
                    <button
                      key={selo.value}
                      type="button"
                      onClick={() => toggleSelo(selo.value)}
                      data-testid={`toggle-selo-${selo.value}`}
                      className="flex flex-col items-center gap-2 rounded-lg border px-2 py-3 transition-all"
                      style={{
                        borderColor: active ?"rgba(215,187,125,0.4)" : "rgba(255,255,255,0.07)",
                        background: active ?"rgba(215,187,125,0.08)" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <img src={selo.img} alt={selo.label} className={`h-10 object-contain transition-all ${active ?"opacity-100" : "opacity-25 grayscale"}`} />
                      <span className="text-[10px] font-mono text-center" style={{ color: active ?"rgba(215,187,125,0.8)" : "rgba(255,255,255,0.2)" }}>
                        {selo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-brand-gold/20" />

            {/* Permissões da Plataforma */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5 text-brand-gold/50" />
                <span className="text-[11px] font-mono text-brand-gold/50 uppercase tracking-widest">Permissões da Plataforma</span>
              </div>
              {linkedUser ?(
                <div className="space-y-3">
                  {/* Account info */}
                  <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-brand-gold/60" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white/70">@{linkedUser.username}</div>
                      {linkedUser.email && <div className="text-[11px] text-white/30">{linkedUser.email}</div>}
                    </div>
                  </div>

                  {/* Change email */}
                  <div>
                    <label className={labelCls}>E-mail de acesso</label>
                    <Input
                      type="email"
                      value={newAccEmail}
                      onChange={e => setNewAccEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className={inputCls}
                      data-testid="input-change-email"
                    />
                  </div>

                  {/* Change password */}
                  <div>
                    <label className={labelCls}>Nova Senha (deixe em branco para manter)</label>
                    <div className="relative">
                      <input
                        type={showPass ?"text" : "password"}
                        value={changePassword}
                        onChange={e => setChangePassword(e.target.value)}
                        placeholder="Nova senha..."
                        className="w-full bg-white border border-slate-300 text-brand-navy placeholder:text-slate-400 focus:border-brand-gold/60 h-9 text-sm rounded-md px-3 pr-9 outline-none"
                        data-testid="input-change-password"
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2.5 top-2 text-white/30 hover:text-white/60">
                        {showPass ?<EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Role selector */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ROLE_OPTIONS.map(opt => {
                      const activeRoles = selectedRoles.length > 0 ? selectedRoles : [linkedUser.role || "user"];
                      const isSelected = activeRoles.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => applyRoleSelection(opt.value)}
                          data-testid={`btn-role-${opt.value}`}
                          className="flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all"
                          style={{
                            borderColor: isSelected ?opt.color : "rgba(255,255,255,0.07)",
                            background: isSelected ?`${opt.color}12` : "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: isSelected ?opt.color : "rgba(255,255,255,0.15)" }} />
                            <span className="text-xs font-semibold font-mono" style={{ color: isSelected ?opt.color : "rgba(255,255,255,0.5)" }}>
                              {opt.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/25 pl-3.5">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {((selectedRoles.length > 0 && (selectedRole !== linkedUser.role || selectedRoles.length > 1)) || changePassword.length >= 4) && (
                    <div className="flex items-center gap-2 rounded-md border border-brand-gold/20 bg-brand-gold/5 px-3 py-2">
                      <Shield className="w-3 h-3 text-brand-gold/60 shrink-0" />
                      <span className="text-xs text-brand-gold/70">Alterações serão aplicadas ao salvar</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestedLink ?(
                    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-brand-gold/70 shrink-0" />
                        <span className="text-xs text-brand-gold/80 font-mono font-semibold">Conta existente encontrada</span>
                      </div>
                      <div className="text-xs text-white/60 pl-6">
                        @{suggestedLink.username}{suggestedLink.email ?` · ${suggestedLink.email}` : ""}
                      </div>
                      <button
                        type="button"
                        onClick={() => linkAccountMutation.mutate(suggestedLink.id)}
                        disabled={linkAccountMutation.isPending}
                        className="ml-6 text-xs font-semibold text-brand-gold hover:text-brand-gold/80 underline underline-offset-2 transition-colors disabled:opacity-50"
                        data-testid="btn-link-account"
                      >
                        {linkAccountMutation.isPending ?"Vinculando..." : "Vincular esta conta ao membro"}
                      </button>
                    </div>
                  ) : matchedByEmail && matchedByEmail.membro_directus_id ?(
                    <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-amber-400/80 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        E-mail já vinculado a outra conta (@{matchedByEmail.username})
                      </div>
                      <p className="text-[11px] text-white/30 pl-5">Use um e-mail diferente ou desvincule primeiro a outra conta.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-4 py-3 flex items-center gap-3">
                      <UserPlus className="w-4 h-4 text-white/20 flex-shrink-0" />
                      <span className="text-xs text-white/25 font-mono">Sem conta. Preencha abaixo para criar acesso.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>E-mail de acesso</label>
                      <Input
                        type="email"
                        value={newAccEmail}
                        onChange={e => setNewAccEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className={inputCls}
                        data-testid="input-new-acc-email"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Nome de usuário (login)</label>
                      <Input
                        value={newAccUsername}
                        onChange={e => setNewAccUsername(e.target.value)}
                        placeholder={newAccEmail ?newAccEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase() : "usuario"}
                        className={inputCls}
                        data-testid="input-new-acc-username"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Senha</label>
                      <div className="relative">
                        <input
                          type={showPass ?"text" : "password"}
                          value={newAccPassword}
                          onChange={e => setNewAccPassword(e.target.value)}
                          placeholder="Mín. 4 caracteres"
                          className="w-full bg-white border border-slate-300 text-brand-navy placeholder:text-slate-400 focus:border-brand-gold/60 h-9 text-sm rounded-md px-3 pr-9 outline-none"
                          data-testid="input-new-acc-password"
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2.5 top-2 text-white/30 hover:text-white/60">
                          {showPass ?<EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Confirmar senha</label>
                      <div className="relative">
                        <input
                          type={showPass2 ?"text" : "password"}
                          value={newAccPassword2}
                          onChange={e => setNewAccPassword2(e.target.value)}
                          placeholder="Repita a senha"
                          className={`w-full bg-white border h-9 text-sm rounded-md px-3 pr-9 outline-none text-brand-navy placeholder:text-slate-400 focus:border-brand-gold/60 ${newAccPassword2 && newAccPassword !== newAccPassword2 ?"border-red-500/40" : "border-slate-300"}`}
                          data-testid="input-new-acc-password2"
                        />
                        <button type="button" onClick={() => setShowPass2(v => !v)} className="absolute right-2.5 top-2 text-white/30 hover:text-white/60">
                          {showPass2 ?<EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {newAccPassword2 && newAccPassword !== newAccPassword2 && (
                        <p className="text-[10px] text-red-400/70 mt-1">As senhas não coincidem</p>
                      )}
                    </div>
                  </div>

                  {/* Role selector for new account */}
                  {newAccEmail && newAccPassword.length >= 4 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {ROLE_OPTIONS.map(opt => {
                        const activeRoles = selectedRoles.length > 0 ? selectedRoles : [selectedRole || "user"];
                        const isSelected = activeRoles.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => applyRoleSelection(opt.value)}
                            data-testid={`btn-role-new-${opt.value}`}
                            className="flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all"
                            style={{
                              borderColor: isSelected ?opt.color : "rgba(255,255,255,0.07)",
                              background: isSelected ?`${opt.color}12` : "rgba(255,255,255,0.02)",
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: isSelected ?opt.color : "rgba(255,255,255,0.15)" }} />
                              <span className="text-xs font-semibold font-mono" style={{ color: isSelected ?opt.color : "rgba(255,255,255,0.5)" }}>
                                {opt.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/25 pl-3.5">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {newAccEmail && newAccPassword.length >= 4 && newAccPassword === newAccPassword2 && (
                    <div className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <KeyRound className="w-3 h-3 text-green-400/60 shrink-0" />
                      <span className="text-xs text-green-400/70">Conta será criada ao salvar</span>
                    </div>
                  )}
                  {newAccEmail && newAccPassword.length < 4 && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <Lock className="w-3 h-3 text-amber-400/70 shrink-0" />
                      <span className="text-xs text-amber-400/80">Defina uma senha (mín. 4 caracteres) para criar a conta</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator className="bg-brand-gold/20" />

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
                className="w-full bg-white border border-slate-300 text-brand-navy placeholder:text-slate-400 focus:border-brand-gold/60 text-sm rounded-md px-3 py-2 resize-none outline-none"
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
        <div className="shrink-0 px-6 py-4 border-t border-brand-gold/20 flex justify-end gap-2 bg-white">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending || uploading}
            className="border-slate-300 text-slate-600 hover:text-brand-navy hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || uploading}
            className="bg-brand-gold !text-white hover:bg-brand-gold/90 hover:!text-white font-semibold [&_*]:!text-white"
            style={{ color: "#FFFFFF" }}
            data-testid="btn-salvar-membro"
          >
            {(saveMutation.isPending || uploading) ?(
              <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /><span className="!text-white" style={{ color: "#FFFFFF" }}>{uploading ?"Enviando foto..." : "Salvando..."}</span></>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-2" /><span className="!text-white" style={{ color: "#FFFFFF" }}>Salvar alterações</span></>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Membro Card ----
function MembroCard({
  membro,
  index,
  onEdit,
  onDelete,
}: {
  membro: Membro & { _nome?: string };
  index: number;
  onEdit: (m: Membro) => void;
  onDelete: (m: Membro) => void;
}) {
  const nome = getDisplayNome(membro);
  const initials = getInitials(nome);
  const accentColor = hashColor(membro.id);
  const location = [membro.cidade, membro.estado].filter(Boolean).join(", ");
  const contacto = membro.whatsapp || membro.telefone;
  const foto = fotoUrl(membro.foto);
  const logo = logoEmpresaUrl(membro.logo_empresa);

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

      <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(membro); }}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-transform hover:scale-110"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" }}
          data-testid={`btn-excluir-membro-${membro.id}`}
          title="Excluir membro"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-300" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(membro); }}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-transform hover:scale-110"
          style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
          data-testid={`btn-editar-membro-${membro.id}`}
          title="Editar membro"
        >
          <Pencil className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </button>
      </div>

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
              {foto ?(
                <img src={foto} alt={nome} className="w-full h-full object-cover" style={{ objectPosition: getPhotoObjectPosition(membro) }} />
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
                {(membro.especialidades?.length ?membro.especialidades[0] : membro.especialidade)}
              </p>
            )}
            {membro.empresa && (
              <div className="mt-1 flex items-center gap-2 min-w-0">
                {logo ?(
                  <span className="flex h-7 w-12 shrink-0 items-center justify-center">
                    <img src={logo} alt={`Marca ${membro.empresa}`} className="max-h-full max-w-full object-contain drop-shadow-sm" />
                  </span>
                ) : (
                  <Building2 className="w-2.5 h-2.5 shrink-0 text-white/25" />
                )}
                <span className="text-xs text-white/40 truncate">{membro.empresa}</span>
              </div>
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
          {membro.convidado_por_nome && (
            <div className="flex items-center gap-2 text-white/40">
              <UserPlus className="w-3 h-3 shrink-0 text-white/20" />
              <span className="text-[11px] truncate">Convidado por {membro.convidado_por_nome}</span>
            </div>
          )}
        </div>

        {/* Aura badge */}
        <div className="mt-2">
          <AuraBadge membroId={membro.id} />
        </div>

        {/* Tags bottom */}
        {(() => {
          const esps = (membro.especialidades?.length ?membro.especialidades : membro.especialidade ?[membro.especialidade] : []);
          return (esps.length > 0 || membro.estado) ?(
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipoCadastro, setFilterTipoCadastro] = useState("");
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Membro | null>(null);
  const [adminTab, setAdminTab] = useState<"cadastro" | "configuracoes">("cadastro");

  const { data: membrosRaw = [], isLoading } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
    enabled: !!user,
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
        ?m.especialidades
        : m.especialidade ?[m.especialidade] : [];
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/membros/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      toast({ title: "Membro excluído com sucesso." });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir membro",
        description: error?.message || "Não foi possível excluir este membro.",
        variant: "destructive",
      });
    },
  });

  // Restrict to Super Admin only
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-brand-navy text-xl font-bold">Acesso Restrito</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            O módulo <strong className="text-brand-navy">Cadastro Geral</strong> é exclusivo para Super Administradores da plataforma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="membros-light-page min-h-screen bg-slate-50 text-brand-navy">
      <style>{`
        .membros-light-page {
          background: #f8fafc !important;
          color: #001d34 !important;
        }
        .membros-light-page > .relative.overflow-hidden {
          background: #ffffff !important;
          border-bottom-color: rgba(215, 187, 125, 0.35) !important;
          min-height: 180px !important;
        }
        .membros-light-page > .relative.overflow-hidden .absolute.inset-0,
        .membros-light-page > .relative.overflow-hidden .rounded-full,
        .membros-light-page > .relative.overflow-hidden .h-px {
          opacity: 0.35;
        }
        .membros-light-page [class*="text-white"] {
          color: #475569 !important;
        }
        .membros-light-page h1,
        .membros-light-page h2,
        .membros-light-page h3,
        .membros-light-page .font-bold {
          color: #001d34 !important;
        }
        .membros-light-page [class*="text-brand-gold"] {
          color: #9a7430 !important;
        }
        .membros-light-page h1.text-brand-gold,
        .membros-light-page h1 {
          color: #000000 !important;
        }
        .membros-light-page .sticky {
          background: rgba(255, 255, 255, 0.96) !important;
          border-bottom-color: rgba(215, 187, 125, 0.35) !important;
        }
        .membros-light-page .sticky input,
        .membros-light-page .sticky button[role="combobox"] {
          background: #ffffff !important;
          border-color: #d8dee8 !important;
          color: #001d34 !important;
          font-family: inherit !important;
          letter-spacing: 0 !important;
        }
        .membros-light-page .sticky input::placeholder {
          color: #94a3b8 !important;
        }
        .membros-light-page .sticky .font-mono,
        .membros-light-page .sticky button,
        .membros-light-page .sticky input {
          font-family: inherit !important;
          letter-spacing: 0 !important;
        }
        .membros-light-page .inline-flex.items-center.rounded-lg {
          background: #ffffff !important;
          border-color: rgba(215, 187, 125, 0.35) !important;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06) !important;
        }
        .membros-light-page .inline-flex.items-center.rounded-lg .font-mono {
          color: #9a7430 !important;
          font-family: inherit !important;
        }
        .membros-light-page .inline-flex.items-center.rounded-lg [class*="uppercase"] {
          color: #64748b !important;
          letter-spacing: 0 !important;
        }
        .membros-light-page [data-testid^="card-membro-"] {
          background: linear-gradient(135deg, #06182a 0%, #03111f 100%) !important;
          border-color: rgba(215, 187, 125, 0.35) !important;
          box-shadow: 0 12px 28px rgba(3, 17, 31, 0.18) !important;
        }
        .membros-light-page [data-testid^="card-membro-"] [class*="text-white"] {
          color: rgba(226, 232, 240, 0.72) !important;
        }
        .membros-light-page [data-testid^="card-membro-"] h3 {
          color: #ffffff !important;
        }
        .membros-light-page [data-testid^="card-membro-"] a,
        .membros-light-page [data-testid^="card-membro-"] span,
        .membros-light-page [data-testid^="card-membro-"] p {
          color: rgba(226, 232, 240, 0.72) !important;
        }
        .membros-light-page [data-testid^="card-membro-"] .font-mono {
          color: rgba(215, 187, 125, 0.72) !important;
        }
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
            <span className="text-xs text-brand-gold/60 uppercase">
              BUILT ALLIANCES // REDE DE PROFISSIONAIS
            </span>
          </div>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-gold/70 text-brand-navy">
              <Users className="h-5 w-5" />
            </div>
            <h1
              className="text-3xl font-bold text-brand-navy"
            >
              Administração
            </h1>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            {isLoading ?"Carregando perfis..." : `${membros.length} nós ativos na rede`}
          </p>
          <div className="inline-flex items-center rounded-lg border border-brand-gold/10 py-3" style={{ background: "rgba(0,10,20,0.6)", backdropFilter: "blur(8px)" }}>
            <StatItem label="Cadastros" value={stats.total} icon={Users} />
            <StatItem label="Empresas" value={stats.empresas} icon={Building2} />
            <StatItem label="Estados" value={stats.estados} icon={Globe} />
            <StatItem label="Especialidades" value={stats.especialidades} icon={Activity} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setAdminTab("cadastro")}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              adminTab === "cadastro" ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-brand-navy"
            }`}
            data-testid="tab-admin-cadastro-geral"
          >
            <Users className="h-4 w-4" />
            Cadastro Geral
          </button>
          <button
            type="button"
            onClick={() => setAdminTab("configuracoes")}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              adminTab === "configuracoes" ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-brand-navy"
            }`}
            data-testid="tab-admin-configuracoes"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </button>
        </div>
      </div>

      {adminTab === "configuracoes" ? (
        <div className="p-6">
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Settings className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-brand-navy">Configurações</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Esta área ainda está em desenvolvimento.
            </p>
          </div>
        </div>
      ) : (
      <div>
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
          <Select value={filterEspecialidade || "__all__"} onValueChange={v => setFilterEspecialidade(v === "__all__" ?"" : v)}>
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
          <Select value={filterEstado || "__all__"} onValueChange={v => setFilterEstado(v === "__all__" ?"" : v)}>
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
          <Select value={filterTipoCadastro || "__all__"} onValueChange={v => setFilterTipoCadastro(v === "__all__" ?"" : v)}>
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

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono text-white/25 hidden sm:block">
            {filtered.length} / {membros.length} nós
          </span>
          <button
            onClick={() => setEditingMembro({} as Membro)}
            className="h-8 px-3 text-xs rounded-md flex items-center gap-1.5 font-mono transition-colors border border-blue-700 bg-blue-600 !text-white hover:bg-blue-700 [&_*]:!text-white"
            style={{ color: "#FFFFFF" }}
            data-testid="btn-novo-membro"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="!text-white" style={{ color: "#FFFFFF" }}>Novo Membro</span>
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="p-6">
        {isLoading ?(
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
        ) : filtered.length === 0 ?(
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <Cpu className="w-16 h-16 text-white/10" />
              <Wifi className="w-6 h-6 text-brand-gold/20 absolute -top-1 -right-1" />
            </div>
            <p className="text-white/30 font-mono text-sm">
              {hasFilters ?"// nenhum nó encontrado para os filtros aplicados" : "// rede vazia"}
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
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      </div>
      )}

      {/* Edit Sheet */}
      {editingMembro && (
        <MembroEditSheet
          membro={editingMembro}
          onClose={() => setEditingMembro(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai remover o cadastro de <strong>{deleteTarget ?getDisplayNome(deleteTarget) : ""}</strong> do Cadastro Geral. Confirme apenas se tiver certeza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget?.id) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="btn-confirmar-excluir-membro"
            >
              {deleteMutation.isPending ?(
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</>
              ) : (
                "Excluir membro"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
