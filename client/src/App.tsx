import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch as UiSwitch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import OportunidadesPage from "@/pages/oportunidades";
import BiasPage from "@/pages/bias";
import BiaDetalhePage from "@/pages/bia-detalhe";
import OpaDetalhePage from "@/pages/opa-detalhe";
import MembrosPage from "@/pages/membros";
import AuraPage from "@/pages/aura";
import PainelPage from "@/pages/painel";
import AdminPage from "@/pages/admin";
import BiasCalculadoraPage from "@/pages/bias-calculadora";
import FluxoCaixaPage from "@/pages/fluxo-caixa";
import MeuPerfilPage from "@/pages/meu-perfil";
import DocumentacaoPage from "@/pages/documentacao";
import ResultadosPage from "@/pages/resultados";
import DiretoriaAliancaPage from "@/pages/diretoria-alianca";
import NucleoTecnicoPage from "@/pages/nucleo-tecnico";
import NucleoObraPage from "@/pages/nucleo-obra";
import NucleoComercialPage from "@/pages/nucleo-comercial";
import NucleoCapitalPage from "@/pages/nucleo-capital";
import GestaoOpasPage from "@/pages/gestao-opas";
import GestaoBiasPage from "@/pages/gestao-bias";
import VitrinePage from "@/pages/vitrine";
import VitrineDetalhePage from "@/pages/vitrine-detalhe";
import AreaAliancasPage from "@/pages/area-aliancas";
import AreMembroPage from "@/pages/area-membros";
import MembroDetalhePage from "@/pages/membro-detalhe";
import ComunidadePage from "@/pages/comunidade";
import ComunidadeDetalhePage from "@/pages/comunidade-detalhe";
import ConvitesPage from "@/pages/convites";
import BuiltCapitalPage from "@/pages/built-capital";
import LoginPage from "@/pages/login";
import AguardandoAprovacaoPage from "@/pages/aguardando-aprovacao";
import ConvitePage from "@/pages/convite";
import AdesaoPage from "@/pages/adesao";
import AvaliarAuraCandidatoPage from "@/pages/avaliar-aura-candidato";
import PagamentoPage from "@/pages/pagamento";
import PagamentoSucessoPage from "@/pages/pagamento-sucesso";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, CheckCircle2, Globe, Languages, Loader2, LogOut, MapPin, Navigation, Plus, Save, Search, ScrollText, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAllTipos, getNucleosForTipos, getSegmentosForRamo, getTipoDisplayName, RAMOS_SEGMENTOS } from "@/lib/ramos-segmentos";

interface OnboardingMembro {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string | null;
  whatsapp?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  especialidade_livre?: string | null;
  perfil_aliado?: string | null;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  idiomas?: string[] | null;
  nucleos_alianca?: string[] | null;
  tipos_alianca?: string[] | null;
  link_site?: string | null;
  na_vitrine?: boolean;
  em_built_capital?: boolean | null;
  codigo_etica_aceito_em?: string | null;
  codigo_etica_versao?: string | null;
  vitrine_termo_aceito_em?: string | null;
  vitrine_termo_versao?: string | null;
  area_aliancas_termo_aceito_em?: string | null;
  area_aliancas_termo_versao?: string | null;
  built_capital_termo_aceito_em?: string | null;
  built_capital_termo_versao?: string | null;
}

