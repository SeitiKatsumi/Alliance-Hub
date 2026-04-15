import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, MapPin, Phone, Mail, Building2, Briefcase,
  User, Globe, MessageSquare, Store, ExternalLink
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const REDE_BADGES: Record<string, { img: string; label: string }> = {
  BNI: { img: "/bni-badge.png", label: "Membro BNI" },
};

interface MembroDetalhe {
  id: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  nome_fantasia?: string;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  especialidade?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  whatsapp?: string;
  whatsapp_e164?: string;
  email?: string;
  site?: string;
  link_site?: string;
  instagram?: string;
  foto_perfil?: string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  na_vitrine?: boolean;
  Especialidades?: { Especialidade_id?: { nome?: string } }[];
  Outras_redes_as_quais_pertenco?: string[] | null;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=400&height=400&fit=cover`;
}

function whatsappLink(w?: string): string | null {
  if (!w) return null;
  const digits = w.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
}

function InfoRow({ icon: Icon, label, value, href }: {
  icon: any; label: string; value?: string | null; href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(215,187,125,0.06)" }}>
        <Icon className="w-3.5 h-3.5 text-brand-gold/50" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-gold/80 hover:text-brand-gold transition-colors flex items-center gap-1 mt-0.5 font-mono break-all"
          >
            {value}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm text-white/70 mt-0.5 font-mono break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function VitrineDetalhePage() {
  const { id } = useParams<{ id: string }>();

  const { data: membro, isLoading } = useQuery<MembroDetalhe>({
    queryKey: ["/api/membros", id],
    queryFn: () => fetch(`/api/membros/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const foto = fotoUrl(membro?.foto_perfil);
  const nome = membro?.nome || "—";
  const cargo = membro?.cargo || membro?.responsavel_cargo || null;
  const empresa = membro?.empresa || membro?.nome_fantasia || null;
  const wa = whatsappLink(membro?.whatsapp || membro?.whatsapp_e164);
  const especialidades = (membro?.Especialidades || [])
    .map(e => e?.Especialidade_id?.nome)
    .filter(Boolean) as string[];
  const redes = (membro?.Outras_redes_as_quais_pertenco || []).filter(r => REDE_BADGES[r]);
  const localidade = [membro?.cidade, membro?.estado?.toUpperCase(), membro?.pais]
    .filter(Boolean).join(", ");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-32 bg-gray-100" />
          <Skeleton className="h-48 rounded-2xl bg-gray-100" />
          <Skeleton className="h-64 rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!membro || membro.na_vitrine === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Store className="w-12 h-12 text-gray-200 mx-auto" />
          <p className="text-gray-400 font-mono text-sm">Perfil não encontrado na Vitrine</p>
          <Link href="/vitrine">
            <Button variant="outline" size="sm" className="border-gray-200 text-gray-400 hover:text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Back nav */}
      <div className="px-6 pt-5 pb-2">
        <Link href="/vitrine">
          <button
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors"
            data-testid="btn-back-vitrine"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar à Vitrine
          </button>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-10 space-y-5">
        {/* Hero card */}
        <div
          className="relative rounded-2xl overflow-hidden border border-white/6"
          style={{ background: "linear-gradient(145deg, #071626, #040e1c)" }}
        >
          {/* Top gold line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.5), transparent)" }} />
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-gold/30" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-gold/30" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-gold/10" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-gold/10" />

          {/* Grid bg */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{
            backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />

          <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden border-2 border-brand-gold/25"
              style={{
                background: foto ? "transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))",
                boxShadow: "0 0 32px rgba(215,187,125,0.12)",
              }}
            >
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
              )}
            </div>

