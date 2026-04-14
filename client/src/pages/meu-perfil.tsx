import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  User, Mail, Phone, MapPin, Building2, Briefcase,
  Save, Loader2, Camera, CheckCircle2, Plus, Globe
} from "lucide-react";

interface EspecialidadeOption {
  id: string;
  nome_especialidade: string;
}

const REDES_DISPONIVEIS = [
  { value: "BNI", label: "BNI", badge: "/bni-badge.png" },
];

const NUCLEOS_TIPOS: Record<string, string[]> = {
  "Diretoria da Aliança": ["Diretor de Aliança", "Aliado BUILT", "Diretor de Execução", "Diretor Comercial", "Diretor de Capital"],
  "Núcleo Técnico": ["Alianças de Projetos", "Alianças Jurídicas", "Alianças de Inteligência", "Alianças de Governança"],
  "Núcleo de Obra": ["Construção Civil", "Infraestrutura", "Reforma", "Manutenção"],
  "Núcleo Comercial": ["Vendas", "Marketing", "Parcerias", "Prospecção"],
  "Núcleo de Capital": ["Financeiro", "Resultados", "Investimentos"],
};

interface Membro {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  empresa?: string;
  cargo?: string;
  especialidade?: string;
  especialidade_id?: string | null;
  foto?: string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  tipo_alianca?: string;
  tipo_de_cadastro?: string;
  na_vitrine?: boolean;
  em_membros_built?: boolean;
  em_built_capital?: boolean;
  link_site?: string;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=200&height=200&fit=cover`;
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function MeuPerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);

  const membroId = user?.membro_directus_id;

  const { data: membro, isLoading } = useQuery<Membro>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  const [form, setForm] = useState<Partial<Membro>>({});
  const [newEspOpen, setNewEspOpen] = useState(false);
  const [newEspNome, setNewEspNome] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (membro) setForm(membro);
  }, [membro]);

  const { data: especialidadesOptions = [] } = useQuery<EspecialidadeOption[]>({
    queryKey: ["/api/especialidades"],
    queryFn: () => fetch("/api/especialidades").then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Membro>) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const createEspMutation = useMutation({
    mutationFn: (nome: string) =>
      apiRequest("POST", "/api/especialidades", { nome_especialidade: nome }),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/especialidades"] });
      setForm(f => ({ ...f, especialidade_id: data.id, especialidade: data.nome_especialidade }));
      setNewEspNome("");
      setNewEspOpen(false);
      toast({ title: "Especialidade criada e selecionada!" });
    },
    onError: () => toast({ title: "Erro ao criar especialidade", variant: "destructive" }),
  });

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !membroId) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload falhou");
      const uuid = json.fileIds[0];
      await apiRequest("PATCH", `/api/membros/${membroId}`, { foto_perfil: uuid });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      toast({ title: "Foto de perfil atualizada!" });
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }
  }

  function set(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSave() {
    const { id, especialidade_id, especialidade, ...rest } = form as Membro;
    const payload: Record<string, any> = { ...rest };
    // Send Especialidades as Directus M2M array
    payload.Especialidades = especialidade_id
      ? [{ especialidades_id: especialidade_id }]
      : [];
    updateMutation.mutate(payload as any);
  }

  if (!membroId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020b16" }}>
        <div className="text-center space-y-3">
          <User className="w-16 h-16 text-white/10 mx-auto" />
          <p className="text-white/40 font-mono text-sm">
            // seu usuário não está vinculado a um cadastro
          </p>
          <p className="text-white/25 text-xs">Peça ao administrador para vincular seu perfil.</p>
        </div>
      </div>
    );
  }

  const foto = fotoUrl(membro?.foto);
  const nome = form.nome || membro?.nome || user?.nome || "";

  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10 px-6 py-8"
        style={{ background: "radial-gradient(ellipse at 20% 50%, #001225 0%, #000c1f 40%, #020b16 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40" />

        <div className="relative z-10 flex items-center gap-6">
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
              className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-brand-gold/30 flex items-center justify-center group/avatar cursor-pointer"
              style={{ background: "radial-gradient(circle at 30% 30%, #D7BB7D20, #030812)", boxShadow: "0 0 24px rgba(215,187,125,0.15)" }}
              title="Clique para trocar a foto"
              data-testid="btn-trocar-foto"
            >
              {uploadingFoto ? (
                <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
              ) : foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
              )}
              {/* Hover overlay */}
              {!uploadingFoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </button>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#020b16] border border-brand-gold/30 flex items-center justify-center pointer-events-none">
              {uploadingFoto
                ? <Loader2 className="w-3 h-3 text-brand-gold animate-spin" />
                : <Camera className="w-3 h-3 text-brand-gold/50" />
              }
            </div>
          </div>

          <div>
            <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.35em] uppercase mb-1">
              // MEU PERFIL
            </p>
            <h1 className="text-2xl font-bold text-brand-gold font-mono">{nome || "—"}</h1>
            {(form.especialidade || form.cargo) && (
              <p className="text-sm text-white/40 mt-0.5">{form.especialidade || form.cargo}</p>
            )}
            {form.empresa && (
              <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" />{form.empresa}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 bg-white/5" />)}
          </div>
        ) : (
          <>
            {/* Dados pessoais */}
            <Card className="border-white/5" style={{ background: "#050f1c" }}>
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
                  <Field label="E-mail">
                    <Input
                      value={form.email || ""}
                      onChange={e => set("email", e.target.value)}
                      type="email"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-email"
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={form.telefone || ""}
                      onChange={e => set("telefone", e.target.value)}
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
            <Card className="border-white/5" style={{ background: "#050f1c" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={MapPin} label="Localização" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Cidade">
                    <Input
                      value={form.cidade || ""}
                      onChange={e => set("cidade", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cidade"
                    />
                  </Field>
                  <Field label="Estado (UF)">
                    <Input
                      value={form.estado || ""}
                      onChange={e => set("estado", e.target.value)}
                      maxLength={2}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 uppercase"
                      data-testid="input-perfil-estado"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Profissional */}
            <Card className="border-white/5" style={{ background: "#050f1c" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={Briefcase} label="Perfil Profissional" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Empresa">
                    <Input
                      value={form.empresa || ""}
                      onChange={e => set("empresa", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-empresa"
                    />
                  </Field>
                  <Field label="Ramo de atuação">
                    <Select
                      value={form.especialidade_id || ""}
                      onValueChange={v => {
                        const found = especialidadesOptions.find(e => e.id === v);
                        setForm(f => ({ ...f, especialidade_id: v, especialidade: found?.nome_especialidade || "" }));
                      }}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                        data-testid="select-perfil-especialidade"
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
                    {!form.especialidade_id && (
                      <button
                        type="button"
                        onClick={() => { setNewEspNome(""); setNewEspOpen(true); }}
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-brand-gold/60 hover:text-brand-gold transition-colors"
                        data-testid="btn-perfil-criar-especialidade"
                      >
                        <Plus className="w-3 h-3" />
                        Não encontrou? Criar nova especialidade
                      </button>
                    )}
                  </Field>

                  {/* Sub-dialog: criar nova especialidade */}
                  <Dialog open={newEspOpen} onOpenChange={setNewEspOpen}>
                    <DialogContent
                      className="border-brand-gold/20 text-white max-w-sm"
                      style={{ background: "#001428" }}
                    >
                      <DialogHeader>
                        <DialogTitle className="font-mono text-brand-gold">Novo Ramo de Atuação</DialogTitle>
                      </DialogHeader>
                      <div className="py-2">
                        <Label className="text-xs font-mono text-white/50 mb-1.5 block">Nome *</Label>
                        <Input
                          value={newEspNome}
                          onChange={e => setNewEspNome(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && newEspNome.trim()) {
                              createEspMutation.mutate(newEspNome.trim());
                            }
                          }}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                          placeholder="Ex: Gestão de contratos"
                          autoFocus
                          data-testid="input-perfil-nova-especialidade"
                        />
                      </div>
                      <DialogFooter className="gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setNewEspOpen(false)}
                          className="text-white/50 hover:text-white"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => createEspMutation.mutate(newEspNome.trim())}
                          disabled={!newEspNome.trim() || createEspMutation.isPending}
                          className="font-mono"
                          style={{ background: "#D7BB7D", color: "#001D34" }}
                          data-testid="btn-perfil-confirmar-nova-especialidade"
                        >
                          {createEspMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Criar e selecionar
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Field label="Cargo">
                    <Input
                      value={form.cargo || ""}
                      onChange={e => set("cargo", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cargo"
                    />
                  </Field>
                  <Field label="Núcleo de Aliança">
                    <Select
                      value={form.nucleo_alianca || undefined}
                      onValueChange={v => setForm(f => ({ ...f, nucleo_alianca: v, tipo_alianca: "" }))}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                        data-testid="select-perfil-nucleo"
                      >
                        <SelectValue placeholder="Selecionar núcleo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                        {Object.keys(NUCLEOS_TIPOS).map(n => (
                          <SelectItem key={n} value={n} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {form.nucleo_alianca && NUCLEOS_TIPOS[form.nucleo_alianca] && (
                    <Field label="Tipo / Área">
                      <Select
                        value={form.tipo_alianca || undefined}
                        onValueChange={v => setForm(f => ({ ...f, tipo_alianca: v }))}
                      >
                        <SelectTrigger
                          className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                          data-testid="select-perfil-tipo-alianca"
                        >
                          <SelectValue placeholder="Selecionar tipo..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                          {NUCLEOS_TIPOS[form.nucleo_alianca].map(t => (
                            <SelectItem key={t} value={t} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
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
                <Field label="Perfil como aliado">
                  <Textarea
                    value={form.perfil_aliado || ""}
                    onChange={e => set("perfil_aliado", e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                    data-testid="input-perfil-aliado"
                  />
                </Field>

                {/* Redes de Negócios */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40 font-mono">Outras redes de negócios</Label>
                  <div className="flex flex-wrap gap-3">
                    {REDES_DISPONIVEIS.map(rede => {
                      const redes = form.Outras_redes_as_quais_pertenco || [];
                      const selected = redes.includes(rede.value);
                      return (
                        <button
                          key={rede.value}
                          type="button"
                          onClick={() => {
                            const current = form.Outras_redes_as_quais_pertenco || [];
                            setForm(f => ({
                              ...f,
                              Outras_redes_as_quais_pertenco: selected
                                ? current.filter(r => r !== rede.value)
                                : [...current, rede.value],
                            }));
                          }}
                          data-testid={`btn-rede-${rede.value.toLowerCase()}`}
                          className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                          style={{
                            background: selected ? "rgba(215,187,125,0.1)" : "rgba(255,255,255,0.03)",
                            borderColor: selected ? "rgba(215,187,125,0.4)" : "rgba(255,255,255,0.08)",
                            boxShadow: selected ? "0 0 12px rgba(215,187,125,0.1)" : "none",
                          }}
                        >
                          <img
                            src={rede.badge}
                            alt={rede.label}
                            className="h-10 w-auto object-contain rounded"
                            style={{ opacity: selected ? 1 : 0.4, filter: selected ? "none" : "grayscale(0.5)" }}
                          />
                          {selected && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "#D7BB7D" }}>
                              <CheckCircle2 className="w-3 h-3 text-[#001D34]" />
                            </span>
                          )}
                          <span className="text-[10px] font-mono" style={{ color: selected ? "#D7BB7D" : "rgba(255,255,255,0.3)" }}>
                            {rede.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/20 font-mono">
                    Selecione as redes de negócios das quais você é membro. Os selos aparecerão no seu perfil.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="gap-2 px-6"
                style={{
                  background: saved ? "rgba(74,222,128,0.15)" : "linear-gradient(135deg, #D7BB7D, #b89a50)",
                  color: saved ? "#4ade80" : "#001D34",
                  border: saved ? "1px solid rgba(74,222,128,0.3)" : "none",
                }}
                data-testid="btn-salvar-perfil"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saved ? "Salvo!" : updateMutation.isPending ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-3.5 h-3.5 text-brand-gold/50" />
      <span className="text-xs font-mono uppercase tracking-widest text-white/30">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
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