const BUILT_CAPITAL_NUCLEO = "Núcleo de Capital";
const BUILT_CAPITAL_TIPO = "Alianças de Investimento";
const CODIGO_ETICA_BUILT_VERSAO = "BUILT JUR - 1";
const CODIGO_ETICA_BUILT = [
  "Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.",
  "Eu agirei com transparência, lealdade e respeito em todas as relações.",
  "Eu protegerei a confiança construída e a reputação coletiva.",
  "Eu assumirei responsabilidade integral por minhas ações, decisões e conduta.",
  "Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.",
  "Eu honrarei os esforços e a dignidade dos meus aliados acima do lucro.",
];
const TERMO_VITRINE_BUILT_VERSAO = "BUILT JUR - 2";
const TERMO_VITRINE_BUILT = `
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

2.4. Empresas vinculadas a entidade de classe, conselho, ordem, registro mercantil, autoridade fiscal ou órgão equivalente deverão informar inscrição oficial verificável em seu país de origem.

3. NATUREZA DA VITRINE PÚBLICA

3.1. A vitrine pública possui natureza informativa, institucional e relacional.

3.2. A BUILT não garante a exatidão permanente de dados fornecidos por terceiros, embora possa empregar mecanismos de verificação, moderação, auditoria ou suspensão.

3.3. A presença do usuário na vitrine pública não constitui certificação absoluta, endosso profissional, promessa de contratação, garantia de reputação, garantia de capacidade técnica ou aval financeiro.

4. COMUNIDADES E ALIADOS BUILT

4.1. O Usuário deverá ser vinculado a uma comunidade, de acordo com regras da plataforma e da governança local.

4.2. As comunidades são compostas por Usuários associados a um Aliado BUILT, sem que isso elimine a autonomia contratual da BUILT nem crie vínculo societário automático entre Usuário, aliado e plataforma.

5. RESPONSABILIDADE PELAS INFORMAÇÕES

5.1. O usuário é integralmente responsável pelos dados, documentos, imagens, currículos, registros, marcas, portfólios, links, descrições e demais conteúdos inseridos.

5.2. O usuário declara possuir todos os direitos, autorizações e bases legais para uso e divulgação das informações disponibilizadas.

5.3. É vedado inserir informação falsa, enganosa, desatualizada de forma relevante, ofensiva, difamatória, ilícita ou que induza terceiros a erro.

6. REGRAS DE USO

6.1. O acesso é pessoal, revogável, não exclusivo e intransferível.

6.2. O usuário não poderá copiar, raspar, minerar, revender, sublicenciar, reproduzir em massa, treinar modelos com dados da plataforma sem autorização, nem utilizar a vitrine pública para spam, prospecção abusiva, fraude, engenharia social, concorrência desleal ou desvio de oportunidades.

6.3. A BUILT poderá limitar visualizações, exigir autenticação, ocultar campos, modular visibilidade por país, suspender contas ou remover conteúdo para preservar segurança, privacidade, compliance e integridade do ecossistema.

7. DADOS PESSOAIS E PRIVACIDADE

7.1. Os dados pessoais tratados no âmbito deste Termo serão utilizados para autenticação, prevenção a fraude, gestão de acesso, segurança, comunicação, auditoria, melhoria da plataforma, cumprimento contratual, exercício regular de direitos e legítimo interesse da BUILT, nos limites da legislação aplicável.

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

const TERMO_AREA_ALIANCAS_VERSAO = "area_aliancas_v1_provisorio";
const TERMO_AREA_ALIANCAS = `
TERMO PROVISÓRIO DE ACESSO À ÁREA DE ALIANÇAS BUILT

Este termo regula o acesso inicial à Área de Alianças BUILT, ambiente restrito destinado a membros aliados, comunidades, OPAs, manifestações de interesse, registros de participação, validações e interações da rede BUILT.

1. O acesso à Área de Alianças não garante participação em BIAs, aprovação em OPAs, contratação, remuneração, CPPs, Direitos Econômicos, função de governança ou retorno financeiro.

2. O usuário compromete-se a atuar com boa-fé, transparência, respeito à confidencialidade, não circunvenção, proteção reputacional e observância ao Código de Ética e às Políticas de Participação e Proteção BUILT.

3. Manifestações de interesse em OPAs são atos preliminares e dependem de análise, seleção, aprovação, aceite específico e registros próprios.

4. Informações acessadas na Área de Alianças podem envolver oportunidades, comunidades, membros, OPAs, BIAs, documentos e dados sensíveis, devendo ser usadas apenas nos fluxos autorizados.

5. A BUILT poderá limitar, suspender ou encerrar o acesso em caso de risco reputacional, uso indevido, inconsistência cadastral, violação ética, violação de confidencialidade ou descumprimento de regras internas.

Ao aceitar este termo, o usuário declara estar ciente das regras provisórias de acesso à Área de Alianças BUILT.
`.trim();

const TERMO_BUILT_CAPITAL_VERSAO = "built_capital_v1_provisorio";
const TERMO_BUILT_CAPITAL = `
TERMO PROVISÓRIO DE ACESSO AO BUILT CAPITAL

Este termo regula o acesso inicial ao BUILT Capital, ambiente restrito voltado à conexão, qualificação e relacionamento com parceiros de capital, investidores, originadores e participantes estratégicos da rede BUILT.