            {/* Name & info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase mb-1">
                // Vitrine BUILT
              </p>
              <h1 className="text-2xl font-bold font-mono text-white leading-tight">{nome}</h1>

              {(cargo || empresa) && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  {cargo && (
                    <span className="flex items-center gap-1.5 text-sm text-white/50">
                      <Briefcase className="w-3.5 h-3.5 text-brand-gold/40" />
                      {cargo}
                    </span>
                  )}
                  {cargo && empresa && <span className="text-white/20">·</span>}
                  {empresa && (
                    <span className="flex items-center gap-1.5 text-sm text-white/50">
                      <Building2 className="w-3.5 h-3.5 text-brand-gold/40" />
                      {empresa}
                    </span>
                  )}
                </div>
              )}

              {localidade && (
                <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-white/35 mt-2 font-mono">
                  <MapPin className="w-3 h-3 text-brand-gold/30" />
                  {localidade}
                </p>
              )}

              {/* Especialidades badges */}
              {especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                  {especialidades.map(esp => (
                    <Badge
                      key={esp}
                      variant="outline"
                      className="text-[10px] font-mono border-brand-gold/20 text-brand-gold/50 bg-brand-gold/5"
                    >
                      {esp}
                    </Badge>
                  ))}
                </div>
              )}

              {membro.nucleo_alianca && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-white/10 text-white/30 bg-transparent mt-2"
                >
                  {membro.nucleo_alianca}
                </Badge>
              )}

              {/* Selos de redes de negócios */}
              {redes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                  {redes.map(rede => (
                    <img
                      key={rede}
                      src={REDE_BADGES[rede].img}
                      alt={REDE_BADGES[rede].label}
                      title={REDE_BADGES[rede].label}
                      className="h-10 w-auto object-contain rounded"
                      data-testid={`badge-rede-${rede.toLowerCase()}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="relative z-10 px-6 sm:px-8 pb-6 flex flex-wrap gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono transition-all"
                style={{
                  background: "linear-gradient(135deg, #D7BB7D, #b89a50)",
                  color: "#001D34",
                  fontWeight: 600,
                }}
                data-testid="btn-whatsapp-detalhe"
              >
                <Phone className="w-4 h-4" />
                Falar pelo WhatsApp
              </a>
            )}
            {membro.email && (
              <a
                href={`mailto:${membro.email}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all"
                style={{ background: "rgba(255,255,255,0.04)" }}
                data-testid="btn-email-detalhe"
              >
                <Mail className="w-4 h-4" />
                Enviar e-mail
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Contact / info panel */}
          <div
            className="rounded-2xl border border-white/6 p-5"
            style={{ background: "linear-gradient(145deg, #071626, #040e1c)" }}
          >
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User className="w-3 h-3 text-brand-gold/40" />
              Contato & Localização
            </p>
            <div>
              <InfoRow icon={Phone} label="WhatsApp" value={membro.whatsapp || membro.whatsapp_e164} href={wa || undefined} />
              <InfoRow icon={Mail} label="E-mail" value={membro.email} href={membro.email ? `mailto:${membro.email}` : undefined} />
              <InfoRow icon={MapPin} label="Localização" value={localidade || null} />
              {(membro.link_site || membro.site) && (() => {
                const site = membro.link_site || membro.site!;
                return <InfoRow icon={Globe} label="Site" value={site.replace(/^https?:\/\/(www\.)?/, "")} href={site.startsWith("http") ? site : `https://${site}`} />;
              })()}
              {membro.instagram && (
                <InfoRow
                  icon={ExternalLink}
                  label="Instagram"
                  value={membro.instagram}
                  href={`https://instagram.com/${membro.instagram.replace("@", "")}`}
                />
              )}
            </div>
          </div>

          {/* Perfil / bio panel */}
          {membro.perfil_aliado && (
            <div
              className="rounded-2xl border border-white/6 p-5"
              style={{ background: "linear-gradient(145deg, #071626, #040e1c)" }}
            >
              <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-brand-gold/40" />
                Perfil / Descrição
              </p>
              <p className="text-sm text-white/55 leading-relaxed font-mono whitespace-pre-wrap">
                {membro.perfil_aliado}
              </p>
            </div>
          )}
        </div>

        {/* Bottom metadata */}
        <div
          className="rounded-2xl border border-gray-100 px-5 py-4 flex flex-wrap items-center gap-4 bg-gray-50"
        >
          <Store className="w-3.5 h-3.5 text-brand-gold/50" />
          <span className="text-xs font-mono text-gray-400">Perfil público na Vitrine BUILT</span>
          <div className="flex-1" />
          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/60 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-400">Ativo</span>
        </div>
      </div>
    </div>
  );
}
