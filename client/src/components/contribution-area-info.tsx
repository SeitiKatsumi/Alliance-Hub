import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const AREA_INFO_CONFIG: Record<string, { nucleo: string; cpp: string; description: string; footer?: string }> = {
  "Liderança Técnica": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança Técnica",
    description: "Coordenação técnica, integração das alianças técnicas, viabilidade, conformidade e prevenção de riscos.",
  },
  "Liderança de Obras": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança de Obras",
    description: "Coordenação da execução, integração de equipes, fornecedores, cronograma, qualidade e aderência aos projetos.",
  },
  "Liderança Comercial": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança Comercial",
    description: "Coordenação comercial, integração de vendas, locação, marketing, relacionamento e geração de receita.",
  },
  "Liderança de Capital": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança de Capital",
    description: "Coordenação econômica e financeira, integração de investimentos, captação, controle, prestação de contas e resultados.",
  },
  "Projeto": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Arquitetos, engenheiros, projetistas, designers, urbanistas e demais profissionais responsáveis pela concepção, desenvolvimento, compatibilização e detalhamento técnico dos projetos.",
    footer: "Contribui para a viabilidade técnica, consistência dos projetos e conformidade das entregas.",
  },
  "Jurídicas": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Profissionais especializados em direito imobiliário, societário, contratual, urbanístico, regulatório e compliance jurídico, responsáveis pela segurança jurídica das operações, contratos, ativos e relações da BIA.",
    footer: "Ajuda a garantir conformidade legal e prevenção de riscos.",
  },
  "Inteligência": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Especialistas em inteligência de mercado, estudos de viabilidade, análise de produto, estratégia imobiliária, masterplan, posicionamento e modelagem da oportunidade.",
    footer: "Apoia decisões estratégicas e leitura de mercado da BIA.",
  },
  "Integridade e sustentabilidade": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Profissionais de compliance, segurança, qualidade, consultoria, auditoria, meio ambiente e ESG, responsáveis por fortalecer conformidade, prevenção de riscos, qualidade das entregas e sustentabilidade da BIA.",
  },
  "Execução": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Profissionais e equipes responsáveis pela execução direta dos serviços de obra, incluindo engenheiros de obra, mestres, encarregados, supervisores, técnicos e demais executores especializados.",
  },
  "Construção": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Construtoras, empreiteiras, subempreiteiras e empresas especializadas responsáveis pela execução de etapas construtivas, frentes de serviço, instalações, montagem, reforma, retrofit ou construção integral.",
  },
  "Fornecimento": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Fornecedores de materiais, insumos, equipamentos, ferramentas, sistemas construtivos, soluções técnicas e serviços logísticos necessários à execução da obra.",
    footer: "Garante execução física com controle de prazo, custo, qualidade, fornecimento e aderência aos projetos aprovados.",
  },
  "Comerciais": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Corretores, executivos de negócios, articuladores comerciais e parceiros de mercado responsáveis por prospecção, abertura de portas, negociação, captação de demanda e conversão de oportunidades.",
  },
  "Vendas e Locação": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Corretores, consultores, imobiliárias, plataformas e canais especializados responsáveis pela comercialização, locação, permuta, ocupação ou distribuição comercial do ativo.",
  },
  "Marketing": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Profissionais e empresas de marketing, branding, performance, conteúdo, mídia, eventos e relacionamento responsáveis por posicionar a BIA, gerar demanda qualificada e fortalecer a percepção de valor do ativo.",
  },
  "Operações e Facilities": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Operadores, gestores de facilities, administradoras, manutenção, terceirização e prestadores responsáveis pela operação, conservação, eficiência, ocupação e experiência de uso do ativo.",
  },
  "Gestão de Relacionamento com Cliente": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Profissionais e empresas responsáveis por atendimento, pós-venda, SAC, garantias, jornada do cliente, retenção, reputação e continuidade da relação comercial.",
    footer: "Transforma o ativo físico em ativo econômico por meio de venda, locação, operação, relacionamento e geração de receita.",
  },
  "Aporte Financeiro": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Investidores, cotistas, financiadores e parceiros de capital responsáveis por aportar recursos financeiros.",
  },
  "Crédito e Captação": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Bancos, instituições financeiras, fundos, securitizadoras, family offices e parceiros de crédito responsáveis por viabilizar recursos, financiamentos, antecipações, operações de crédito e demais instrumentos de captação para a BIA.",
  },
  "Contábeis e Tributárias": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Profissionais e empresas responsáveis pela contabilidade, planejamento tributário, obrigações fiscais e acessórias, apuração de tributos, relatórios contábeis, prestação de contas e conformidade fiscal da BIA.",
  },
  "Gestão Financeira": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Profissionais e empresas responsáveis pelo planejamento financeiro, fluxo de caixa, controladoria, projeções, acompanhamento orçamentário, gestão financeira da operação e suporte à tomada de decisão econômica da BIA.",
    footer: "Garante gestão econômica, financeira, contábil e tributária com controle de caixa, transparência, conformidade fiscal e apuração segura dos resultados.",
  },
};

export function ContributionAreaInfo({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const info = AREA_INFO_CONFIG[label];

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => clearCloseTimer(), []);

  if (!info) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Informações sobre ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            clearCloseTimer();
            setOpen(true);
          }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            clearCloseTimer();
            setOpen(true);
          }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          clearCloseTimer();
          setOpen(true);
        }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
        className="w-80 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto space-y-2 text-left"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{info.nucleo}</p>
          <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{info.cpp}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-popover-foreground">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{info.description}</p>
        </div>
        {info.footer && <p className="border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">{info.footer}</p>}
      </PopoverContent>
    </Popover>
  );
}
