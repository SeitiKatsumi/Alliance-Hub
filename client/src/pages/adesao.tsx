import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, FileText, CheckCircle2, AlertCircle, Shield, Clock, Send, Sparkles, Store, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_Nova.png";

interface ConviteData {
  id: string;
  token: string;
  status: string;
  tipo?: string;
  candidato_nome?: string;
  candidato_email?: string;
  invitador_membro_id?: string;
  comunidade?: {
    id: string;
    nome?: string;
    sigla?: string;
    pais?: string;
    territorio?: string;
  };
  dados_contratuais?: {
    interesses?: string[];
    termos_aceitos?: Record<string, boolean>;
    termos_versoes?: Record<string, string>;
    aceito_em?: string;
  } | null;
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

const CODIGO_ETICA_BUILT = `
CÓDIGO DE ÉTICA BUILT

Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.

Eu agirei com transparência, lealdade e respeito em todas as relações.

Eu protegerei a confiança construída e a reputação coletiva.

Eu assumirei responsabilidade integral por minhas ações, decisões e conduta.

Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.

Eu honrarei os esforços e a dignidade dos meus aliados acima do lucro.
`.trim();

const POLITICAS_PARTICIPACAO_PROTECAO = `
POLÍTICAS DE PARTICIPAÇÃO E PROTEÇÃO — BUILT

OBJETIVO

Estas Políticas definem as regras gerais de acesso, participação, permanência, conduta, proteção institucional e uso do ecossistema BUILT.

Seu objetivo é proteger a BUILT, seus membros, comunidades, OPAs — Ofertas Públicas de Aliança, BIAs — BUILT Integrated Alliances, parceiros, ativos, registros, metodologia, plataforma, marca e reputação.

Estas Políticas se aplicam a usuários, parceiros, Membros, Membros Aliados, Aliados Licenciados, Diretores, participantes de BIAs, Parceiros de Capital e demais pessoas que acessem ou utilizem ambientes, oportunidades ou instrumentos vinculados à BUILT.

PRINCÍPIOS DA REDE BUILT

A BUILT opera com base em boa-fé objetiva, lealdade, comprometimento, transparência, rastreabilidade, responsabilidade individual, validação reputacional, cooperação estratégica, proteção institucional, integridade patrimonial e disciplina relacional.

No ecossistema BUILT, cada participante responde individualmente pelo que assumir formalmente e coletivamente pela preservação da aliança, da confiança, da rastreabilidade e da integridade da BIA, sem responsabilidade solidária automática por obrigações de outros participantes.

Confiança, reputação e capacidade de entrega são condições essenciais para acesso, permanência, elegibilidade e crescimento na rede BUILT.

CAMADAS DE ACESSO AO ECOSSISTEMA BUILT

A BUILT Vitrine é o ambiente de acesso inicial, informativo e institucional, destinado à exposição controlada de perfis, categorias, empresas, profissionais, OPAs, conteúdos públicos ou informações expressamente autorizadas pela BUILT.

A BUILT Capital é o ambiente restrito destinado à identificação, qualificação, análise e eventual conexão de pessoas físicas ou jurídicas interessadas em investir, coinvestir, estruturar ou participar financeiramente de BIAs.

A Área de Alianças é o ambiente restrito destinado a membros aprovados pela BUILT ou por Aliado Licenciado BUILT autorizado, com acesso a comunidades, funcionalidades, análises, manifestações de interesse em OPAs, registros, validações, interações e recursos compatíveis com seu perfil, plano, reputação, função e permissões.

ACEITES E INSTRUMENTOS APLICÁVEIS

O acesso aos ambientes da BUILT poderá depender de aceite eletrônico ou físico dos Termos de Acesso, Código de Ética, Políticas de Participação e Proteção e demais instrumentos aplicáveis.

O aceite poderá ocorrer por assinatura, clique, checkbox, autenticação, registro de acesso ou outro meio idôneo, com validade jurídica e prova por logs, carimbo temporal, trilhas de auditoria e registros eletrônicos.

O aceite geral à Plataforma BUILT ou a qualquer área de acesso não implica adesão automática a BIA específica, obrigação de aporte, assunção de função, aquisição de CPP, Direito Econômico, participação patrimonial, sociedade, mandato, representação ou garantia de resultado.

ELEGIBILIDADE, VALIDAÇÃO E PERMANÊNCIA

A BUILT poderá condicionar o acesso e a permanência à aprovação cadastral, documental, técnica, reputacional, financeira, regulatória ou institucional.

O participante deverá manter seus dados e documentos atualizados e comunicar fatos relevantes que possam afetar sua reputação, habilitação, elegibilidade, função ou participação.

DEVERES DOS PARTICIPANTES

Todo participante deverá atuar com ética, boa-fé, lealdade, comprometimento, transparência, diligência, cooperação, respeito à legislação e aderência ao Código de Ética, a estas Políticas e aos instrumentos aplicáveis.

O participante é responsável pelos dados, documentos, declarações, conteúdos, propostas, entregas, prazos, obrigações e compromissos que assumir no ecossistema BUILT.

CONFIDENCIALIDADE E NÃO CIRCUNVENÇÃO

São confidenciais as informações estratégicas, comerciais, técnicas, financeiras, jurídicas, societárias, patrimoniais, reputacionais, operacionais, metodológicas, documentais ou negociais acessadas no ecossistema BUILT, salvo quando expressamente classificadas como públicas.

É vedado copiar, compartilhar, encaminhar, publicar, vender, transferir, explorar ou utilizar informações da BUILT, de membros, parceiros, OPAs, BIAs, MAPs, ativos ou documentos fora dos fluxos autorizados.

OPAs E BIAs

A manifestação de interesse em OPA é ato preliminar e dependerá de análise, seleção, aprovação, aceite específico, registro na Plataforma BUILT e instrumentos aplicáveis da respectiva BIA.

A participação em BIA específica dependerá de aprovação da governança competente, aceite próprio, registro na Plataforma BUILT, definição de função, aporte, entrega ou responsabilidade, e vinculação aos instrumentos aplicáveis.

LIMITES DA ATUAÇÃO DA BUILT

A BUILT atua como plataforma privada de método, rede, governança, rastreabilidade, validação reputacional, organização informacional e proteção institucional.

A BUILT não executa obras, não elabora projetos técnicos, não administra caixa de BIAs, não capta recursos em nome de BIAs, não intermedeia investimentos, não garante retorno financeiro, não fiscaliza tecnicamente obras e não assume obrigações dos participantes.

SANÇÕES E MEDIDAS DE PROTEÇÃO

A violação do Código de Ética, destas Políticas, dos Termos de Acesso, instrumentos de BIA, regras de confidencialidade, não circunvenção, governança, registros ou compliance poderá gerar medidas proporcionais de proteção.

ATUALIZAÇÃO DAS POLÍTICAS

A BUILT poderá atualizar estas Políticas para aprimorar governança, segurança jurídica, proteção da rede, conformidade regulatória, mitigação de riscos e evolução do ecossistema.

DISPOSIÇÕES FINAIS

Estas Políticas integram, por referência, os Termos de Acesso da Plataforma BUILT, fluxos de OPA, MOUs de BIA, MAPs, termos de adesão, atas, registros, anexos e demais instrumentos aplicáveis.
`.trim();

const TERMOS_VITRINE = `
TERMO DE ACESSO E USO DA VITRINE PÚBLICA BUILT

Pelo presente Termo de Acesso e Uso da Vitrine Pública BUILT, a pessoa física ou jurídica que realizar cadastro, acesso, autenticação social, navegação identificada ou uso de funcionalidades da vitrine pública da plataforma BUILT declara ter lido, compreendido e aceito integralmente as disposições abaixo.

1. OBJETO

1.1. Este Termo regula o acesso à vitrine pública da BUILT, ambiente digital destinado à exposição institucional, descoberta de perfis, consulta de categorias, apresentação pública controlada de empresas e profissionais formalmente habilitados e demais funcionalidades abertas pela BUILT.

1.2. A vitrine pública é destinada exclusivamente a pessoas físicas e jurídicas com atuação legítima no ecossistema da construção, do desenvolvimento imobiliário, da engenharia, da arquitetura, do fornecimento, da governança, da operação e de áreas correlatas admitidas pela BUILT.

1.3. O acesso à vitrine pública não confere, por si só, a condição de membro, investidor aprovado, participante de BIA, aliado licenciado, diretor ou líder de comunidade.

2. ELEGIBILIDADE E CADASTRO

2.1. O usuário declara que possui capacidade civil e legitimidade para realizar o cadastro em nome próprio ou em representação válida de pessoa jurídica.

2.2. Quando aplicável, o usuário deverá informar dados cadastrais verdadeiros, completos e atualizados, inclusive nome, e-mail, telefone, país de origem, número de registro profissional, número de registro empresarial ou equivalente.

2.3. Profissionais formalmente habilitados deverão informar registro oficial verificável em sua jurisdição de origem.

3. NATUREZA DA VITRINE PÚBLICA

3.1. A vitrine pública possui natureza informativa, institucional e relacional.

3.2. A presença do usuário na vitrine pública não constitui certificação absoluta, endosso profissional, promessa de contratação, garantia de reputação, garantia de capacidade técnica ou aval financeiro.

4. COMUNIDADES E ALIADOS BUILT

4.1. O Usuário deverá ser vinculado a uma comunidade, de acordo com regras da plataforma e da governança local.

5. RESPONSABILIDADE PELAS INFORMAÇÕES

5.1. O usuário é integralmente responsável pelos dados, documentos, imagens, currículos, registros, marcas, portfólios, links, descrições e demais conteúdos inseridos.

5.2. O usuário declara possuir todos os direitos, autorizações e bases legais para uso e divulgação das informações disponibilizadas.

6. REGRAS DE USO

6.1. O acesso é pessoal, revogável, não exclusivo e intransferível.

6.2. O usuário não poderá copiar, raspar, minerar, revender, sublicenciar, reproduzir em massa, treinar modelos com dados da plataforma sem autorização, nem utilizar a vitrine pública para spam, prospecção abusiva, fraude, engenharia social, concorrência desleal ou desvio de oportunidades.

7. DADOS PESSOAIS E PRIVACIDADE

7.1. Os dados pessoais tratados no âmbito deste Termo serão utilizados para autenticação, prevenção a fraude, gestão de acesso, segurança, comunicação, auditoria, melhoria da plataforma, cumprimento contratual, exercício regular de direitos e legítimo interesse da BUILT.

8. PROPRIEDADE INTELECTUAL

8.1. A plataforma, seus layouts, fluxos, bancos de dados, metodologias, marcas, nomenclaturas, manuais, elementos visuais e sistemas são de titularidade da BUILT ou de terceiros licenciantes.

9. LIMITAÇÃO DE RESPONSABILIDADE

9.1. A BUILT atua como plataforma digital de conexão, organização e governança relacional, não sendo parte automática de negócios, contratações, alianças, investimentos ou obrigações assumidas entre usuários.

10. ACEITE ELETRÔNICO

10.1. O aceite deste Termo poderá ocorrer por clique, checkbox, autenticação social, assinatura eletrônica, fluxo de cadastro ou outro mecanismo eletrônico apto a demonstrar manifestação inequívoca de vontade.

11. SUSPENSÃO E ENCERRAMENTO

11.1. A BUILT poderá recusar, limitar, suspender ou encerrar acessos em caso de suspeita de fraude, uso indevido, risco reputacional, violação ética, inconsistência cadastral, descumprimento deste Termo ou necessidade regulatória.

12. FORO E LEI APLICÁVEL

12.1. Este Termo será regido pela lei do país da pessoa jurídica da BUILT que presta os serviços da plataforma ao usuário.
`.trim();

const TERMOS_BUILT_CAPITAL = `
TERMO BUILT CAPITAL - VERSAO PROVISORIA V1

Este Termo disciplina o acesso e a participacao no BUILT Capital, ambiente voltado a conexao com parceiros de capital, investidores, originadores e participantes estrategicos da rede BUILT.

1. FINALIDADE

1.1. O BUILT Capital facilita conexoes, mapeamento de interesses e relacionamento institucional entre participantes elegiveis.

1.2. A participacao no BUILT Capital nao constitui oferta publica de valores mobiliarios, promessa de rentabilidade, consultoria financeira, recomendacao individualizada de investimento ou garantia de retorno.

2. RESPONSABILIDADE E ELEGIBILIDADE

2.1. O participante deve informar dados verdadeiros, manter seu perfil atualizado e respeitar as regras de confidencialidade, governanca e registro da plataforma.

2.2. Toda decisao de aporte, credito, parceria ou investimento dependera de analise propria, instrumentos especificos, diligencia e aprovacao das partes envolvidas.

3. CONDUTA

3.1. E vedado captar recursos de forma irregular, prometer retorno garantido, omitir riscos, compartilhar informacoes restritas sem autorizacao ou induzir terceiros a erro.

4. REGISTRO E COMPLIANCE

4.1. Interacoes relevantes devem ser registradas pelos meios indicados pela BUILT, preservando rastreabilidade, transparencia e seguranca juridica.

Ao aceitar este Termo, o usuario declara estar ciente das regras provisorias do BUILT Capital.
`.trim();

export type TermKey = "codigo_etica" | "politicas_participacao_protecao" | "area_aliancas" | "vitrine" | "built_capital";

export const TERM_CONFIG: Record<TermKey, {
  title: string;
  label: string;
  version: string;
  body: string;
  icon: typeof Shield;
}> = {
  codigo_etica: {
    title: "Código de Ética BUILT",
    label: "Código de Ética BUILT",
    version: "BUILT JUR - 1",
    body: CODIGO_ETICA_BUILT,
    icon: Shield,
  },
  politicas_participacao_protecao: {
    title: "Políticas de Participação e Proteção BUILT",
    label: "Políticas de Participação e Proteção BUILT",
    version: "BUILT JUR - 1",
    body: POLITICAS_PARTICIPACAO_PROTECAO,
    icon: FileText,
  },
  area_aliancas: {
    title: "Termo de Acesso à Área de Alianças",
    label: "Termo de Acesso à Área de Alianças BUILT",
    version: "area_aliancas_v1",
    body: TERMOS_ADESAO,
    icon: Shield,
  },
  vitrine: {
    title: "Termo BUILT Vitrine",
    label: "Termo BUILT Vitrine",
    version: "BUILT JUR - 2",
    body: TERMOS_VITRINE,
    icon: Store,
  },
  built_capital: {
    title: "Termo BUILT Capital",
    label: "Termo BUILT Capital",
    version: "built_capital_v1_provisorio",
    body: TERMOS_BUILT_CAPITAL,
    icon: TrendingUp,
  },
};

function getConviteInteresses(convite?: ConviteData): string[] {
  const raw = convite?.dados_contratuais?.interesses;
  if (Array.isArray(raw) && raw.length > 0) {
    return Array.from(new Set(raw.map((item) => String(item).toLowerCase())));
  }
  if (convite?.tipo === "vitrine") return ["vitrine"];
  if (convite?.tipo === "capital") return ["capital"];
  if (convite?.tipo === "associacao_completa") return ["membros"];
  return ["membros"];
}

export function getRequiredTermKeys(interesses: string[]): TermKey[] {
  return ["codigo_etica", "politicas_participacao_protecao"];
}

function TermosAceiteView({
  convite,
  requiredTerms,
  checkedTerms,
  setCheckedTerms,
  activeTerm,
  setActiveTerm,
  onAccept,
  isPending,
  errorMessage,
  buttonText,
}: {
  convite: ConviteData;
  requiredTerms: TermKey[];
  checkedTerms: Record<string, boolean>;
  setCheckedTerms: Dispatch<SetStateAction<Record<string, boolean>>>;
  activeTerm: TermKey;
  setActiveTerm: Dispatch<SetStateAction<TermKey>>;
  onAccept: () => void;
  isPending: boolean;
  errorMessage?: string;
  buttonText: string;
}) {
  const activeKey = requiredTerms.includes(activeTerm) ? activeTerm : requiredTerms[0];
  const activeConfig = TERM_CONFIG[activeKey];
  const ActiveIcon = activeConfig.icon;
  const allAccepted = requiredTerms.every((key) => checkedTerms[key]);

  const toggleTerm = (key: TermKey) => {
    setCheckedTerms((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#001D34]">
      <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
        <aside className="hidden md:flex flex-col justify-between bg-[#001D34] p-6 text-white">
          <div>
            <img src={builtLogo} alt="BUILT" className="w-28" />
            <div className="mt-12 space-y-3">
              <p className="text-xs text-white/70">Primeiro acesso</p>
              <p className="text-sm font-semibold">Etapa 2 de 2</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="h-3 w-3 rounded-full bg-[#D7BB7D]" />
                <span className="h-px flex-1 bg-[#D7BB7D]" />
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#D7BB7D] text-xs font-bold text-[#001D34]">2</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/60">Precisa de ajuda? Fale com nosso time.</p>
        </aside>

        <main className="px-6 py-10">
          <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-3xl font-bold text-[#001D34] mt-1">Termos de Acesso BUILT</h1>
          <p className="text-slate-600 text-sm mt-1">
            Bem-vindo(a), <strong className="text-brand-gold">{convite.candidato_nome}</strong>! Leia e aceite os termos para continuar.
          </p>
        </div>

        <div className="rounded-xl p-4 border border-[#D7BB7D]/40 bg-white flex items-center gap-3 shadow-sm">
          <Shield className="w-5 h-5 text-brand-gold shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Aderindo à</p>
            <p className="text-sm font-bold text-[#001D34]">{convite.comunidade?.nome || "Rede BUILT"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D7BB7D]/30 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[#D7BB7D]/30 bg-[#FCFAF5]">
            <ActiveIcon className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-slate-600 uppercase tracking-wider">{activeConfig.title}</span>
          </div>
          <div className="p-5 max-h-[32rem] overflow-y-auto">
            <pre className="text-base md:text-lg font-mono text-slate-700 leading-8 md:leading-9 whitespace-pre-wrap">{activeConfig.body}</pre>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D7BB7D]/30 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-[10px] font-mono text-brand-gold/60 uppercase tracking-[0.2em]">Termos aplicáveis</p>
          <div className="flex flex-wrap gap-2">
            {requiredTerms.map((key) => {
              const config = TERM_CONFIG[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTerm(key)}
                  className={`rounded-full border px-4 py-2 text-sm font-mono transition-colors ${activeKey === key ? "border-brand-gold bg-brand-gold/20 text-[#001D34]" : "border-slate-200 text-slate-600 hover:border-brand-gold/50 hover:text-[#001D34]"}`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {requiredTerms.map((key) => {
            const config = TERM_CONFIG[key];
            const accepted = !!checkedTerms[key];
            return (
              <label key={key} className="flex items-start gap-3 cursor-pointer group" data-testid={`label-aceite-${key}`}>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${accepted ? "bg-brand-gold border-brand-gold" : "border-slate-300 group-hover:border-brand-gold"}`}
                  onClick={() => toggleTerm(key)}
                >
                  {accepted && <svg viewBox="0 0 10 10" className="w-3 h-3 text-brand-navy"><path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className="text-sm font-mono text-slate-700 leading-relaxed select-none" onClick={() => toggleTerm(key)}>
                  Li e concordo com o{" "}
                  <button
                    type="button"
                    className="font-bold text-brand-gold hover:underline"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveTerm(key);
                    }}
                  >
                    {config.label}
                  </button>
                </span>
              </label>
            );
          })}
        </div>

        <Button
          onClick={onAccept}
          disabled={!allAccepted || isPending}
          className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
          style={{ background: allAccepted ? "linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)", color: "#001D34" }}
          data-testid="btn-aceitar-termos"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {buttonText}
        </Button>
        {errorMessage && (
          <p className="text-red-600 text-xs font-mono text-center">{errorMessage}</p>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdesaoPage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [checked, setChecked] = useState(false);
  const [checkedTerms, setCheckedTerms] = useState<Record<string, boolean>>({});
  const [activeTerm, setActiveTerm] = useState<TermKey>("codigo_etica");
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const interesses = getConviteInteresses(convite);
  const requiredTerms = getRequiredTermKeys(interesses);
  const termosAceitosPayload = Object.fromEntries(requiredTerms.map((key) => [key, true]));
  const termosVersoesPayload = Object.fromEntries(requiredTerms.map((key) => [key, TERM_CONFIG[key].version]));

  const aceitarTermosMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/convites/${token}/aceitar-termos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aceito: true,
          termos_aceitos: termosAceitosPayload,
          termos_versoes: termosVersoesPayload,
          aceito_em: new Date().toISOString(),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao registrar aceite");
      }
      return r.json();
    },
    onSuccess: () => setLocalStatus("termos_aceitos"),
  });

  const solicitarAcessoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/convites/${token}/solicitar-acesso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao enviar solicitação");
      }
      return r.json();
    },
    onSuccess: () => setLocalStatus("aguardando_avaliacao_aura"),
  });

  // Legacy: old flow for associacao_completa tipo (approved by aliado)
  const adesaoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/convites/${token}/adesao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aceito: true,
          termos_aceitos: termosAceitosPayload,
          termos_versoes: termosVersoesPayload,
          aceito_em: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error("Erro ao registrar aceite");
      return r.json();
    },
    onSuccess: () => navigate(`/pagamento/${token}`),
  });

  async function voltarParaCadastroInicial() {
    await fetch("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).catch(() => null);
    window.location.href = "/";
  }

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

  const status = localStatus ?? convite.status;

  // LEGACY FLOW: associacao_completa — redirect payment-stage statuses directly to payment page
  if (["pagamento_pendente", "membro"].includes(status)) {
    navigate(`/pagamento/${token}`);
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (["aprovado", "termos_enviados"].includes(status)) {
    return (
      <TermosAceiteView
        convite={convite}
        requiredTerms={requiredTerms}
        checkedTerms={checkedTerms}
        setCheckedTerms={setCheckedTerms}
        activeTerm={activeTerm}
        setActiveTerm={setActiveTerm}
        onAccept={() => adesaoMutation.mutate()}
        isPending={adesaoMutation.isPending}
        errorMessage={adesaoMutation.isError ? (adesaoMutation.error as Error).message : undefined}
        buttonText="Aceitar Termos e Continuar"
      />
    );
  }

  if (status === "termos_pendentes") {
    return (
      <TermosAceiteView
        convite={convite}
        requiredTerms={requiredTerms}
        checkedTerms={checkedTerms}
        setCheckedTerms={setCheckedTerms}
        activeTerm={activeTerm}
        setActiveTerm={setActiveTerm}
        onAccept={() => aceitarTermosMutation.mutate()}
        isPending={aceitarTermosMutation.isPending}
        errorMessage={aceitarTermosMutation.isError ? (aceitarTermosMutation.error as Error).message : undefined}
        buttonText="Aceitar Termos e Avançar"
      />
    );
  }

  // LEGACY FLOW: associacao_completa after aliado approval (show terms acceptance)
  if (["aprovado", "termos_enviados"].includes(status)) {
    return (
      <div className="min-h-screen" style={{ background: "#001D34" }}>
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <div className="text-center">
            <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
            <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Termo de Acesso à Área de Membros</h1>
          </div>
          <div className="rounded-xl p-4 border border-brand-gold/20 flex items-center gap-3" style={{ background: "rgba(215,187,125,0.05)" }}>
            <Shield className="w-5 h-5 text-brand-gold shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Aderindo à</p>
              <p className="text-sm font-bold font-mono text-white">{convite.comunidade?.nome}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
              <FileText className="w-4 h-4 text-brand-gold" />
              <span className="text-xs font-mono text-white/60 uppercase tracking-wider">Termo de Acesso — BUILT</span>
            </div>
            <div className="p-5 max-h-[28rem] overflow-y-auto">
              <pre className="text-xs font-mono text-white/70 leading-relaxed whitespace-pre-wrap">{TERMOS_ADESAO}</pre>
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-aceite-termos">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ?"bg-brand-gold border-brand-gold" : "border-white/30 group-hover:border-white/50"}`}
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
            style={{ background: checked ?"linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)", color: "#001D34" }}
            data-testid="btn-aceitar-termos"
          >
            {adesaoMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Aceitar Termos e Continuar
          </Button>
          {adesaoMutation.isError && (
            <p className="text-red-400 text-xs font-mono text-center">{(adesaoMutation.error as Error).message}</p>
          )}
        </div>
      </div>
    );
  }

  // NEW FLOW: termos_pendentes → show terms + accept
  if (status === "termos_pendentes") {
    return (
      <div className="min-h-screen" style={{ background: "#001D34" }}>
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <div className="text-center">
            <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
            <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Termo de Acesso à Área de Membros</h1>
            <p className="text-white/50 text-sm font-mono mt-1">
              Bem-vindo(a), <strong className="text-brand-gold">{convite.candidato_nome}</strong>! Leia e aceite os termos para continuar.
            </p>
          </div>

          <div className="rounded-xl p-4 border border-brand-gold/20 flex items-center gap-3" style={{ background: "rgba(215,187,125,0.05)" }}>
            <Shield className="w-5 h-5 text-brand-gold shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Aderindo à</p>
              <p className="text-sm font-bold font-mono text-white">{convite.comunidade?.nome}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
              <FileText className="w-4 h-4 text-brand-gold" />
              <span className="text-xs font-mono text-white/60 uppercase tracking-wider">Termo de Acesso — BUILT</span>
            </div>
            <div className="p-5 max-h-[28rem] overflow-y-auto">
              <pre className="text-xs font-mono text-white/70 leading-relaxed whitespace-pre-wrap">{TERMOS_ADESAO}</pre>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-aceite-termos">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ?"bg-brand-gold border-brand-gold" : "border-white/30 group-hover:border-white/50"}`}
              onClick={() => setChecked(c => !c)}
            >
              {checked && <svg viewBox="0 0 10 10" className="w-3 h-3 text-brand-navy"><path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span className="text-sm font-mono text-white/70 leading-relaxed select-none" onClick={() => setChecked(c => !c)}>
              Li e concordo com o <strong className="text-brand-gold">Termo de Acesso à Área de Membros BUILT</strong>
            </span>
          </label>

          <Button
            onClick={() => aceitarTermosMutation.mutate()}
            disabled={!checked || aceitarTermosMutation.isPending}
            className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
            style={{ background: checked ?"linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)", color: "#001D34" }}
            data-testid="btn-aceitar-termos"
          >
            {aceitarTermosMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Aceitar Termos e Avançar
          </Button>
          {aceitarTermosMutation.isError && (
            <p className="text-red-400 text-xs font-mono text-center">{(aceitarTermosMutation.error as Error).message}</p>
          )}
        </div>
      </div>
    );
  }

  // NEW FLOW: termos_aceitos → show "Enviar Solicitação de Acesso" button
  if (status === "termos_aceitos") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#001D34" }}>
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
            <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Termos Aceitos</h1>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 p-6 flex flex-col items-center gap-3" style={{ background: "rgba(16,185,129,0.05)" }}>
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-white/80 text-sm font-mono text-center">
              Você aceitou os Termos de Acesso da <strong className="text-brand-gold">{convite.comunidade?.nome}</strong>.
            </p>
            <p className="text-white/50 text-xs font-mono text-center leading-relaxed">
              O próximo passo é enviar sua solicitação de acesso. O membro que te convidou será notificado para registrar a percepção de Aura — depois, o Aliado BUILT analisará sua candidatura.
            </p>
          </div>

          <Button
            onClick={() => solicitarAcessoMutation.mutate()}
            disabled={solicitarAcessoMutation.isPending}
            className="w-full h-12 font-mono font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
            data-testid="btn-solicitar-acesso"
          >
            {solicitarAcessoMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar Solicitação de Acesso
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={voltarParaCadastroInicial}
            className="w-full h-11 border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white font-mono text-sm"
            data-testid="btn-voltar-cadastro-termos"
          >
            Voltar para cadastro
          </Button>

          {solicitarAcessoMutation.isError && (
            <p className="text-red-400 text-xs font-mono text-center">{(solicitarAcessoMutation.error as Error).message}</p>
          )}
        </div>
      </div>
    );
  }

  // NEW FLOW: aguardando_avaliacao_aura → waiting message
  if (status === "aguardando_avaliacao_aura") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#001D34" }}>
        <div className="max-w-md w-full space-y-6 text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <div className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white">Aguardando Avaliação de Aura</h1>
            <p className="text-white/50 text-sm font-mono mt-2 leading-relaxed">
              Sua solicitação foi enviada! O membro que te convidou receberá um e-mail para registrar sua percepção de Aura.
            </p>
            <p className="text-white/40 text-xs font-mono mt-3 leading-relaxed">
              Após a avaliação, o Aliado BUILT da <strong className="text-brand-gold">{convite.comunidade?.nome}</strong> será notificado para analisar sua candidatura.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-4 flex items-center gap-3 text-left" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Clock className="w-5 h-5 text-brand-gold shrink-0" />
            <p className="text-xs font-mono text-white/50">Você receberá um e-mail assim que a análise for concluída. Fique atento à sua caixa de entrada.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={voltarParaCadastroInicial}
            className="w-full h-11 border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white font-mono text-sm"
            data-testid="btn-voltar-cadastro-aura"
          >
            Voltar para cadastro
          </Button>
        </div>
      </div>
    );
  }

  // candidato status → in review by Aliado
  if (status === "candidato") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#001D34" }}>
        <div className="max-w-md w-full space-y-6 text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <div className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-brand-gold animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white">Candidatura em Análise</h1>
            <p className="text-white/50 text-sm font-mono mt-2 leading-relaxed">
              O Aliado BUILT da <strong className="text-brand-gold">{convite.comunidade?.nome}</strong> está analisando seu perfil e a avaliação de Aura recebida.
            </p>
            <p className="text-white/40 text-xs font-mono mt-3">Você receberá um e-mail com a decisão em breve.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={voltarParaCadastroInicial}
            className="w-full h-11 border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white font-mono text-sm"
            data-testid="btn-voltar-cadastro-candidato"
          >
            Voltar para cadastro
          </Button>
        </div>
      </div>
    );
  }

  // Fallback for other statuses
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
      <div className="text-center space-y-4 p-8 max-w-md">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold font-mono text-white">Página não disponível</h2>
        <p className="text-white/50 text-sm font-mono">Este link não está disponível no momento.</p>
      </div>
    </div>
  );
}