1. O acesso ao BUILT Capital não constitui recomendação de investimento, oferta pública, intermediação financeira, promessa de retorno, garantia de rentabilidade ou aprovação automática de aporte.

2. Toda decisão de aporte, crédito, investimento, financiamento ou parceria dependerá de análise própria, diligência, instrumentos específicos, registro e aprovação das partes envolvidas.

3. O usuário compromete-se a fornecer informações verdadeiras, manter seus dados atualizados, respeitar confidencialidade, compliance, origem lícita de recursos e legislação aplicável.

4. É vedado prometer retorno garantido, omitir riscos, captar recursos de forma irregular, compartilhar informações restritas sem autorização ou induzir terceiros a erro.

5. A BUILT atua como plataforma privada de método, rede, governança, rastreabilidade, organização informacional e proteção institucional, não assumindo obrigações financeiras dos participantes.

Ao aceitar este termo, o usuário declara estar ciente das regras provisórias de acesso ao BUILT Capital.
`.trim();

const IDIOMAS_DISPONIVEIS = [
  "Português", "Inglês", "Espanhol", "Francês", "Alemão", "Italiano",
  "Mandarim", "Japonês", "Árabe", "Russo", "Hindi", "Coreano",
  "Holandês", "Sueco", "Norueguês", "Dinamarquês", "Finlandês",
  "Polonês", "Turco", "Hebraico", "Grego", "Tailandês", "Vietnamita",
  "Indonésio", "Malaio", "Húngaro", "Tcheco", "Romeno", "Búlgaro",
  "Ucraniano", "Croata", "Sérvio", "Eslovaco", "Catalão", "Persa",
];

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
  };
}

function PerfilLocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (data: { localizacao: string; cidade: string; estado: string; pais: string; latitude: string; longitude: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelected(null);
      setError("");
    }
  }, [open]);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
      const response = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!response.ok) throw new Error();
      const data: NominatimResult[] = await response.json();
      if (data.length === 0) setError("Nenhum resultado encontrado. Tente outro termo.");
      setResults(data);
    } catch {
      setError("Falha ao buscar localização.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!selected) return;
    const addr = selected.address || {};
    const cidade = addr.city || addr.town || addr.municipality || addr.village || "";
    const estado = addr.state || "";
    const pais = addr.country || "";
    onSelect({
      localizacao: selected.display_name,
      cidade,
      estado,
      pais,
      latitude: selected.lat,
      longitude: selected.lon,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-brand-gold" />
            Selecionar localização
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Busque cidade, país ou endereço para preencher seu perfil.</p>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => event.key === "Enter" && handleSearch()}
            placeholder="Ex: Tokyo, São Paulo, Vila Velha..."
            data-testid="input-onboarding-location-search"
          />
          <Button type="button" onClick={handleSearch} disabled={loading || !search.trim()} data-testid="btn-onboarding-location-search">
            {loading ?<Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {results.map(result => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => setSelected(result)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${selected?.place_id === result.place_id ?"bg-muted" : ""}`}
            >
              {result.display_name}
            </button>
          ))}
          {error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
          {!error && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digite uma localização para buscar.</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected} data-testid="btn-onboarding-location-confirm">
            <MapPin className="h-4 w-4 mr-2" />
            Confirmar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerfilOnboardingModal({
  membroId,
  fallbackUser,
}: {
  membroId?: string | null;
  fallbackUser?: { nome?: string | null; email?: string | null } | null;
}) {
  const { toast } = useToast();
  const [location] = useLocation();
  const [form, setForm] = useState<Partial<OnboardingMembro>>({});
  const [profileCompletedLocally, setProfileCompletedLocally] = useState(false);
  const [idiomaInput, setIdiomaInput] = useState("");
  const [completed, setCompleted] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [codigoEticaAceito, setCodigoEticaAceito] = useState(false);
  const [termoVitrineAceito, setTermoVitrineAceito] = useState(false);
  const [termoAreaAliancasAceito, setTermoAreaAliancasAceito] = useState(false);
  const [termoBuiltCapitalAceito, setTermoBuiltCapitalAceito] = useState(false);

  const { data: membro, isLoading } = useQuery<OnboardingMembro>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  useEffect(() => {
    if (!membroId) {
      setProfileCompletedLocally(false);
      return;
    }
    setProfileCompletedLocally(window.localStorage.getItem(`built-profile-onboarding-completed:${membroId}`) === "1");
  }, [membroId]);

  useEffect(() => {
    if (membro) {
      const isBuiltCapitalMember = !!membro.em_built_capital;
      const tiposAlianca = Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : [];
      const nucleosAlianca = Array.isArray(membro.nucleos_alianca) ? membro.nucleos_alianca : [];
      const tiposComCapital = isBuiltCapitalMember && !tiposAlianca.includes(BUILT_CAPITAL_TIPO)
        ? [...tiposAlianca, BUILT_CAPITAL_TIPO]
        : tiposAlianca;
      const nucleosComCapital = isBuiltCapitalMember && !nucleosAlianca.includes(BUILT_CAPITAL_NUCLEO)
        ? [...nucleosAlianca, BUILT_CAPITAL_NUCLEO]
        : nucleosAlianca;
      setForm({
        ...membro,
        nome: membro.nome || fallbackUser?.nome || "",
        email: membro.email || fallbackUser?.email || "",
        tipos_alianca: tiposComCapital,
        nucleos_alianca: nucleosComCapital,
      });
      setCodigoEticaAceito(!!membro.codigo_etica_aceito_em);
      setTermoVitrineAceito(!!membro.vitrine_termo_aceito_em);
      setTermoAreaAliancasAceito(!!membro.area_aliancas_termo_aceito_em);
      setTermoBuiltCapitalAceito(!!membro.built_capital_termo_aceito_em);
    }
  }, [membro, fallbackUser?.nome, fallbackUser?.email]);

  const requiredMissing = false;
  const isVitrineRoute = location.startsWith("/vitrine");
  const isAreaAliancasRoute = location.startsWith("/area-aliancas");
  const isBuiltCapitalRoute = location.startsWith("/built-capital");
  const termoVitrinePendente = !!membro && isVitrineRoute && !membro.vitrine_termo_aceito_em;
  const termoAreaAliancasPendente = !!membro && isAreaAliancasRoute && !membro.area_aliancas_termo_aceito_em;
  const termoBuiltCapitalPendente = !!membro && isBuiltCapitalRoute && !membro.built_capital_termo_aceito_em;
  const termoModuloPendente = termoVitrinePendente || termoAreaAliancasPendente || termoBuiltCapitalPendente;
  const shouldOpen = !!membroId && !completed && !isLoading && !!membro && (requiredMissing || termoModuloPendente);
  const mostrarPerfilCompleto = requiredMissing;
  const termoModulo = termoVitrinePendente
    ? {
      titulo: "Termo BUILT Vitrine",
      descricao: "Para acessar a Vitrine pela primeira vez, confirme que leu e concorda com o Termo BUILT Vitrine.",
      texto: TERMO_VITRINE_BUILT,
      checked: termoVitrineAceito,
      setChecked: setTermoVitrineAceito,
      checkboxTestId: "checkbox-onboarding-termo-vitrine",
      wrapperTestId: "onboarding-termo-vitrine",
      accepted: !!membro?.vitrine_termo_aceito_em,
      payload: {
        vitrine_termo_aceito_em: new Date().toISOString(),
        vitrine_termo_versao: TERMO_VITRINE_BUILT_VERSAO,
      },
    }
    : termoAreaAliancasPendente
      ? {
        titulo: "Termo Área de Alianças",
        descricao: "Para acessar a Área de Alianças pela primeira vez, confirme que leu e concorda com o termo provisório.",
        texto: TERMO_AREA_ALIANCAS,
        checked: termoAreaAliancasAceito,
        setChecked: setTermoAreaAliancasAceito,
        checkboxTestId: "checkbox-onboarding-termo-area-aliancas",
        wrapperTestId: "onboarding-termo-area-aliancas",
        accepted: !!membro?.area_aliancas_termo_aceito_em,
        payload: {
          area_aliancas_termo_aceito_em: new Date().toISOString(),
          area_aliancas_termo_versao: TERMO_AREA_ALIANCAS_VERSAO,
        },
      }
      : termoBuiltCapitalPendente
        ? {
          titulo: "Termo BUILT Capital",
          descricao: "Para acessar o BUILT Capital pela primeira vez, confirme que leu e concorda com o termo provisório.",
          texto: TERMO_BUILT_CAPITAL,
          checked: termoBuiltCapitalAceito,
          setChecked: setTermoBuiltCapitalAceito,
          checkboxTestId: "checkbox-onboarding-termo-built-capital",
          wrapperTestId: "onboarding-termo-built-capital",
          accepted: !!membro?.built_capital_termo_aceito_em,
          payload: {
            built_capital_termo_aceito_em: new Date().toISOString(),
            built_capital_termo_versao: TERMO_BUILT_CAPITAL_VERSAO,
          },
        }
        : null;

  const salvarMutation = useMutation({
    mutationFn: async (payload: Partial<OnboardingMembro>) => {
      const response = await apiRequest("PATCH", `/api/membros/${membroId}`, payload);
      return response.json().catch(() => null);
    },
    onSuccess: (_data, variables) => {
      if (mostrarPerfilCompleto && membroId) {
        window.localStorage.setItem(`built-profile-onboarding-completed:${membroId}`, "1");
        setProfileCompletedLocally(true);
      }
      setCompleted(!(
        (isVitrineRoute && !membro?.vitrine_termo_aceito_em && !variables.vitrine_termo_aceito_em) ||
        (isAreaAliancasRoute && !membro?.area_aliancas_termo_aceito_em && !variables.area_aliancas_termo_aceito_em) ||
        (isBuiltCapitalRoute && !membro?.built_capital_termo_aceito_em && !variables.built_capital_termo_aceito_em)
      ));
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar perfil", variant: "destructive" }),
  });

  function setField(field: keyof OnboardingMembro, value: string | boolean | string[] | null) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function handleSave() {
    if (!mostrarPerfilCompleto) {
      if (!termoModulo) return;
      if (!termoModulo.checked) {
        toast({ title: `Aceite o ${termoModulo.titulo} para continuar`, variant: "destructive" });
        return;
      }

      salvarMutation.mutate(termoModulo.payload);
      return;
    }

    const required = [
      { field: "nome" as const, label: "Nome" },
      { field: "email" as const, label: "E-mail" },
      { field: "empresa" as const, label: "Empresa" },
      { field: "cidade" as const, label: "Localização" },
    ];
    const missing = required.find(item => !String(form[item.field] || "").trim());
    if (missing) {
      toast({ title: `Preencha o campo: ${missing.label}`, variant: "destructive" });
      return;
    }
    const isBuiltCapitalMember = !!form.em_built_capital;
    const tiposAlianca = isBuiltCapitalMember
      ? Array.from(new Set([...(form.tipos_alianca || []), BUILT_CAPITAL_TIPO]))
      : form.tipos_alianca || [];
    const nucleosAlianca = isBuiltCapitalMember
      ? Array.from(new Set([...(form.nucleos_alianca || []), BUILT_CAPITAL_NUCLEO]))
      : form.nucleos_alianca || [];

    salvarMutation.mutate({
      nome: String(form.nome || "").trim(),
      email: String(form.email || "").trim(),
      telefone: String(form.telefone || "").trim() || null,
      whatsapp: String(form.whatsapp || "").trim() || null,
      empresa: String(form.empresa || "").trim(),
      cargo: String(form.cargo || "").trim() || null,
      cidade: String(form.cidade || "").trim(),
      estado: String(form.estado || "").trim() || null,
      pais: String(form.pais || "").trim() || null,
      latitude: String(form.latitude || "").trim() || null,
      longitude: String(form.longitude || "").trim() || null,
      especialidade_livre: String(form.especialidade_livre || "").trim() || null,
      perfil_aliado: String(form.perfil_aliado || "").trim() || null,
      ramo_atuacao: String(form.ramo_atuacao || "").trim() || null,
      segmento: String(form.segmento || "").trim() || null,
      link_site: String(form.link_site || "").trim() || null,
      idiomas: form.idiomas || [],
      tipos_alianca: tiposAlianca,
      nucleos_alianca: nucleosAlianca,
      na_vitrine: !!form.na_vitrine,
      ...(termoModulo?.checked ? termoModulo.payload : {}),
    });
  }

  return (
    <Dialog open={shouldOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mostrarPerfilCompleto ?(
              <Briefcase className="h-5 w-5 text-brand-gold" />
            ) : (
              <ScrollText className="h-5 w-5 text-brand-gold" />
            )}
            {mostrarPerfilCompleto ?"Complete seu perfil" : termoModulo?.titulo}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {mostrarPerfilCompleto
              ?"Antes de continuar, preencha as informacoes principais. Esses dados tambem alimentam seu card, caso voce escolha aparecer na Vitrine."
              : termoModulo?.descricao}
          </p>
        </DialogHeader>

        {mostrarPerfilCompleto && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={form.nome || ""} onChange={e => setField("nome", e.target.value)} data-testid="input-onboarding-nome" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={form.email || ""} onChange={e => setField("email", e.target.value)} data-testid="input-onboarding-email" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone || ""} onChange={e => setField("telefone", e.target.value)} data-testid="input-onboarding-telefone" />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp || ""} onChange={e => setField("whatsapp", e.target.value)} data-testid="input-onboarding-whatsapp" />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <Input value={form.empresa || ""} onChange={e => setField("empresa", e.target.value)} data-testid="input-onboarding-empresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <Input value={form.cargo || ""} onChange={e => setField("cargo", e.target.value)} data-testid="input-onboarding-cargo" />
          </div>
          <div className="space-y-1.5">
            <Label>Ramo de Atuação</Label>
            <Select value={form.ramo_atuacao || ""} onValueChange={value => setForm(current => ({ ...current, ramo_atuacao: value, segmento: null }))}>
              <SelectTrigger data-testid="select-onboarding-ramo">
                <SelectValue placeholder="Selecione o ramo" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {RAMOS_SEGMENTOS.map(ramo => (
                  <SelectItem key={ramo.codigo} value={ramo.nome}>{ramo.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Select
              value={form.segmento || ""}
              onValueChange={value => setForm(current => ({ ...current, segmento: value }))}
              disabled={!form.ramo_atuacao}
            >
              <SelectTrigger data-testid="select-onboarding-segmento">
                <SelectValue placeholder={form.ramo_atuacao ?"Selecione o segmento" : "Selecione o ramo primeiro"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {getSegmentosForRamo(form.ramo_atuacao || "").map(segmento => (
                  <SelectItem key={segmento.codigo} value={segmento.nome}>{segmento.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Localização *</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 font-normal"
              onClick={() => setLocationPickerOpen(true)}
              data-testid="btn-onboarding-pick-location"
            >
              <Navigation className="h-4 w-4 text-brand-gold" />
              {[form.cidade, form.estado, form.pais].filter(Boolean).join(", ") || "Selecionar no Mapa"}
            </Button>
            {form.latitude && form.longitude && (
              <p className="text-[11px] text-muted-foreground font-mono">
                {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Especialidade (texto livre)</Label>
            <Input value={form.especialidade_livre || ""} onChange={e => setField("especialidade_livre", e.target.value)} data-testid="input-onboarding-especialidade" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Área de Contribuição</Label>
            {form.em_built_capital ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2.5 py-1 text-xs text-brand-gold">
                  {getTipoDisplayName(BUILT_CAPITAL_TIPO)}
                </span>
              </div>
            ) : (
              <>
                {(form.tipos_alianca || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.tipos_alianca || []).map(tipo => (
                      <span key={tipo} className="flex items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2.5 py-1 text-xs text-brand-gold">
                        {getTipoDisplayName(tipo)}
                        <button
                          type="button"
                          onClick={() => {
                            const novos = (form.tipos_alianca || []).filter(item => item !== tipo);
                            setForm(current => ({ ...current, tipos_alianca: novos, nucleos_alianca: getNucleosForTipos(novos) }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Select
                  value=""
                  onValueChange={value => {
                    if (!value || (form.tipos_alianca || []).includes(value)) return;
                    const novos = [...(form.tipos_alianca || []), value];
                    setForm(current => ({ ...current, tipos_alianca: novos, nucleos_alianca: getNucleosForTipos(novos) }));
                  }}
                >
                  <SelectTrigger className="w-auto" data-testid="select-onboarding-area">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    <span className="text-xs">Adicionar Área</span>
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {getAllTipos().filter(tipo => !(form.tipos_alianca || []).includes(tipo.nome)).map(tipo => (
                      <SelectItem key={tipo.nome} value={tipo.nome}>{getTipoDisplayName(tipo.nome)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              Idiomas Falados
            </Label>
            {(form.idiomas || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.idiomas || []).map(idioma => (
                  <span key={idioma} className="flex items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2.5 py-1 text-xs text-brand-gold">
                    {idioma}
                    <button type="button" onClick={() => setForm(current => ({ ...current, idiomas: (current.idiomas || []).filter(item => item !== idioma) }))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={idiomaInput}
              onChange={event => setIdiomaInput(event.target.value)}
              onKeyDown={event => {
                if (event.key !== "Enter" || !idiomaInput.trim()) return;
                const idioma = idiomaInput.trim();
                if (!(form.idiomas || []).includes(idioma)) {
                  setForm(current => ({ ...current, idiomas: [...(current.idiomas || []), idioma] }));
                }
                setIdiomaInput("");
                event.preventDefault();
              }}
              placeholder="Buscar ou digitar idioma..."
              data-testid="input-onboarding-idioma"
            />
            <div className="flex flex-wrap gap-1.5">
              {IDIOMAS_DISPONIVEIS
                .filter(idioma => !(form.idiomas || []).includes(idioma))
                .filter(idioma => !idiomaInput || idioma.toLowerCase().includes(idiomaInput.toLowerCase()))
                .slice(0, 8)
                .map(idioma => (
                  <button
                    key={idioma}
                    type="button"
                    onClick={() => setForm(current => ({ ...current, idiomas: [...(current.idiomas || []), idioma] }))}
                    className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-brand-gold/40 hover:text-foreground"
                  >
                    {idioma}
                  </button>
                ))}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Site / Portfólio</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" value={form.link_site || ""} onChange={e => setField("link_site", e.target.value)} data-testid="input-onboarding-site" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Biografia</Label>
            <Textarea value={form.perfil_aliado || ""} onChange={e => setField("perfil_aliado", e.target.value)} rows={4} data-testid="input-onboarding-biografia" />
          </div>
        </div>
        )}
        {!mostrarPerfilCompleto && termoModulo && (
        <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 p-4 space-y-3" data-testid={termoModulo.wrapperTestId}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-brand-gold/15 p-2 text-brand-gold">
              <ScrollText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{termoModulo.titulo}</p>
              <p className="text-xs text-muted-foreground">Leia e confirme para liberar o acesso.</p>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background p-3">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{termoModulo.texto}</pre>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={termoModulo.checked}
              onChange={event => termoModulo.setChecked(event.target.checked)}
              disabled={termoModulo.accepted}
              className="mt-1 h-4 w-4 accent-brand-gold"
              data-testid={termoModulo.checkboxTestId}
            />
            <span className="text-muted-foreground">
              Li e concordo com o {termoModulo.titulo}.
              {termoModulo.accepted && (
                <span className="block text-xs text-emerald-600 mt-1">Aceite já registrado.</span>
              )}
            </span>
          </label>
        </div>
        )}
        {mostrarPerfilCompleto && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Aparecer na Vitrine</p>
            <p className="text-xs text-muted-foreground">Usar os dados do perfil no seu card publico.</p>
          </div>
          <UiSwitch
            checked={!!form.na_vitrine}
            onCheckedChange={checked => setField("na_vitrine", checked)}
            data-testid="switch-onboarding-na-vitrine"
          />
        </div>
        )}

        <DialogFooter>
          <Button onClick={handleSave} disabled={salvarMutation.isPending} className="gap-2" data-testid="btn-salvar-onboarding-perfil">
            {salvarMutation.isPending ?<Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mostrarPerfilCompleto ?"Salvar perfil" : "Aceitar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <PerfilLocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(data) => setForm(current => ({
          ...current,
          cidade: data.cidade || data.localizacao,
          estado: data.estado,
          pais: data.pais,
          latitude: data.latitude,
          longitude: data.longitude,
        }))}
      />
    </Dialog>
  );
}

function TermsRedirect({ token }: { token: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(`/adesao/${token}`); }, [token]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-8 h-8 border-2 border-[#D7BB7D]/30 border-t-[#D7BB7D] rounded-full animate-spin" />
    </div>
  );
}

function ProtectedApp() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;
    const convite = user.convite_pendente || user.adesao_pendente;
    if (!convite?.token || !convite.status) return;

    const key = `built-convite-toast:${user.id}:${convite.token}:${convite.status}`;
    if (window.localStorage.getItem(key)) return;

    const statusText: Record<string, string> = {
      termos_pendentes: "Você recebeu um convite. Aceite os termos para continuar.",
      termos_aceitos: "Seus termos foram aceitos. Continue o fluxo de convite.",
      aguardando_avaliacao_aura: "Seu convite está aguardando avaliação de Aura.",
      candidato: "Sua candidatura está em análise.",
      pagamento_pendente: "Seu convite tem pagamento pendente.",
    };

    toast({
      title: "Convite recebido",
      description: statusText[convite.status] || "Há uma atualização no seu convite.",
    });
    window.localStorage.setItem(key, "1");
  }, [toast, user?.id, user?.convite_pendente?.token, user?.convite_pendente?.status, user?.adesao_pendente?.token, user?.adesao_pendente?.status]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
        <div className="w-8 h-8 border-2 border-[#D7BB7D]/30 border-t-[#D7BB7D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Block pending vitrine users — route based on their current stage
  if (user?.pending_vitrine) {
    const convitePendente = user.convite_pendente ?? null;
    if (convitePendente?.token && ["termos_pendentes", "termos_aceitos", "aguardando_avaliacao_aura"].includes(convitePendente.status)) {
      return <TermsRedirect token={convitePendente.token} />;
    }
    return <AguardandoAprovacaoPage />;
  }

  async function handleLogout() {
    try {
      await logout();
      navigate("/");
    } catch {
      toast({ title: "Erro ao sair", variant: "destructive" });
    }
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <PerfilOnboardingModal membroId={user?.membro_directus_id} fallbackUser={user} />
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-2 p-3 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{user?.nome || user?.username}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Switch>
              <Route path="/" component={PainelPage} />
              <Route path="/bias/:id" component={BiaDetalhePage} />
              <Route path="/bias" component={BiasPage} />
              <Route path="/opas/:id" component={OpaDetalhePage} />
              <Route path="/opas" component={OportunidadesPage} />
              <Route path="/bias-calculadora" component={BiasCalculadoraPage} />
              <Route path="/fluxo-caixa" component={FluxoCaixaPage} />
              <Route path="/resultados" component={ResultadosPage} />
              <Route path="/diretoria-alianca" component={DiretoriaAliancaPage} />
              <Route path="/nucleo-tecnico" component={NucleoTecnicoPage} />
              <Route path="/nucleo-obra" component={NucleoObraPage} />
              <Route path="/nucleo-comercial" component={NucleoComercialPage} />
              <Route path="/nucleo-capital" component={NucleoCapitalPage} />
              <Route path="/gestao-opas" component={GestaoOpasPage} />
              <Route path="/gestao-bias" component={GestaoBiasPage} />
              <Route path="/vitrine/:id" component={VitrineDetalhePage} />
              <Route path="/vitrine" component={VitrinePage} />
              <Route path="/area-aliancas" component={AreaAliancasPage} />
              <Route path="/area-membros" component={AreMembroPage} />
              <Route path="/membro/:id" component={MembroDetalhePage} />
              <Route path="/comunidade/:id" component={ComunidadeDetalhePage} />
              <Route path="/comunidade" component={ComunidadePage} />
              <Route path="/notificacoes" component={ConvitesPage} />
              <Route path="/convites" component={ConvitesPage} />
              <Route path="/built-capital" component={BuiltCapitalPage} />
              <Route path="/membros" component={MembrosPage} />
              <Route path="/aura" component={AuraPage} />
              <Route path="/painel" component={PainelPage} />
              <Route path="/meu-perfil" component={MeuPerfilPage} />
              <Route path="/documentacao" component={DocumentacaoPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/aguardando-aprovacao" component={AguardandoAprovacaoPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/convite/:token" component={ConvitePage} />
          <Route path="/adesao/:token" component={AdesaoPage} />
          <Route path="/avaliar-aura/:token" component={AvaliarAuraCandidatoPage} />
          <Route path="/pagamento/sucesso" component={PagamentoSucessoPage} />
          <Route path="/pagamento/:token" component={PagamentoPage} />
          <Route component={ProtectedApp} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;


