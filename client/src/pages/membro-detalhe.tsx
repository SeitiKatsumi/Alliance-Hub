import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, MapPin, Phone, Mail, Building2, Briefcase,
  User, Globe, MessageSquare, Shield, ExternalLink, Languages, MessageCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const REDE_BADGES: Record<string, { img: string; label: string }> = {
  BUILT_PROUD_MEMBER: { img: "/built-proud-member.png", label: "BUILT Proud Member" },
  BUILT_FOUNDING_MEMBER: { img: "/built-founding-member.png", label: "BUILT Founding Member" },
  BNI: { img: "/bni-badge.png", label: "Membro BNI" },
};
const REDE_ORDER = ["BUILT_PROUD_MEMBER", "BUILT_FOUNDING_MEMBER", "BNI"];

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
  tipo_alianca?: string;
  Especialidades?: { especialidades_id?: { nome_especialidade?: string } }[];
  Outras_redes_as_quais_pertenco?: string[] | null;
  logo_empresa?: string | null;
  especialidade_livre?: string | null;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  idiomas?: string[] | null;
  nucleos_alianca?: string[] | null;
  tipos_alianca?: string[] | null;
  tipo_de_cadastro?: string | null;
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
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 bg-amber-50">
        <Icon className="w-3.5 h-3.5 text-brand-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-gold hover:text-amber-600 transition-colors flex items-center gap-1 mt-0.5 font-mono break-all"
          >
            {value}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm text-gray-800 mt-0.5 font-mono break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

interface Comunidade {
  id: string;
  nome?: string;
  sigla?: string;
  pais?: string;
  territorio?: string;
  status?: string;
  // M2O — Directus expands aliado as an object when fields are requested
  aliado?: { id: string; nome?: string } | string | null;
  // M2M — junction arrays from Directus
  membros?: Array<{ cadastro_geral_id: { id: string; nome?: string } | string | null }>;
  bias?: Array<{ bias_projetos_id: { id: string; nome_bia?: string } | string | null }>;
}

function getAliadoNome(c: Comunidade): string | null {
  if (!c.aliado) return null;
  if (typeof c.aliado === "string") return null;
  return (c.aliado as { id: string; nome?: string }).nome || null;
}
function getMembrosCount(c: Comunidade): number {
  return Array.isArray(c.membros) ? c.membros.length : 0;
}
function getBiasCount(c: Comunidade): number {
  return Array.isArray(c.bias) ? c.bias.length : 0;
}

