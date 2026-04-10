import { useState, useEffect } from "react";
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
  User, Mail, Phone, MapPin, Building2, Briefcase,
  Save, Loader2, Camera, CheckCircle2
} from "lucide-react";

const DIRECTUS_URL = "https://app.builtalliances.com";

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
  foto?: string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  tipo_de_cadastro?: string;
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

  useEffect(() => {
    if (membro) setForm(membro);
  }, [membro]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Membro>) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  function set(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSave() {
    const { id, ...rest } = form as Membro;
    updateMutation.mutate(rest);
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
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-brand-gold/30 flex items-center justify-center"
              style={{ background: "radial-gradient(circle at 30% 30%, #D7BB7D20, #030812)", boxShadow: "0 0 24px rgba(215,187,125,0.15)" }}>
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#020b16] border border-brand-gold/30 flex items-center justify-center">
              <Camera className="w-3 h-3 text-brand-gold/50" />
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
                  <Field label="Especialidade">
                    <Input
                      value={form.especialidade || ""}
                      onChange={e => set("especialidade", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-especialidade"
                    />
                  </Field>
                  <Field label="Cargo">
                    <Input
                      value={form.cargo || ""}
                      onChange={e => set("cargo", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cargo"
                    />
                  </Field>
                  <Field label="Núcleo de Aliança">
                    <Input
                      value={form.nucleo_alianca || ""}
                      onChange={e => set("nucleo_alianca", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-nucleo"
                    />
                  </Field>
                </div>
                <Field label="Perfil como aliado">
                  <Textarea
                    value={form.perfil_aliado || ""}
                    onChange={e => set("perfil_aliado", e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                    data-testid="input-perfil-aliado"
                  />
                </Field>
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
