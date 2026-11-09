import { z } from 'zod';
import { propertyThesisCode } from './property-thesis';
import { normalizePropertyCib } from './property-cib';

/** Manual BUILT v2 (30/10/2026). Assumptions are evidence, never certified market facts. */
export const BUILT_METHOD_VERSION = 'built-v2.1';
export const BUILT_RESULT_LABELS: Record<string, string> = { registro_documental: 'Registro documental', simulacao: 'Simulação', estimativa_de_mercado: 'Estimativa de mercado' };
export const BUILT_CATEGORY_LABELS: Record<string, string> = { residencial: 'Residencial', comercial: 'Comercial', logistico: 'Logística e indústria', terreno: 'Terreno', rural: 'Rural', hospedagem: 'Hospedagem', especializado: 'Ativo especializado' };
export const BUILT_SCENARIO_LABELS: Record<string, string> = { conservador: 'Conservador', central: 'Central', favoravel: 'Favorável' };
export const BUILT_METHODS = [
  ['comparativo', 'Comparação de mercado'], ['renda', 'Capitalização da renda'],
  ['fluxo', 'Fluxo de caixa descontado'], ['custo', 'Reposição com depreciação'],
  ['residual', 'Residual / desenvolvimento'], ['documental', 'Valor documental'],
] as const;
export const INFORMATION_CLASSES = [
  ['documentada', 'Documentada'], ['informada', 'Informada pelo usuário'],
  ['referenciada', 'Estimada com referências'], ['hipotetica', 'Hipotética'],
] as const;
export const FLOW_CATEGORIES = [
  ['aquisicao', 'Aquisição / valor de entrada'], ['obra', 'Obra e investimentos'],
  ['operacao', 'Despesa operacional'], ['tributos', 'Tributos e custos de saída'],
  ['venda', 'Receita de venda / valor terminal'], ['aluguel', 'Receita de locação / operação'],
  ['credito', 'Financiamento recebido'], ['amortizacao', 'Amortização da dívida'], ['juros', 'Juros'],
] as const;
export const PROPERTY_SPECIFIC_FIELDS: Record<string, string[]> = {
  residencial: ['Dormitórios, banheiros e vagas', 'Andar, elevador e acessibilidade'],
  comercial: ['Visibilidade e acesso', 'Configuração e contratos'],
  logistico: ['Altura interna e docas', 'Capacidade do piso e acesso rodoviário'],
  terreno: ['Topografia e infraestrutura', 'Possibilidades legais de utilização'],
  rural: ['Uso produtivo, solo e água', 'Acesso, benfeitorias e restrições'],
  hospedagem: ['Unidades disponíveis, ocupação e diárias', 'Despesas e investimentos'],
  especializado: ['Características técnicas da operação', 'Restrições e instalações'],
};
const text = z.string().trim().min(1).max(2000);
const optionalText = z.string().trim().max(4000).default('');
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, 'Data inválida');
export const evidenceSchema = z.object({
  classificacao: z.enum(['documentada', 'informada', 'referenciada', 'hipotetica']),
  fonte: text, data: dateOnly,
  verificacao: z.enum(['nao_conferida', 'conferida_pelo_usuario']),
  documentoId: z.string().uuid().optional(), limitacao: optionalText,
});
export const amountSchema = evidenceSchema.extend({ valor: z.number().finite().min(0).max(1e14) });
export type AmountEvidence = z.infer<typeof amountSchema>;
const percentSchema = amountSchema.refine(a => a.valor <= 100, 'Percentual deve estar entre 0 e 100');
const rateSchema = amountSchema.refine(a => a.valor > 0 && a.valor <= 100, 'Taxa anual deve ser maior que zero e até 100%');
export const flowSchema = z.object({
  id: z.string().min(1).max(80), data: dateOnly, descricao: text,
  categoria: z.enum(['aquisicao', 'obra', 'operacao', 'tributos', 'venda', 'aluguel', 'credito', 'amortizacao', 'juros']),
  valor: amountSchema,
});
export type BuiltFlow = z.infer<typeof flowSchema>;
const flowsSchema = z.array(flowSchema).min(1).max(360).refine(rows => new Set(rows.map(r => r.id)).size === rows.length, 'Lançamentos repetidos');
const comparableSchema = z.object({
  identificador: text, natureza: z.enum(['anuncio', 'transacao']), categoria: text,
  regiao: text, data: dateOnly, unidadeArea: z.enum(['privativa_m2', 'construida_m2', 'terreno_m2', 'terreno_ha']),
  area: z.number().finite().positive().max(1e12), preco: amountSchema,
  justificativa: text,
});
const methodSchema = z.discriminatedUnion('metodo', [
  z.object({ metodo: z.literal('comparativo'), area: amountSchema.refine(a => a.valor > 0), unidadeArea: comparableSchema.shape.unidadeArea, comparaveis: z.array(comparableSchema).max(40) }),
  z.object({ metodo: z.literal('renda'), receitaAnual: amountSchema, despesaAnual: amountSchema, perdasAnuais: amountSchema, taxaCapitalizacao: rateSchema }),
  z.object({ metodo: z.literal('fluxo'), taxaDesconto: rateSchema, fluxos: flowsSchema }),
  z.object({ metodo: z.literal('custo'), terreno: amountSchema, reposicao: amountSchema, depreciacaoFisica: percentSchema, depreciacaoFuncional: percentSchema, depreciacaoExterna: percentSchema }),
  z.object({ metodo: z.literal('residual'), taxaDesconto: rateSchema, margemEmpreendedor: percentSchema, fluxos: flowsSchema }),
  z.object({ metodo: z.literal('documental'), valor: amountSchema, natureza: z.enum(['aquisicao', 'fiscal', 'avaliacao_anterior', 'expectativa']) }),
]);
const scenarioSchema = z.object({
  nome: z.enum(['conservador', 'central', 'favoravel']), premissas: text,
  variacaoVenda: z.number().finite().min(-100).max(1000), variacaoCustos: z.number().finite().min(-100).max(1000),
  atrasoMeses: z.number().int().min(0).max(120), ocupacaoPercentual: z.number().finite().min(0).max(100),
  inadimplenciaPercentual: z.number().finite().min(0).max(100), aprovada: z.boolean(),
});
export const builtCaseSchema = z.object({
  titulo: text, finalidade: text, dataBase: dateOnly, moeda: z.string().regex(/^[A-Z]{3}$/),
  categoria: z.enum(['residencial', 'comercial', 'logistico', 'terreno', 'rural', 'hospedagem', 'especializado']),
  direito: text, participacaoPercentual: z.number().finite().min(0).max(100),
  tese: z.string().refine(v => !!propertyThesisCode(v), 'Selecione uma tese'),
  contexto: z.enum(['atual', 'condicionado']), condicoes: optionalText, dataCondicionada: dateOnly.optional(),
  restricoes: text, condicaoAtual: text, vistoria: z.enum(['nao_realizada', 'informada_com_documento']),
  vistoriaDocumentoId: z.string().uuid().optional(), inscricaoMunicipal: optionalText,
  caracteristicas: z.array(evidenceSchema.extend({ nome: text, conteudo: text })).max(40),
  cib: z.object({ codigo: text.transform((v, ctx) => { try { return normalizePropertyCib(v); } catch { ctx.addIssue({ code: 'custom', message: 'Informe os oito caracteres do CIB' }); return z.NEVER; } }), fonte: text, data: dateOnly, verificacao: z.literal('nao_validado_oficialmente') }).optional(),
  valorVendaParticipacao: amountSchema.optional(),
  calculo: methodSchema,
  estrategia: z.object({ taxaDesconto: rateSchema, fluxos: flowsSchema, cenarios: z.array(scenarioSchema).length(3),
    dataSaida: dateOnly, retornoAlvoPercentual: z.number().finite().min(0).max(1000) }).optional(),
  limitacoes: text,
}).superRefine((value, ctx) => {
  if (value.contexto === 'condicionado' && (!value.condicoes || !value.dataCondicionada || value.dataCondicionada < value.dataBase))
    ctx.addIssue({ code: 'custom', path: ['condicoes'], message: 'Informe as condições e uma data futura ou igual à data-base' });
  if (value.estrategia && new Set(value.estrategia.cenarios.map(c => c.nome)).size !== 3)
    ctx.addIssue({ code: 'custom', path: ['estrategia', 'cenarios'], message: 'Informe os três cenários distintos' });
  if (value.estrategia && (value.estrategia.dataSaida < value.dataBase || value.estrategia.fluxos.some(f => f.data > value.estrategia!.dataSaida)))
    ctx.addIssue({ code: 'custom', path: ['estrategia', 'dataSaida'], message: 'A data de saída deve alcançar todos os fluxos da estratégia' });
  if (value.vistoria === 'informada_com_documento' && !value.vistoriaDocumentoId)
    ctx.addIssue({ code: 'custom', path: ['vistoriaDocumentoId'], message: 'Vincule o documento da vistoria deste imóvel' });
  const flows = 'fluxos' in value.calculo ? value.calculo.fluxos : [];
  if ([...flows, ...(value.estrategia?.fluxos || [])].some(f => f.data < value.dataBase))
    ctx.addIssue({ code: 'custom', path: ['dataBase'], message: 'Fluxos anteriores à data-base devem ser tratados no desempenho observado, não na projeção' });
  if (value.calculo.metodo === 'residual' && value.calculo.fluxos.some(f => f.categoria === 'aquisicao'))
    ctx.addIssue({ code: 'custom', path: ['calculo', 'fluxos'], message: 'O residual calcula o valor disponível para adquirir o terreno; não desconte sua aquisição outra vez' });
});
export type BuiltCase = z.infer<typeof builtCaseSchema>;
export function builtEvidenceLabel(input: BuiltCase, path: string) {
  const parts = path.split('.');
  if (parts[0] === 'caracteristicas') return input.caracteristicas[Number(parts[1])]?.nome || 'Característica';
  if (parts[1] === 'comparaveis') return `Referência ${Number(parts[2]) + 1} — preço`;
  if (parts[1] === 'fluxos') {
    const rows = parts[0] === 'estrategia' ? input.estrategia?.fluxos : 'fluxos' in input.calculo ? input.calculo.fluxos : [];
    return `${parts[0] === 'estrategia' ? 'Estratégia' : 'Avaliação'} — ${rows?.[Number(parts[2])]?.descricao || 'Fluxo financeiro'}`;
  }
  const labels: Record<string, string> = { valor: 'Valor de referência', area: 'Área de comparação', receitaAnual: 'Receita anual sustentável', despesaAnual: 'Despesas operacionais anuais', perdasAnuais: 'Perdas anuais', taxaCapitalizacao: 'Taxa de capitalização (%)', taxaDesconto: 'Taxa de desconto (%)', terreno: 'Valor do terreno', reposicao: 'Reposição da construção', depreciacaoFisica: 'Perda física (%)', depreciacaoFuncional: 'Perda funcional (%)', depreciacaoExterna: 'Perda externa (%)', margemEmpreendedor: 'Margem do empreendedor (%)', valorVendaParticipacao: 'Venda isolada da participação' };
  return labels[parts.at(-1)!] || 'Informação de referência';
}
export function builtValidationMessage(issues: z.ZodIssue[]) {
  const labels: Record<string, string> = { titulo: 'Nome da alternativa', finalidade: 'Finalidade', dataBase: 'Data-base', categoria: 'Categoria', direito: 'Direito avaliado', participacaoPercentual: 'Participação', tese: 'Tese', condicoes: 'Condições', dataCondicionada: 'Data das condições', restricoes: 'Restrições', condicaoAtual: 'Condição atual', vistoriaDocumentoId: 'Documento da vistoria',
    caracteristicas: 'Características', nome: 'Nome', conteudo: 'Conteúdo', inscricaoMunicipal: 'Inscrição municipal', area: 'Área', unidadeArea: 'Natureza da área', fonte: 'Fonte', data: 'Data da informação', classificacao: 'Origem da informação', receitaAnual: 'Receita anual sustentável', despesaAnual: 'Despesas operacionais anuais', perdasAnuais: 'Perdas anuais', taxaCapitalizacao: 'Taxa de capitalização', taxaDesconto: 'Taxa de desconto', terreno: 'Valor do terreno', reposicao: 'Reposição', depreciacaoFisica: 'Perda física', depreciacaoFuncional: 'Perda por inadequação', depreciacaoExterna: 'Perda externa', margemEmpreendedor: 'Margem do empreendedor', descricao: 'Descrição', fluxos: 'Recebimentos e gastos', comparaveis: 'Referências', identificador: 'Identificação da referência', regiao: 'Localização', justificativa: 'Justificativa', limitacoes: 'Limitações e riscos', dataSaida: 'Data de saída', retornoAlvoPercentual: 'Retorno alvo', variacaoVenda: 'Variação da venda', variacaoCustos: 'Variação dos gastos', atrasoMeses: 'Atraso', ocupacaoPercentual: 'Ocupação', inadimplenciaPercentual: 'Inadimplência', premissas: 'Premissas do cenário', credencial: 'Responsável e registro profissional', escopo: 'Alcance da revisão', parecer: 'Parecer', documentoId: 'Documento', confirmoResponsabilidade: 'Confirmação', moeda: 'Moeda', linhas: 'Amostra', anteriorId: 'Revisão anterior', casoId: 'Alternativa', valorAnterior: 'Valor anterior' };
  return issues.slice(0, 5).map(issue => {
    const parts = issue.path.filter(p => typeof p === 'string' && p !== 'valor' && p !== 'calculo' && p !== 'estrategia');
    const label = labels[String(parts.at(-1))] || 'Informação da análise';
    const message = issue.code === 'custom' ? issue.message : issue.code === 'too_small' ? 'preencha este campo com um valor válido' : issue.code === 'too_big' ? 'valor acima do limite permitido' : issue.code === 'invalid_type' ? 'preencha com um valor válido' : 'confira o formato ou a opção escolhida';
    return `${label}: ${message}`;
  }).join(' · ');
}
export const roundMoney = (n: number) => {
  if (!Number.isFinite(n) || Math.abs(n) > 1e15) throw new Error('Resultado fora dos limites de cálculo');
  return Math.round((n + Number.EPSILON) * 100) / 100;
};
const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b), m = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[m] : (ordered[m - 1] + ordered[m]) / 2;
};
function referenceIdentity(value: string) {
  try { const url = new URL(value); url.search = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); }
  catch { return value.trim().toLocaleLowerCase(); }
}
const isRevenue = (flow: BuiltFlow) => ['venda', 'aluguel'].includes(flow.categoria);
const isFinancing = (flow: BuiltFlow) => ['credito', 'amortizacao', 'juros'].includes(flow.categoria);
const signed = (flow: BuiltFlow) => ['venda', 'aluguel', 'credito'].includes(flow.categoria) ? flow.valor.valor : -flow.valor.valor;
const yearFraction = (date: string, base: string) => (Date.parse(date + 'T00:00:00Z') - Date.parse(base + 'T00:00:00Z')) / 86400000 / 365;
export function datedCashFlow(flows: BuiltFlow[], base: string, annualRate: number) {
  const project = flows.filter(f => !isFinancing(f));
  const pv = (items: BuiltFlow[]) => roundMoney(items.reduce((sum, f) => sum + signed(f) / (1 + annualRate / 100) ** yearFraction(f.data, base), 0));
  const revenue = project.filter(isRevenue).reduce((s, f) => s + f.valor.valor, 0);
  const costs = project.filter(f => !isRevenue(f)).reduce((s, f) => s + f.valor.valor, 0);
  return { receitas: roundMoney(revenue), gastos: roundMoney(costs), resultadoProjeto: roundMoney(revenue - costs),
    valorPresenteProjeto: pv(project), fluxoProprietario: roundMoney(flows.reduce((s, f) => s + signed(f), 0)),
    valorPresenteProprietario: pv(flows), prazoDias: Math.round(Math.max(0, ...flows.map(f => yearFraction(f.data, base) * 365))),
    retornoSobreGastosPercentual: costs ? roundMoney((revenue - costs) / costs * 100) : null };
}
function shiftMonths(date: string, months: number) {
  const d = new Date(date + 'T00:00:00Z'), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10);
}
function collectEvidence(value: unknown, path = ''): { campo: string; evidencia: AmountEvidence | z.infer<typeof evidenceSchema> }[] {
  if (!value || typeof value !== 'object') return [];
  if ('classificacao' in value && 'fonte' in value) return [{ campo: path, evidencia: value as AmountEvidence }];
  return Object.entries(value).flatMap(([key, child]) => collectEvidence(child, path ? `${path}.${key}` : key));
}
export function calculateBuiltCase(raw: unknown) {
  const input = builtCaseSchema.parse(raw), c = input.calculo;
  const evidence = collectEvidence(input);
  const pending: string[] = [];
  let value: number | null = null, formula = '', range: { minimo: number; maximo: number } | null = null;
  let accepted = 0;
  if (c.metodo === 'documental') {
    value = c.valor.valor; formula = `${({ aquisicao: 'Valor de aquisição', fiscal: 'Valor fiscal', avaliacao_anterior: 'Avaliação anterior', expectativa: 'Expectativa do proprietário' })[c.natureza]} registrado, sem reavaliação de mercado`;
  } else if (c.metodo === 'comparativo') {
    const seen = new Set<string>();
    const refs = c.comparaveis.filter(r => {
      const key = referenceIdentity(r.identificador);
      if (seen.has(key) || r.categoria !== input.categoria || r.unidadeArea !== c.unidadeArea || r.preco.classificacao === 'hipotetica'
        || r.preco.valor <= 0 || r.data > input.dataBase || r.preco.data > input.dataBase) return false;
      seen.add(key); return true;
    });
    accepted = refs.length;
    if (refs.length < 3) pending.push('São necessárias pelo menos três referências distintas compatíveis e com fonte, data e justificativa.');
    else {
      const units = refs.map(r => r.preco.valor / r.area);
      value = roundMoney(median(units) * c.area.valor);
      range = { minimo: roundMoney(Math.min(...units) * c.area.valor), maximo: roundMoney(Math.max(...units) * c.area.valor) };
    }
    formula = 'Mediana dos preços por unidade de área × área do imóvel; diferenças justificadas individualmente, sem ajuste arbitrário';
  } else if (c.metodo === 'renda') {
    const noi = c.receitaAnual.valor - c.despesaAnual.valor - c.perdasAnuais.valor;
    if (noi <= 0) pending.push('A renda operacional líquida sustentável deve ser positiva para capitalização direta.');
    else value = roundMoney(noi / (c.taxaCapitalizacao.valor / 100));
    formula = '(Receita anual − despesas operacionais anuais − perdas anuais) ÷ taxa anual de capitalização';
  } else if (c.metodo === 'custo') {
    value = roundMoney(c.terreno.valor + c.reposicao.valor * (1 - c.depreciacaoFisica.valor / 100) * (1 - c.depreciacaoFuncional.valor / 100) * (1 - c.depreciacaoExterna.valor / 100));
    formula = 'Terreno + reposição × (1 − perda física) × (1 − perda funcional) × (1 − perda externa); depreciações sucessivas explícitas';
  } else {
    const project = c.fluxos.filter(f => !isFinancing(f));
    if (!project.some(isRevenue)) pending.push('Informe recebimentos futuros ou valor terminal, com fonte e data.');
    else {
      value = datedCashFlow(c.fluxos, input.dataBase, c.taxaDesconto.valor).valorPresenteProjeto;
      if (c.metodo === 'residual') {
        const pvRevenue = project.filter(isRevenue).reduce((s, f) => s + f.valor.valor / (1 + c.taxaDesconto.valor / 100) ** yearFraction(f.data, input.dataBase), 0);
        value = roundMoney(value - pvRevenue * c.margemEmpreendedor.valor / 100);
      }
    }
    formula = 'Σ fluxo do projeto ÷ (1 + taxa anual)^(dias/365)' + (c.metodo === 'residual' ? ' − margem do empreendedor sobre receitas a valor presente; residual disponível para o terreno' : '; financiamento apresentado separadamente');
  }
  const scenarios = input.estrategia?.cenarios.map(s => {
    if (!s.aprovada) return { nome: s.nome, premissas: s.premissas, status: 'condicao_nao_atendida' as const, indicadores: null };
    const flows = input.estrategia!.fluxos.map(f => ({ ...f,
      data: f.categoria === 'aquisicao' || isFinancing(f) ? f.data : shiftMonths(f.data, s.atrasoMeses),
      valor: { ...f.valor, valor: f.valor.valor * (f.categoria === 'venda' ? (1 + s.variacaoVenda / 100)
        : f.categoria === 'aluguel' ? s.ocupacaoPercentual / 100 * (1 - s.inadimplenciaPercentual / 100)
          : !isFinancing(f) && f.categoria !== 'aquisicao' ? (1 + s.variacaoCustos / 100) : 1) },
    }));
    return { nome: s.nome, premissas: s.premissas, status: 'simulado' as const, indicadores: datedCashFlow(flows, input.dataBase, input.estrategia!.taxaDesconto.valor) };
  }) || [];
  const strategy = input.estrategia ? datedCashFlow(input.estrategia.fluxos, input.dataBase, input.estrategia.taxaDesconto.valor) : null;
  const simulation = collectEvidence(c).some(e => e.evidencia.classificacao === 'hipotetica') || c.metodo !== 'comparativo';
  const classification = c.metodo === 'documental' ? (c.valor.classificacao === 'documentada' ? 'registro_documental' : 'simulacao') : simulation ? 'simulacao' : 'estimativa_de_mercado';
  let priceRequired: { equilibrio: number; retornoAlvo: number; retornoAlvoPercentual: number; dataSaida: string } | null = null;
  if (input.estrategia) {
    const s = input.estrategia, factor = (d: string) => (1 + s.taxaDesconto.valor / 100) ** yearFraction(d, input.dataBase);
    const costsPV = s.fluxos.filter(f => !isFinancing(f) && !isRevenue(f)).reduce((sum, f) => sum + f.valor.valor / factor(f.data), 0);
    const otherRevenuePV = s.fluxos.filter(f => f.categoria === 'aluguel').reduce((sum, f) => sum + f.valor.valor / factor(f.data), 0);
    priceRequired = { equilibrio: roundMoney((costsPV - otherRevenuePV) * factor(s.dataSaida)),
      retornoAlvo: roundMoney((costsPV * (1 + s.retornoAlvoPercentual / 100) - otherRevenuePV) * factor(s.dataSaida)),
      retornoAlvoPercentual: s.retornoAlvoPercentual, dataSaida: s.dataSaida };
  }
  return { versao: BUILT_METHOD_VERSION, classificacao: classification, status: value == null ? 'pendente' : 'calculada',
    valorAtual: input.contexto === 'atual' ? value : null, valorCondicionado: input.contexto === 'condicionado' ? value : null,
    parcelaProporcional: value == null ? null : roundMoney(value * input.participacaoPercentual / 100),
    valorVendaIsoladaParticipacao: input.valorVendaParticipacao?.valor ?? null,
    valorCalculado: value, faixaObservada: range, referenciasAceitas: accepted, formula, evidencias: evidence,
    estrategia: strategy, precoNecessario: priceRequired, cenarios: scenarios, pendencias: pending,
    revisaoRecomendada: input.categoria !== 'residencial' || !!input.restricoes && input.restricoes.toLowerCase() !== 'nenhuma conhecida' || c.metodo !== 'comparativo',
    limitacoes: [input.limitacoes, 'Informações e documentos declarados não equivalem a vistoria ou validação profissional.',
      'Anúncios não comprovam preços de transações. Faixa observada não é intervalo estatístico.',
      'Resultados de renda, custo, fluxo e residual são simulações das premissas; não substituem avaliação profissional.',
      'Cenários não têm probabilidades atribuídas. Atraso desloca fluxos; custos adicionais de atraso e financiamento devem ser lançados explicitamente.',
      'Somente a adoção explícita de um valor atual salvo atualiza a referência declarada do imóvel. CPPs, MAP, pagamentos e documentos assinados não são alterados.'],
  };
}
export type BuiltResult = ReturnType<typeof calculateBuiltCase>;

