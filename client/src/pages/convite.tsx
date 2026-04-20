import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Users, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConviteData {
  id: string;
  token: string;
  status: string;
  candidato_nome?: string;
  candidato_email?: string;
  comunidade?: {
    id: string;
    nome?: string;
    sigla?: string;
    pais?: string;
    territorio?: string;
    aliado?: { id: string; nome?: string; foto_perfil?: string | null };
  };
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=80&height=80&fit=cover`;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    nome_completo: "",
    cpf_cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
    cidade: "",
    estado: "",
    pais: "Brasil",
    mensagem: "",
  });

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const candidaturaMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await fetch(`/api/convites/${token}/candidatura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Erro ao enviar candidatura");
      return r.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (error || !convite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Convite não encontrado</h2>
          <p className="text-white/50 text-sm font-mono">Este link pode ter expirado ou sido removido.</p>
        </div>
      </div>
    );
  }

  const jaProcessado = !["convidado"].includes(convite.status);

  if (submitted || (jaProcessado && convite.status !== "convidado")) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">
            {submitted ? "Candidatura enviada!" : "Candidatura já processada"}
          </h2>
          <p className="text-white/60 text-sm font-mono leading-relaxed">
            {submitted
              ? "Seu formulário foi recebido. O Aliado BUILT da comunidade irá analisar sua candidatura e você receberá uma resposta por e-mail."
              : "Sua candidatura para esta comunidade já foi registrada anteriormente."}
          </p>
        </div>
      </div>
    );
  }

  const aliado = convite.comunidade?.aliado;
  const aliadoFoto = fotoUrl(aliado?.foto_perfil);

  return (
    <div className="min-h-screen" style={{ background: "#001D34" }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Header brand */}
        <div className="text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Convite para Comunidade</h1>
        </div>

        {/* Comunidade card */}
        <div
          className="rounded-2xl p-6 border border-brand-gold/20"
          style={{ background: "rgba(215,187,125,0.05)" }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-brand-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Comunidade</p>
              <h2 className="text-lg font-bold font-mono text-white mt-0.5">{convite.comunidade?.nome || "—"}</h2>
              {(convite.comunidade?.pais || convite.comunidade?.territorio) && (
                <p className="text-sm font-mono text-white/50 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[convite.comunidade?.territorio, convite.comunidade?.pais].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          {aliado && (
            <div className="mt-4 pt-4 border-t border-brand-gold/10 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full border border-brand-gold/20 overflow-hidden flex items-center justify-center shrink-0"
                style={{ background: "rgba(215,187,125,0.1)" }}
              >
                {aliadoFoto
                  ? <img src={aliadoFoto} alt={aliado.nome} className="w-full h-full object-cover" />
                  : <span className="text-xs font-mono font-bold text-brand-gold">{getInitials(aliado.nome)}</span>
                }
              </div>
              <div>
                <p className="text-[10px] font-mono text-brand-gold/40 uppercase tracking-widest">Aliado BUILT</p>
                <p className="text-sm font-mono text-white/80">{aliado.nome}</p>
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
          <h3 className="text-sm font-bold font-mono text-white mb-4">Dados para Candidatura</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">Nome Completo *</Label>
                <Input
                  value={form.nome_completo}
                  onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="Seu nome completo"
                  data-testid="input-convite-nome"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">CPF / CNPJ *</Label>
                <Input
                  value={form.cpf_cnpj}
                  onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="000.000.000-00"
                  data-testid="input-convite-cpf"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">Telefone *</Label>
                <Input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="+55 11 99999-9999"
                  data-testid="input-convite-telefone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">E-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="seu@email.com"
                  data-testid="input-convite-email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-white/60">Endereço</Label>
              <Input
                value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                placeholder="Rua, número, complemento"
                data-testid="input-convite-endereco"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">Cidade</Label>
                <Input
                  value={form.cidade}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="São Paulo"
                  data-testid="input-convite-cidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">Estado</Label>
                <Input
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="SP"
                  data-testid="input-convite-estado"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-white/60">País</Label>
                <Input
                  value={form.pais}
                  onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
                  placeholder="Brasil"
                  data-testid="input-convite-pais"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-white/60">Mensagem (opcional)</Label>
              <textarea
                value={form.mensagem}
                onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/20 font-mono text-sm rounded-lg p-3 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
                placeholder="Escreva uma mensagem sobre seu interesse na comunidade..."
                data-testid="textarea-convite-mensagem"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            if (!form.nome_completo || !form.cpf_cnpj || !form.telefone || !form.email) {
              alert("Preencha os campos obrigatórios: Nome, CPF/CNPJ, Telefone e E-mail.");
              return;
            }
            candidaturaMutation.mutate(form);
          }}
          disabled={candidaturaMutation.isPending}
          className="w-full h-12 font-mono font-bold text-sm"
          style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
          data-testid="btn-enviar-candidatura"
        >
          {candidaturaMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Enviar Candidatura
        </Button>
        {candidaturaMutation.isError && (
          <p className="text-red-400 text-xs font-mono text-center">Erro ao enviar candidatura. Tente novamente.</p>
        )}
      </div>
    </div>
  );
}
