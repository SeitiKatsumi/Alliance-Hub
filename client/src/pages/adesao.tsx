import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, FileText, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  };
}

const TERMOS_ADESAO = `
TERMO DE ACESSO À ÁREA DE MEMBROS BUILT

Este Termo disciplina o ingresso e a permanência do usuário na Área de Membros BUILT, ambiente restrito destinado a empresários sócios, profissionais formalmente habilitados e demais participantes elegíveis aprovados pela BUILT.

1. CONDIÇÃO DE MEMBRO

1.1. O acesso à Área de Membros depende de aprovação cadastral, reputacional, técnica e documental, conforme os critérios internos da BUILT.

1.2. Poderão ser admitidos como membros empresários sócios, profissionais formalmente habilitados e pessoas jurídicas com interesse legítimo de conexão, colaboração e participação no ecossistema BUILT, desde que possuam registro oficial verificável em seu país de origem.

1.3. O acesso de pessoas físicas e jurídicas é sempre condicionado à aprovação formal da BUILT, podendo ser limitado, suspenso ou encerrado a qualquer tempo, mediante justificativa adequada.

2. REQUISITOS DE VALIDAÇÃO

2.1. O candidato a membro deverá fornecer documentos e informações verídicas e atualizadas, inclusive identificação civil, dados empresariais, prova de inscrição fiscal, prova de habilitação técnica, registro profissional, licenças, autorizações ou equivalentes, quando aplicáveis.

2.2. A BUILT poderá exigir validação de reputação, referências, entrevista, certificados, currículo técnico, vínculo societário, titularidade real, estrutura societária e comprovantes de idoneidade.

2.3. O fornecimento de informações falsas ou omissas implicará exclusão imediata, sem prejuízo de responsabilização civil e penal.

3. DIREITOS DO MEMBRO

3.1. O membro aprovado poderá, conforme seu plano, permissões e perfil:
a) acessar ambiente restrito de networking e governança;
b) visualizar e interagir com oportunidades, comunidades, perfis, reuniões e materiais internos;
c) registrar entregas, participações, comunicações e dados vinculados ao seu histórico;
d) ser elegível para compor comunidades, BIAs, células, reuniões e fluxos de validação;
e) utilizar recursos da Plataforma BUILT ou sistema equivalente, quando liberados.

4. DEVERES DO MEMBRO

4.1. O membro compromete-se a atuar com ética, boa-fé, lealdade, diligência, respeito à legislação aplicável e aderência integral ao Código de Ética, às Políticas de Participação e Proteção, aos manuais internos e aos instrumentos específicos da BUILT.

4.2. O membro deverá manter seus dados sempre atualizados, inclusive quanto a mudança de registro profissional, suspensão de licença, alteração societária, insolvência, impedimento ético, conflito de interesses ou qualquer fato que altere sua condição de elegibilidade.

4.3. O membro deverá participar com diligência e boa-fé dos processos, reuniões, validações e atividades para as quais for convocado ou se comprometer, salvo motivo justificado.

5. USO DO AMBIENTE RESTRITO

5.1. É vedado ao membro:
a) compartilhar login ou acesso com terceiros;
b) extrair listas de contatos para uso externo não autorizado;
c) usar a plataforma para aliciamento, concorrência parasitária, captação enganosa, desvio de oportunidades, difamação ou violação de confidencialidade;
d) apresentar-se como representante da BUILT sem outorga formal;
e) usar o nome BUILT para assumir obrigações com terceiros sem autorização.

6. COMUNIDADES E ALIADOS BUILT

6.1. O membro deverá ser vinculado a uma comunidade, de acordo com regras da plataforma e da governança local.

6.2. As comunidades são compostas por membros associados a um Aliado BUILT, sem que isso elimine a autonomia contratual da BUILT nem crie vínculo societário automático entre membro, aliado e plataforma.

6.3. O membro reconhece que Aliados BUILT exercem funções de liderança comunitária, capacitação e articulação, conforme regras internas da plataforma.

7. REGISTRO E RASTREABILIDADE

7.1. Toda participação relevante do membro em oportunidades, validações, alianças, entregas, CPPs, comunidades ou BIAs deverá ser registrada no ambiente indicado pela BUILT para fins de governança, transparência, compliance e auditoria.

7.2. A ausência de registro poderá impedir o reconhecimento formal da participação do membro, sem prejuízo de apuração posterior em instrumento próprio, a critério da governança aplicável.

8. CONFIDENCIALIDADE

8.1. O membro deverá manter sigilo sobre informações estratégicas, comerciais, técnicas, reputacionais, societárias, patrimoniais e operacionais da BUILT, das comunidades, das BIAs e de outros membros, salvo autorização expressa ou dever legal.

8.2. Essa obrigação subsiste após suspensão, encerramento ou saída da plataforma.

9. AUSÊNCIA DE GARANTIA

9.1. A condição de membro não garante participação automática em BIAs, recebimento de oportunidades, contratação, remuneração, retorno econômico, indicação comercial ou aporte de capital.

9.2. Toda participação concreta dependerá de seleção, aderência reputacional, capacidade técnica, validação da governança da BIA, disponibilidade operacional e formalização específica.

10. SANÇÕES

10.1. O descumprimento deste Termo ou das políticas internas poderá ensejar advertência, limitação funcional, rebaixamento de acesso, suspensão, exclusão, bloqueio reputacional interno, apuração de incidentes e adoção de medidas contratuais ou judiciais cabíveis.

10.2. Em caso de risco relevante, a BUILT poderá adotar medidas cautelares imediatas.

Ao aceitar este Termo, o usuário declara ter lido, compreendido e concordado integralmente com todas as cláusulas acima.
`.trim();