const calibrationRow = z.object({
  imovel: z.string().trim().min(1).max(80), regiao: text, categoria: text,
  grupo: z.enum(['treino', 'teste']), data: dateOnly, dataPrevisao: dateOnly,
  origem: z.literal('transacao_documentada'), fonte: text, area: z.number().finite().positive(),
  realizado: z.number().finite().positive().max(1e14), previsto: z.number().finite().positive().max(1e14),
  minimo: z.number().finite().nonnegative().optional(), maximo: z.number().finite().nonnegative().optional(),
}).refine(r => r.dataPrevisao <= r.data && ((r.minimo == null && r.maximo == null)
  || (r.minimo != null && r.maximo != null && r.minimo <= r.previsto && r.maximo >= r.previsto)), 'Previsão deve anteceder a transação; faixa deve conter a previsão');
export const calibrationSchema = z.object({ versaoModelo: text, moeda: z.string().regex(/^[A-Z]{3}$/), linhas: z.array(calibrationRow).min(2).max(1000) });
export function validateBuiltCalibration(raw: unknown, today = new Date().toISOString().slice(0, 10)) {
  const input = calibrationSchema.parse(raw), train = input.linhas.filter(r => r.grupo === 'treino'), test = input.linhas.filter(r => r.grupo === 'teste');
  if (!train.length || !test.length) throw new Error('Separe dados de desenvolvimento e teste.');
  if (input.linhas.some(r => r.data > today)) throw new Error('Transações futuras não são dados observados.');
  if (new Set(input.linhas.map(r => r.imovel)).size !== input.linhas.length) throw new Error('O mesmo imóvel não pode se repetir entre desenvolvimento e teste nem inflar a amostra.');
  const cutoff = train.map(r => r.data).sort().at(-1)!;
  if (test.some(r => r.data <= cutoff || r.dataPrevisao < cutoff)) throw new Error('O teste deve ser posterior ao desenvolvimento e as previsões devem respeitar esse corte.');
  const metrics = (rows: typeof test) => {
    const errors = rows.map(r => (r.previsto - r.realizado) / r.realizado * 100), bands = rows.filter(r => r.minimo != null);
    const baseline = rows.flatMap(r => {
      const refs = train.filter(t => t.regiao === r.regiao && t.categoria === r.categoria);
      return refs.length ? [Math.abs(median(refs.map(t => t.realizado / t.area)) * r.area - r.realizado) / r.realizado * 100] : [];
    });
    return { quantidade: rows.length, erroAbsolutoMedioPercentual: roundMoney(errors.reduce((s, e) => s + Math.abs(e), 0) / rows.length),
      viesPercentual: roundMoney(errors.reduce((s, e) => s + e, 0) / rows.length),
      rmse: roundMoney(Math.sqrt(rows.reduce((s, r) => s + (r.previsto - r.realizado) ** 2, 0) / rows.length)),
      superavaliados: errors.filter(e => e > 0).length, subavaliados: errors.filter(e => e < 0).length,
      errosAcima20Percentual: errors.filter(e => Math.abs(e) > 20).length,
      coberturaFaixasPercentual: bands.length ? roundMoney(bands.filter(r => r.realizado >= r.minimo! && r.realizado <= r.maximo!).length / bands.length * 100) : null,
      quantidadeComFaixa: bands.length, baselineErroPercentual: baseline.length ? roundMoney(baseline.reduce((s, e) => s + e, 0) / baseline.length) : null,
      quantidadeComBaseline: baseline.length };
  };
  const groups = new Map<string, typeof test>();
  for (const row of test) {
    const bucket = row.realizado < 500000 ? 'até 500 mil' : row.realizado < 2000000 ? '500 mil a 2 milhões' : '2 milhões ou mais';
    const key = `${row.regiao} / ${row.categoria} / ${bucket}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return { versao: BUILT_METHOD_VERSION, versaoModelo: input.versaoModelo, corte: cutoff,
    geral: metrics(test), grupos: [...groups].map(([grupo, rows]) => ({ grupo, ...metrics(rows) })),
    liberacaoAutomatica: false, conclusao: 'Diagnóstico da amostra fornecida. Representatividade, fontes, limites de cobertura e liberação do modelo exigem revisão responsável; este teste não certifica acurácia.' };
}