export default function MembroDetalhePage() {
  const { id } = useParams<{ id: string }>();

  const { data: membro, isLoading } = useQuery<MembroDetalhe>({
    queryKey: ["/api/membros", id],
    queryFn: () => fetch(`/api/membros/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: comunidades = [] } = useQuery<Comunidade[]>({
    queryKey: ["/api/comunidades", { membro_id: id }],
    queryFn: () => fetch(`/api/comunidades?membro_id=${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const foto = fotoUrl(membro?.foto_perfil);
  const nome = membro?.nome || "—";
  const cargo = membro?.cargo || membro?.responsavel_cargo || null;
  const empresa = membro?.empresa || membro?.nome_fantasia || null;
  const wa = whatsappLink(membro?.whatsapp || membro?.whatsapp_e164);
  const especialidades = (membro?.Especialidades || [])
    .map(e => e?.especialidades_id?.nome_especialidade)
    .filter(Boolean) as string[];
  const redes = REDE_ORDER.filter(r => (membro?.Outras_redes_as_quais_pertenco || []).includes(r) && REDE_BADGES[r]);
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

  if (!membro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-gray-200 mx-auto" />
          <p className="text-gray-400 font-mono text-sm">Membro não encontrado</p>
          <Link href="/area-membros">
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
        <Link href="/area-membros">
          <button
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors"
            data-testid="btn-back-membros"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar aos Membros BUILT
          </button>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-10 space-y-5">
        {/* Hero card */}
        <div
          className="relative rounded-2xl overflow-hidden border border-white/6"
          style={{ background: "linear-gradient(145deg, #071626, #040e1c)" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.5), transparent)" }} />
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-gold/30" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-gold/30" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-gold/10" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-gold/10" />
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

            {/* Nome + selos */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase mb-1">
                // Membros BUILT
              </p>
              <h1 className="text-2xl font-bold font-mono text-white leading-tight">{nome}</h1>

              {redes.length > 0 && (
                <div className="flex flex-wrap gap-2 items-end justify-center sm:justify-start mt-4">
                  {redes.map(rede => (
                    <img
                      key={rede}
                      src={REDE_BADGES[rede].img}
                      alt={REDE_BADGES[rede].label}
                      title={REDE_BADGES[rede].label}
                      className="w-auto object-contain rounded"
                      style={{ height: rede === "BUILT_PROUD_MEMBER" ? 64 : 40 }}
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
                style={{ background: "linear-gradient(135deg, #D7BB7D, #b89a50)", color: "#001D34", fontWeight: 600 }}
                data-testid="btn-whatsapp-membro"
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
                data-testid="btn-email-membro"
              >
                <Mail className="w-4 h-4" />
                Enviar e-mail
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Contato */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User className="w-3 h-3 text-brand-gold" />
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
                <InfoRow icon={ExternalLink} label="Instagram" value={membro.instagram}
                  href={`https://instagram.com/${membro.instagram.replace("@", "")}`} />
              )}
            </div>
          </div>

          {/* Perfil Profissional */}
          {membro.perfil_aliado && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-brand-gold" />
                Perfil Profissional
              </p>
              <p className="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap break-words">
                {membro.perfil_aliado}
              </p>
            </div>
          )}
        </div>

        {/* Perfil Profissional */}
        {(membro.logo_empresa || empresa || cargo || membro.especialidade_livre || especialidades.length > 0 || membro.nucleo_alianca || membro.tipo_alianca || (membro.nucleos_alianca || []).length > 0 || (membro.tipos_alianca || []).length > 0 || (membro.idiomas || []).length > 0) && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Briefcase className="w-3 h-3 text-brand-gold" />
              Perfil Profissional
            </p>
            <div className="flex items-start gap-5">
              {membro.logo_empresa && (
                <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden" data-testid="img-logo-empresa-membro">
                  <img src={`/api/assets/${membro.logo_empresa}?width=128&height=128&fit=contain`} alt={empresa || "Logo"} className="w-full h-full object-contain p-1.5" />
                </div>
              )}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {empresa && (
                    <div>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">Empresa</p>
                      <p className="text-sm text-gray-800 font-mono flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand-gold/60 shrink-0" />{empresa}
                      </p>
                    </div>
                  )}
                  {cargo && (
                    <div>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">Cargo</p>
                      <p className="text-sm text-gray-800 font-mono flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-brand-gold/60 shrink-0" />{cargo}
                      </p>
                    </div>
                  )}
                </div>

                {(membro.ramo_atuacao || especialidades.length > 0 || membro.segmento || membro.especialidade_livre) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(membro.ramo_atuacao || especialidades.length > 0) && (
                      <div>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">Ramo de Atuação</p>
                        <p className="text-sm text-gray-800 font-mono">{membro.ramo_atuacao || especialidades[0]}</p>
                      </div>
                    )}
                    {membro.segmento && (
                      <div>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">Segmento</p>
                        <p className="text-sm text-gray-800 font-mono">{membro.segmento}</p>
                      </div>
                    )}
                    {membro.especialidade_livre && (
                      <div className={(!membro.ramo_atuacao && especialidades.length === 0 && !membro.segmento) ? "" : "sm:col-span-2"}>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">Especialidade</p>
                        <p className="text-sm text-gray-800 font-mono">{membro.especialidade_livre}</p>
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const nucleos = (membro.nucleos_alianca || []).length > 0 ? membro.nucleos_alianca! : membro.nucleo_alianca ? [membro.nucleo_alianca] : [];
                  const tipos = (membro.tipos_alianca || []).length > 0 ? membro.tipos_alianca! : membro.tipo_alianca ? [membro.tipo_alianca] : [];
                  return (nucleos.length > 0 || tipos.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {nucleos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">{nucleos.length > 1 ? "Núcleos" : "Núcleo"}</p>
                          <p className="text-sm text-gray-800 font-mono">{nucleos.join(", ")}</p>
                        </div>
                      )}
                      {tipos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-0.5">{tipos.length > 1 ? "Tipos" : "Tipo"}</p>
                          <p className="text-sm text-gray-800 font-mono">{tipos.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {(membro.idiomas || []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Languages className="w-3 h-3 text-brand-gold" />
                      Idiomas Falados
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(membro.idiomas || []).map(idioma => (
                        <span key={idioma} className="px-2.5 py-1 rounded-full text-xs font-mono border border-gray-200 text-gray-600 bg-gray-50" data-testid={`membro-idioma-${idioma}`}>
                          {idioma}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comunidade */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageCircle className="w-3 h-3 text-brand-gold" />
            Comunidade
          </p>
          {comunidades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageCircle className="w-7 h-7 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 font-mono">Não integra nenhuma comunidade</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comunidades.map(c => (
                <div key={c.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50" data-testid={`membro-comunidade-${c.id}`}>
                  {c.sigla && (
                    <p className="text-[10px] font-mono text-brand-gold/60 tracking-widest uppercase mb-0.5">{c.sigla}</p>
                  )}
                  <p className="text-sm font-mono text-gray-800 font-medium leading-snug">{c.nome || "—"}</p>
                  {getAliadoNome(c) && (
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      Aliado BUILT: <span className="text-gray-600">{getAliadoNome(c)}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400 font-mono">
                    {getMembrosCount(c) > 0 && (
                      <span>{getMembrosCount(c)} membro{getMembrosCount(c) !== 1 ? "s" : ""}</span>
                    )}
                    {getBiasCount(c) > 0 && (
                      <span>{getBiasCount(c)} BIA{getBiasCount(c) !== 1 ? "s" : ""}</span>
                    )}
                    {c.status && (
                      <span className={c.status === "ativa" ? "text-emerald-500" : "text-gray-400"}>{c.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