export default function AdesaoPage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const adesaoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/convites/${token}/adesao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceito: true }),
      });
      if (!r.ok) throw new Error("Erro ao registrar aceite");
      return r.json();
    },
    onSuccess: () => {
      navigate(`/pagamento/${token}`);
    },
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
          <h2 className="text-xl font-bold font-mono text-white">Link inválido</h2>
          <p className="text-white/50 text-sm font-mono">Este link pode ter expirado ou sido removido.</p>
        </div>
      </div>
    );
  }

  const statusInvalid = !["aprovado", "termos_enviados"].includes(convite.status);
  const jaAceito = convite.status === "termos_aceitos" || convite.status === "pagamento_pendente" || convite.status === "membro";

  if (accepted || jaAceito) {
    navigate(`/pagamento/${token}`);
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (statusInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Termos não disponíveis</h2>
          <p className="text-white/50 text-sm font-mono">Este link não está disponível para aceite de termos no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#001D34" }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Termo de Acesso à Área de Membros</h1>
          <p className="text-white/50 text-sm font-mono mt-1">
            Leia atentamente o termo antes de aceitar
          </p>
        </div>

        {/* Comunidade info */}
        <div className="rounded-xl p-4 border border-brand-gold/20 flex items-center gap-3" style={{ background: "rgba(215,187,125,0.05)" }}>
          <Shield className="w-5 h-5 text-brand-gold shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Aderindo à</p>
            <p className="text-sm font-bold font-mono text-white">{convite.comunidade?.nome}</p>
          </div>
        </div>

        {/* Terms document */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
            <FileText className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-white/60 uppercase tracking-wider">Termo de Acesso — BUILT</span>
          </div>
          <div className="p-5 max-h-[28rem] overflow-y-auto">
            <pre className="text-xs font-mono text-white/70 leading-relaxed whitespace-pre-wrap">
              {TERMOS_ADESAO}
            </pre>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-aceite-termos">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? "bg-brand-gold border-brand-gold" : "border-white/30 group-hover:border-white/50"}`}
            onClick={() => setChecked(c => !c)}
          >
            {checked && <svg viewBox="0 0 10 10" className="w-3 h-3 text-brand-navy"><path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span className="text-sm font-mono text-white/70 leading-relaxed select-none" onClick={() => setChecked(c => !c)}>
            Li e concordo com o <strong className="text-brand-gold">Termo de Acesso à Área de Membros BUILT</strong>
          </span>
        </label>

        <Button
          onClick={() => adesaoMutation.mutate()}
          disabled={!checked || adesaoMutation.isPending}
          className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
          style={{ background: checked ? "linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)", color: "#001D34" }}
          data-testid="btn-aceitar-termos"
        >
          {adesaoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Aceitar Termos e Continuar
        </Button>
        {adesaoMutation.isError && (
          <p className="text-red-400 text-xs font-mono text-center">Erro ao registrar aceite. Tente novamente.</p>
        )}
      </div>
    </div>
  );
}
