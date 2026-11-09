import { cloneElement, isValidElement, useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BUILT_METHODS, BUILT_RESULT_LABELS, BUILT_CATEGORY_LABELS, BUILT_SCENARIO_LABELS, FLOW_CATEGORIES, INFORMATION_CLASSES, PROPERTY_SPECIFIC_FIELDS, builtCaseSchema, builtValidationMessage, type BuiltResult } from '@shared/built-valuation';
import { PROPERTY_THESIS_OPTIONS } from '@shared/property-thesis';
import { apiRequest } from '@/lib/queryClient';
import { formatPtBrMoneyInput } from '@/lib/pt-br-money';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const today = () => new Date().toISOString().slice(0, 10);
const fieldClass = 'min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';
const money = (n: number | null | undefined, currency = 'BRL') => n == null ? 'Não calculado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(n);
const evidence = (valor?: number) => ({ valor, classificacao: 'informada', fonte: '', data: today(), verificacao: 'nao_conferida', limitacao: '' });
const num = (value: string) => value === '' ? undefined : Number(value.replace(/\./g, '').replace(',', '.'));
function makeCalculation(method: string): any {
  if (method === 'renda') return { metodo: method, receitaAnual: evidence(), despesaAnual: evidence(), perdasAnuais: evidence(), taxaCapitalizacao: evidence() };
  if (method === 'custo') return { metodo: method, terreno: evidence(), reposicao: evidence(), depreciacaoFisica: evidence(), depreciacaoFuncional: evidence(), depreciacaoExterna: evidence() };
  if (method === 'comparativo') return { metodo: method, area: evidence(), unidadeArea: 'privativa_m2', comparaveis: [] };
  if (method === 'documental') return { metodo: method, valor: evidence(), natureza: 'avaliacao_anterior' };
  return { metodo: method, taxaDesconto: evidence(), ...(method === 'residual' ? { margemEmpreendedor: evidence() } : {}), fluxos: [] };
}
function newStudy(property: any): any {
  return { titulo: '', finalidade: '', dataBase: today(), moeda: property?.moeda || 'BRL', categoria: 'residencial',
    direito: 'Propriedade', participacaoPercentual: property?.participacaoPercentual ?? 100,
    tese: PROPERTY_THESIS_OPTIONS.some(([c]) => c === property?.objetivo && c !== 'gerir') ? property.objetivo : '',
    contexto: 'atual', condicoes: '', restricoes: '', condicaoAtual: '', vistoria: 'nao_realizada',
    caracteristicas: [], calculo: makeCalculation('renda'), limitacoes: '' };
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="min-w-0 space-y-1.5"><label id={id} htmlFor={`${id}-control`} className="block text-sm font-medium">{label}</label><div role="group" aria-labelledby={id}>{isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: `${id}-control` }) : children}</div></div>;
}
function NumberInput({ value, onChange, label, signed = false }: { value?: number; onChange: (n: number | undefined) => void; label: string; signed?: boolean }) {
  const [text, setText] = useState(value == null ? '' : formatPtBrMoneyInput(Math.abs(value)));
  useEffect(() => setText(value == null ? '' : `${value < 0 ? '-' : ''}${formatPtBrMoneyInput(Math.abs(value))}`), [value]);
  return <Input aria-label={label} inputMode="decimal" value={text} onChange={e => {
    if (signed && e.target.value === '-') { setText('-'); onChange(undefined); return; }
    const minus = signed && e.target.value.startsWith('-') ? '-' : '';
    const formatted = formatPtBrMoneyInput(e.target.value); setText(minus + formatted);
    const parsed = num(formatted); onChange(parsed == null ? undefined : minus ? -parsed : parsed);
  }} />;
}
function EvidenceFields({ value, onChange, label, textual = false }: { value: any; onChange: (v: any) => void; label: string; textual?: boolean }) {
  const v = value || evidence();
  const patch = (data: any) => onChange({ ...v, ...data });
  return <fieldset className="min-w-0 space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">{label}</legend>
    {textual ? <Input aria-label={label} value={v.conteudo || ''} onChange={e => patch({ conteudo: e.target.value })} /> : <NumberInput label={label} value={v.valor} onChange={valor => patch({ valor })} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Origem da informação"><select className={fieldClass} value={v.classificacao} onChange={e => patch({ classificacao: e.target.value })}>{INFORMATION_CLASSES.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></Field>
      <Field label="Data da informação"><Input type="date" value={v.data} onChange={e => patch({ data: e.target.value })} /></Field>
    </div>
    <Field label="Fonte ou documento de referência"><Input placeholder="Ex.: contrato de locação, orçamento, URL do anúncio…" value={v.fonte} onChange={e => patch({ fonte: e.target.value })} /></Field>
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Conferência e limitações</summary><div className="mt-3 space-y-3">
      <select aria-label="Conferência" className={fieldClass} value={v.verificacao} onChange={e => patch({ verificacao: e.target.value })}><option value="nao_conferida">Ainda não conferida</option><option value="conferida_pelo_usuario">Conferida por mim</option></select>
      <Input aria-label="Limitação da informação" placeholder="O que ainda precisa ser confirmado?" value={v.limitacao} onChange={e => patch({ limitacao: e.target.value })} />
    </div></details>
  </fieldset>;
}
function FlowEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  return <div className="space-y-3">{value.map((f, index) => <details key={f.id} className="rounded-lg border p-3" open={!f.descricao}>
    <summary className="cursor-pointer text-sm font-medium">{f.data || 'Sem data'} · {f.descricao || `Novo item ${index + 1}`} · {money(f.valor.valor)}</summary>
    <div className="mt-3 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Data"><Input type="date" value={f.data} onChange={e => onChange(value.map((r, n) => n === index ? { ...r, data: e.target.value } : r))} /></Field>
      <Field label="Categoria"><select className={fieldClass} value={f.categoria} onChange={e => onChange(value.map((r, n) => n === index ? { ...r, categoria: e.target.value } : r))}>{FLOW_CATEGORIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field></div>
      <Field label="Descrição"><Input value={f.descricao} onChange={e => onChange(value.map((r, n) => n === index ? { ...r, descricao: e.target.value } : r))} /></Field>
      <EvidenceFields label="Valor do item" value={f.valor} onChange={v => onChange(value.map((r, n) => n === index ? { ...r, valor: v } : r))} />
      <Button type="button" variant="outline" onClick={() => onChange(value.filter((_, n) => n !== index))}>Remover item</Button>
    </div></details>)}
    <Button type="button" variant="outline" onClick={() => onChange([...value, { id: crypto.randomUUID(), data: today(), descricao: '', categoria: 'operacao', valor: evidence() }])}>Adicionar recebimento ou gasto</Button>
  </div>;
}
function CalculationFields({ value: c, onChange }: { value: any; onChange: (v: any) => void }) {
  const fields: Record<string, [string, string][]> = {
    renda: [['receitaAnual', 'Receita anual sustentável'], ['despesaAnual', 'Despesas operacionais anuais'], ['perdasAnuais', 'Perdas anuais esperadas'], ['taxaCapitalizacao', 'Taxa anual de capitalização (%)']],
    custo: [['terreno', 'Valor do terreno'], ['reposicao', 'Custo da construção equivalente'], ['depreciacaoFisica', 'Perda física (%)'], ['depreciacaoFuncional', 'Perda por inadequação (%)'], ['depreciacaoExterna', 'Perda por condições externas (%)']],
    fluxo: [['taxaDesconto', 'Taxa anual de desconto (%)']], residual: [['taxaDesconto', 'Taxa anual de desconto (%)'], ['margemEmpreendedor', 'Margem do empreendedor sobre receitas (%)']],
    documental: [['valor', 'Valor constante da referência']], comparativo: [['area', 'Área usada na comparação']],
  };
  return <div className="space-y-4">
    <Field label="Método"><select className={fieldClass} value={c.metodo} onChange={e => onChange(makeCalculation(e.target.value))}>{BUILT_METHODS.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></Field>
    <div className="grid gap-4 lg:grid-cols-2">{fields[c.metodo].map(([key, title]) => <EvidenceFields key={key} label={title} value={c[key]} onChange={v => onChange({ ...c, [key]: v })} />)}</div>
    {c.metodo === 'documental' && <Field label="Natureza do valor"><select className={fieldClass} value={c.natureza} onChange={e => onChange({ ...c, natureza: e.target.value })}><option value="aquisicao">Aquisição</option><option value="fiscal">Valor fiscal</option><option value="avaliacao_anterior">Avaliação anterior</option><option value="expectativa">Expectativa do proprietário</option></select></Field>}
    {'fluxos' in c && <><p className="text-sm text-muted-foreground">Registre os fluxos na data em que ocorrem. Inclua valor terminal quando aplicável. O financiamento aparece separado do resultado do projeto.{c.metodo === 'residual' && ' No residual, não inclua o preço de aquisição do terreno, pois ele será o resultado procurado.'}</p><FlowEditor value={c.fluxos} onChange={fluxos => onChange({ ...c, fluxos })} /></>}
    {c.metodo === 'comparativo' && <>
      <Field label="Natureza e unidade da área"><select className={fieldClass} value={c.unidadeArea} onChange={e => onChange({ ...c, unidadeArea: e.target.value })}>{[['privativa_m2','Privativa (m²)'],['construida_m2','Construída (m²)'],['terreno_m2','Terreno (m²)'],['terreno_ha','Terreno (hectares)']].map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></Field>
      <p className="text-sm text-muted-foreground">Inclua no mínimo três negócios ou anúncios. Use a mesma definição de área e justifique a semelhança de localização, idade, padrão e conservação. A busca automática residencial continua disponível acima.</p>
      {c.comparaveis.map((row: any, index: number) => <fieldset key={index} className="space-y-3 rounded-lg border p-3"><legend>Referência {index + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2">{[['identificador','URL ou identificação única'],['regiao','Localização'],['justificativa','Por que este imóvel é comparável?']].map(([key, label]) => <Field key={key} label={label}><Input value={row[key]} onChange={e => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, [key]: e.target.value } : r) })} /></Field>)}
        <Field label="Categoria"><select className={fieldClass} value={row.categoria} onChange={e => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, categoria: e.target.value } : r) })}>{Object.keys(PROPERTY_SPECIFIC_FIELDS).map(key => <option key={key}>{key}</option>)}</select></Field>
        <Field label="Natureza"><select className={fieldClass} value={row.natureza} onChange={e => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, natureza: e.target.value } : r) })}><option value="anuncio">Preço de anúncio</option><option value="transacao">Transação documentada</option></select></Field>
        <Field label="Data do negócio ou anúncio"><Input type="date" value={row.data} onChange={e => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, data: e.target.value } : r) })} /></Field>
        <Field label={`Área (${c.unidadeArea})`}><NumberInput label={`Área da referência ${index + 1}`} value={row.area} onChange={area => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, area, unidadeArea: c.unidadeArea } : r) })} /></Field></div>
        <EvidenceFields label="Preço da referência" value={row.preco} onChange={preco => onChange({ ...c, comparaveis: c.comparaveis.map((r: any, n: number) => n === index ? { ...r, preco } : r) })} />
        <Button type="button" variant="outline" onClick={() => onChange({ ...c, comparaveis: c.comparaveis.filter((_: any, n: number) => n !== index) })}>Remover referência</Button>
      </fieldset>)}
      <Button type="button" variant="outline" onClick={() => onChange({ ...c, comparaveis: [...c.comparaveis, { identificador: '', natureza: 'anuncio', categoria: 'residencial', regiao: '', data: today(), unidadeArea: c.unidadeArea, area: undefined, preco: evidence(), justificativa: '' }] })}>Adicionar referência</Button>
    </>}
  </div>;
}
export function BuiltStudyResult({ result, currency = 'BRL' }: { result: BuiltResult; currency?: string }) {
  return <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">Resultado da análise</h4><span className="text-sm text-muted-foreground">{BUILT_RESULT_LABELS[result.classificacao]}</span></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Valor atual', result.valorAtual], ['Valor condicionado', result.valorCondicionado], ['Sua parcela proporcional', result.parcelaProporcional], ['Venda isolada da participação', result.valorVendaIsoladaParticipacao]].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{money(value as number | null, currency)}</p></div>)}</div>
    <p className="break-words text-sm text-muted-foreground">{result.formula}</p>
    {result.pendencias.map(p => <p role="status" key={p} className="text-sm text-amber-700 dark:text-amber-300">{p}</p>)}
    {result.estrategia && <div className="rounded-lg border p-3"><h5 className="font-medium">Resultado projetado da estratégia</h5><p>Receitas {money(result.estrategia.receitas, currency)} · Gastos {money(result.estrategia.gastos, currency)}</p><p className="font-semibold">Resultado {money(result.estrategia.resultadoProjeto, currency)}</p><p className="text-sm text-muted-foreground">Valor presente {money(result.estrategia.valorPresenteProjeto, currency)} · Prazo {result.estrategia.prazoDias} dias · Fluxo do proprietário {money(result.estrategia.fluxoProprietario, currency)}</p></div>}
    {result.precoNecessario && <div className="rounded-lg border p-3 text-sm"><h5 className="font-medium">Preço necessário para a estratégia funcionar</h5><p>Equilíbrio a valor presente: {money(result.precoNecessario.equilibrio, currency)} · Retorno alvo {result.precoNecessario.retornoAlvoPercentual}%: {money(result.precoNecessario.retornoAlvo, currency)}</p><p className="text-muted-foreground">Saída em {result.precoNecessario.dataSaida}. Considera os gastos lançados e o retorno total sobre seus valores presentes. Estes preços são metas calculadas; sua aceitação pelo mercado precisa ser examinada.</p></div>}
    {!!result.cenarios.length && <div className="grid gap-3 lg:grid-cols-3">{result.cenarios.map(s => <div key={s.nome} className="min-w-0 rounded-lg border p-3"><h5 className="font-medium">{BUILT_SCENARIO_LABELS[s.nome]}</h5><p className="break-words text-sm text-muted-foreground">{s.premissas}</p><p className="mt-2 font-semibold">{s.indicadores ? money(s.indicadores.resultadoProjeto, currency) : 'Condição não atendida'}</p></div>)}</div>}
    <details className="text-sm"><summary className="cursor-pointer">Limitações e revisão necessária</summary>{result.limitacoes.map(l => <p className="mt-2 text-muted-foreground" key={l}>{l}</p>)}</details>
  </div>;
}

export function BuiltValuationWorkbench({ id, canManage }: { id: string; canManage: boolean }) {
  const path = `/api/carteira/imoveis/${id}/metodo-built`, client = useQueryClient();
  const queryKey = ['/api/carteira/imoveis', id, 'metodo-built'];
  const query = useQuery<any>({ queryKey, queryFn: async () => (await apiRequest('GET', path)).json(), refetchOnWindowFocus: true });
  const [draft, setDraft] = useState<any>(null), [selection, setSelection] = useState<any>(null), [caseId, setCaseId] = useState('');
  const [reason, setReason] = useState('cadastro'), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [review, setReview] = useState<any>({ credencial: '', escopo: '', parecer: '', documentoId: '', conclusao: 'concorda', confirmoResponsabilidade: false });
  const [reviewing, setReviewing] = useState(false), [validating, setValidating] = useState(false), [validation, setValidation] = useState<any>(null), [exporting, setExporting] = useState(false);
  const [adopting, setAdopting] = useState(false), [confirmAdoption, setConfirmAdoption] = useState(false), [notice, setNotice] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { setDraft(null); setSelection(null); setCaseId(''); setError(''); setValidation(null); setConfirmAdoption(false); setNotice(''); }, [id]);
  const records: any[] = query.data?.analises || [], latest = records.filter((r, n) => records.findIndex(p => p.casoId === r.casoId) === n);
  const patch = (p: any) => setDraft({ ...draft, ...p });
  const start = () => { setDraft(newStudy(query.data?.imovel)); setSelection(null); setCaseId(crypto.randomUUID()); setError(''); setReason('cadastro'); setConfirmAdoption(false); setNotice(''); };
  const open = (row: any) => { setDraft(structuredClone(row.entrada)); setSelection(row); setCaseId(row.casoId); setReason('correcao'); setError(''); setConfirmAdoption(false); setNotice(''); };
  const save = async () => {
    const parsed = builtCaseSchema.safeParse(draft);
    if (!parsed.success) { setError(builtValidationMessage(parsed.error.issues)); return; }
    setSaving(true); setError('');
    try { const saved = await (await apiRequest('POST', path, { casoId: caseId, anteriorId: selection?.id || null, motivo: reason, entrada: parsed.data })).json(); setSelection(saved); setDraft(saved.entrada); setConfirmAdoption(false); setNotice('Análise salva. O valor da carteira só muda se você confirmar sua adoção.'); await client.invalidateQueries({ queryKey }); }
    catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  const exportReport = async () => {
    if (!selection) return; setExporting(true); setError('');
    try { const response = await apiRequest('GET', `${path}/${selection.id}/relatorio`); const blob = await response.blob();
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'avaliacao-metodo-built.html'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) { setError(e.message); } finally { setExporting(false); }
  };
  const recordReview = async () => {
    if (!selection) return; setReviewing(true); setError('');
    try { await apiRequest('POST', `${path}/${selection.id}/revisao`, review); await client.invalidateQueries({ queryKey }); setReview({ ...review, parecer: '', confirmoResponsabilidade: false }); }
    catch (e: any) { setError(e.message); } finally { setReviewing(false); }
  };
  const adopt = async () => {
    if (!selection || !confirmAdoption) return; setAdopting(true); setError(''); setNotice('');
    try { await apiRequest('POST', `${path}/${selection.id}/adotar`, { confirmo: true, valorAnterior: query.data.imovel.valorAtual });
      await Promise.all([client.invalidateQueries({ queryKey }), client.invalidateQueries({ queryKey: ['/api/carteira'] }), client.invalidateQueries({ queryKey: ['/api/carteira/resumo'] }), client.invalidateQueries({ queryKey: ['/api/carteira/imoveis'] }), client.invalidateQueries({ queryKey: ['/api/carteira/evolucao'] })]);
      setConfirmAdoption(false); setNotice('Referência atual do imóvel atualizada com a origem e a data desta análise.');
    } catch (e: any) { setError(e.message); } finally { setAdopting(false); }
  };
  const importValidation = async (file?: File) => {
    if (!file || validating) return; setError('');
    if (file.size > 750000) { setError('Use um arquivo JSON de até 750 KB.'); return; }
    setValidating(true);
    try { const body = JSON.parse(await file.text()); setValidation(await (await apiRequest('POST', `${path}/validacao`, body)).json()); await client.invalidateQueries({ queryKey }); }
    catch (e: any) { setError(e.message); } finally { setValidating(false); }
  };
  const loadMore = async () => {
    if (!query.data?.maisAntigasCursor) return; setLoadingMore(true); setError('');
    try { const next = await (await apiRequest('GET', `${path}?antes=${encodeURIComponent(query.data.maisAntigasCursor)}`)).json();
      client.setQueryData(queryKey, (current: any) => ({ ...current, maisAntigasCursor: next.maisAntigasCursor,
        analises: [...current.analises, ...next.analises.filter((r: any) => !current.analises.some((p: any) => p.id === r.id))] }));
    } catch (e: any) { setError(e.message); } finally { setLoadingMore(false); }
  };
  if (query.isLoading) return <p role="status">Carregando estudos do imóvel…</p>;
  if (query.isError) return <div role="alert" className="rounded-lg border p-4">Não foi possível consultar os estudos. <Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  return <section className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-5" data-testid="built-method-workbench">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Método BUILT · Estudos e cenários</h3><p className="text-sm text-muted-foreground">Compare alternativas para este imóvel, com fontes, custos e prazos.</p></div>{canManage && <Button onClick={start}>Nova análise</Button>}</div>
    <div className="rounded-lg border p-3"><h4 className="text-sm font-medium">Desempenho registrado</h4><p className="text-sm">{query.data.desempenho.status === 'sem_registros_pagos' ? 'Sem lançamentos pagos registrados.' : `Receitas ${money(query.data.desempenho.receitas, query.data.imovel.moeda)} · Despesas ${money(query.data.desempenho.despesas, query.data.imovel.moeda)} · Resultado ${money(query.data.desempenho.resultado, query.data.imovel.moeda)}`}</p><p className="text-xs text-muted-foreground">{query.data.desempenho.periodo}. Projeções ficam separadas destes valores.</p></div>
    {!!latest.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Alternativa</th><th className="p-2">Método</th><th className="p-2">Valor atual</th><th className="p-2">Condicionado</th><th className="p-2">Resultado da estratégia</th></tr></thead><tbody>{latest.map(row => <tr key={row.id} className="border-b"><td className="p-2"><button className="text-primary underline" onClick={() => open(row)}>{row.entrada.titulo}</button></td><td className="p-2">{BUILT_METHODS.find(([code]) => code === row.entrada.calculo.metodo)?.[1]}</td><td className="p-2">{money(row.resultado.valorAtual, row.entrada.moeda)}</td><td className="p-2">{money(row.resultado.valorCondicionado, row.entrada.moeda)}</td><td className="p-2">{money(row.resultado.estrategia?.resultadoProjeto, row.entrada.moeda)}</td></tr>)}</tbody></table></div>}
    {!latest.length && <p className="text-sm text-muted-foreground">Nenhum estudo salvo. A avaliação automática residencial acima continua independente.</p>}
    {query.data.maisAntigasCursor && <Button variant="outline" loading={loadingMore} loadingText="Carregando histórico…" onClick={loadMore}>Carregar análises anteriores</Button>}
    {error && <p role="alert" className="break-words rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {draft && <div className="space-y-5">
      <fieldset disabled={!canManage || saving} className="min-w-0 space-y-5 disabled:opacity-80">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome da alternativa"><Input value={draft.titulo} onChange={e => patch({ titulo: e.target.value })} placeholder="Ex.: manter alugado ou reformar e vender" /></Field>
          <Field label="Finalidade da análise"><Input value={draft.finalidade} onChange={e => patch({ finalidade: e.target.value })} /></Field>
          <Field label="Data-base"><Input type="date" value={draft.dataBase} onChange={e => patch({ dataBase: e.target.value })} /></Field>
          <Field label="Categoria do imóvel"><select className={fieldClass} value={draft.categoria} onChange={e => patch({ categoria: e.target.value })}>{Object.keys(PROPERTY_SPECIFIC_FIELDS).map(k => <option key={k} value={k}>{BUILT_CATEGORY_LABELS[k]}</option>)}</select></Field>
          <Field label="Direito avaliado"><Input value={draft.direito} onChange={e => patch({ direito: e.target.value })} /></Field>
          <Field label="Participação para controle patrimonial (%)"><NumberInput label="Participação" value={draft.participacaoPercentual} onChange={participacaoPercentual => patch({ participacaoPercentual })} /></Field>
          <Field label="Tese"><select className={fieldClass} value={draft.tese} onChange={e => patch({ tese: e.target.value })}><option value="">Escolha a estratégia</option>{PROPERTY_THESIS_OPTIONS.filter(([key]) => key !== 'gerir').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Condições avaliadas"><select className={fieldClass} value={draft.contexto} onChange={e => patch({ contexto: e.target.value })}><option value="atual">Condições atuais</option><option value="condicionado">Após uma intervenção ou condição</option></select></Field>
        </div>
        {draft.contexto === 'condicionado' && <div className="grid gap-3 sm:grid-cols-2"><Field label="Condições necessárias"><Textarea value={draft.condicoes} onChange={e => patch({ condicoes: e.target.value })} /></Field><Field label="Data prevista das condições"><Input type="date" value={draft.dataCondicionada || ''} onChange={e => patch({ dataCondicionada: e.target.value })} /></Field></div>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Condição atual do imóvel"><Textarea value={draft.condicaoAtual} onChange={e => patch({ condicaoAtual: e.target.value })} /></Field><Field label="Restrições conhecidas"><Textarea placeholder="Descreva ou informe nenhuma conhecida" value={draft.restricoes} onChange={e => patch({ restricoes: e.target.value })} /></Field></div>
        <details className="space-y-3 rounded-lg border p-3"><summary className="cursor-pointer font-medium">Características, vistoria e identificação</summary><p className="mt-3 text-sm text-muted-foreground">Para esta categoria: {PROPERTY_SPECIFIC_FIELDS[draft.categoria].join('; ')}.</p>
          <Field label="Vistoria"><select className={fieldClass} value={draft.vistoria} onChange={e => patch({ vistoria: e.target.value })}><option value="nao_realizada">Não realizada / não comprovada</option><option value="informada_com_documento">Realizada, com documento de referência informado abaixo</option></select></Field>
          {draft.vistoria === 'informada_com_documento' && <Field label="Documento da vistoria"><select className={fieldClass} value={draft.vistoriaDocumentoId || ''} onChange={e => patch({ vistoriaDocumentoId: e.target.value || undefined })}><option value="">Selecione o documento</option>{query.data.documentos.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></Field>}
          <Field label="Inscrição imobiliária municipal"><Input value={draft.inscricaoMunicipal || ''} onChange={e => patch({ inscricaoMunicipal: e.target.value })} /></Field>
          {draft.caracteristicas.map((c: any, n: number) => <div key={n} className="space-y-2"><Input aria-label="Nome da característica" placeholder="Característica ou documento" value={c.nome} onChange={e => patch({ caracteristicas: draft.caracteristicas.map((r: any, j: number) => j === n ? { ...r, nome: e.target.value } : r) })} /><EvidenceFields textual label={c.nome || 'Informação'} value={c} onChange={v => patch({ caracteristicas: draft.caracteristicas.map((r: any, j: number) => j === n ? v : r) })} /><Button type="button" variant="outline" onClick={() => patch({ caracteristicas: draft.caracteristicas.filter((_: any, j: number) => j !== n) })}>Remover característica</Button></div>)}
          <Button type="button" variant="outline" onClick={() => patch({ caracteristicas: [...draft.caracteristicas, { ...evidence(), nome: '', conteudo: '' }] })}>Adicionar característica ou documento</Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.cib} onChange={e => patch({ cib: e.target.checked ? { codigo: query.data.imovel.cib || '', fonte: '', data: today(), verificacao: 'nao_validado_oficialmente' } : undefined })} />Registrar fonte e data do CIB nesta análise</label>
          {draft.cib && <div className="grid gap-3 sm:grid-cols-3">{[['codigo','Código CIB'],['fonte','Fonte do CIB'],['data','Data da conferência']].map(([key, label]) => <Field key={key} label={label}><Input type={key === 'data' ? 'date' : 'text'} value={draft.cib[key]} onChange={e => patch({ cib: { ...draft.cib, [key]: e.target.value } })} /></Field>)}</div>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.valorVendaParticipacao} onChange={e => patch({ valorVendaParticipacao: e.target.checked ? evidence() : undefined })} />Informar valor de venda isolada da participação</label>
          {draft.valorVendaParticipacao && <EvidenceFields label="Venda isolada da participação (não é a divisão proporcional)" value={draft.valorVendaParticipacao} onChange={valorVendaParticipacao => patch({ valorVendaParticipacao })} />}
        </details>
        <CalculationFields value={draft.calculo} onChange={calculo => patch({ calculo })} />
        <div className="space-y-4 rounded-lg border p-4"><label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={!!draft.estrategia} onChange={e => patch({ estrategia: e.target.checked ? { taxaDesconto: evidence(), fluxos: [], dataSaida: today(), retornoAlvoPercentual: undefined, cenarios: ['conservador','central','favoravel'].map(nome => ({ nome, premissas: '', variacaoVenda: undefined, variacaoCustos: undefined, atrasoMeses: undefined, ocupacaoPercentual: undefined, inadimplenciaPercentual: undefined, aprovada: true })) } : undefined })} />Calcular a estratégia e seus riscos</label>
          {draft.estrategia && <><p className="text-sm text-muted-foreground">Inclua uma única vez aquisição, obras, tributos, manutenção, receitas e financiamento. Para imóvel já possuído, informe explicitamente o valor de entrada que deseja considerar. Os recebimentos de locação devem representar capacidade a 100% antes de aplicar ocupação nos cenários.</p>
            <EvidenceFields label="Taxa anual de desconto da estratégia (%)" value={draft.estrategia.taxaDesconto} onChange={taxaDesconto => patch({ estrategia: { ...draft.estrategia, taxaDesconto } })} />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Data de saída / fim da estratégia"><Input type="date" value={draft.estrategia.dataSaida} onChange={e => patch({ estrategia: { ...draft.estrategia, dataSaida: e.target.value } })} /></Field><Field label="Retorno total alvo sobre gastos a valor presente (%)"><NumberInput label="Retorno alvo" value={draft.estrategia.retornoAlvoPercentual} onChange={retornoAlvoPercentual => patch({ estrategia: { ...draft.estrategia, retornoAlvoPercentual } })} /></Field></div>
            <FlowEditor value={draft.estrategia.fluxos} onChange={fluxos => patch({ estrategia: { ...draft.estrategia, fluxos } })} />
            {draft.estrategia.cenarios.map((s: any, n: number) => <details key={s.nome} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">Cenário {BUILT_SCENARIO_LABELS[s.nome]}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[['variacaoVenda','Variação do preço de venda (%)'],['variacaoCustos','Variação de gastos (%)'],['atrasoMeses','Atraso (meses)'],['ocupacaoPercentual','Ocupação (%)'],['inadimplenciaPercentual','Inadimplência (%)']].map(([key, label]) => <Field key={key} label={label}><NumberInput signed label={`${s.nome}: ${label}`} value={s[key]} onChange={v => patch({ estrategia: { ...draft.estrategia, cenarios: draft.estrategia.cenarios.map((r: any, j: number) => n === j ? { ...r, [key]: v } : r) } })} /></Field>)}
              <Field label="Premissas do cenário"><Textarea value={s.premissas} onChange={e => patch({ estrategia: { ...draft.estrategia, cenarios: draft.estrategia.cenarios.map((r: any, j: number) => n === j ? { ...r, premissas: e.target.value } : r) } })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.aprovada} onChange={e => patch({ estrategia: { ...draft.estrategia, cenarios: draft.estrategia.cenarios.map((r: any, j: number) => n === j ? { ...r, aprovada: e.target.checked } : r) } })} />Aprovação / regularização atendida neste cenário</label>
            </div></details>)}
          </>}
        </div>
        <Field label="Limitações e riscos desta análise"><Textarea value={draft.limitacoes} onChange={e => patch({ limitacoes: e.target.value })} /></Field>
        <Field label="Motivo desta revisão"><select className={fieldClass} value={reason} onChange={e => setReason(e.target.value)}>{[['cadastro','Dados do imóvel'],['referencias','Novas referências'],['metodo','Mudança do método'],['obra','Obra ou intervenção'],['correcao','Correção de informação']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      </fieldset>
      <div className="flex flex-wrap gap-3">{canManage && <Button loading={saving} onClick={save}>Calcular e salvar análise</Button>}{selection && <Button variant="outline" loading={exporting} loadingText="Preparando relatório…" onClick={exportReport}>Baixar relatório para impressão / PDF</Button>}<Button variant="ghost" onClick={() => setDraft(null)}>Fechar análise</Button></div>
      {selection && <BuiltStudyResult result={selection.resultado} currency={selection.entrada.moeda} />}
      {selection && canManage && selection.resultado.valorAtual != null && selection.resultado.valorAtual >= 0 && <div className="space-y-3 rounded-lg border p-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmAdoption} onChange={e => setConfirmAdoption(e.target.checked)} />Quero usar o valor atual salvo de {money(selection.resultado.valorAtual, selection.entrada.moeda)} como referência declarada deste imóvel. Entendo a origem ({BUILT_RESULT_LABELS[selection.resultado.classificacao]}) e suas limitações.</label><Button variant="outline" loading={adopting} disabled={!confirmAdoption} onClick={adopt}>Salvar como referência atual da carteira</Button></div>}
      {selection && <details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">Histórico desta alternativa</summary>{records.filter(r => r.casoId === selection.casoId).map(r => <Button key={r.id} variant="ghost" className="mt-2 w-full justify-start whitespace-normal text-left" onClick={() => open(r)}>{new Date(r.criadoEm).toLocaleString('pt-BR')} · {r.motivo} · {money(r.resultado.valorCalculado, r.entrada.moeda)}</Button>)}</details>}
      {selection && <details className="space-y-3 rounded-lg border p-3"><summary className="cursor-pointer font-medium">Revisões e parecer profissional</summary>
        {(query.data.revisoes || []).filter((r: any) => r.analiseId === selection.id).map((r: any) => <div className="mt-3 rounded-lg border p-3" key={r.id}><p className="font-medium">{r.credencial} · {r.conclusao}</p><p className="text-sm">{r.escopo}</p><p className="text-sm">{r.parecer}</p><p className="text-xs text-muted-foreground">Revisão documentada; credencial não validada automaticamente.</p></div>)}
        {canManage && <div className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">Vincule um parecer já anexado em Documentos. Registrar uma revisão não certifica credenciais nem altera o resultado da análise.</p>
          {[['credencial','Responsável e registro profissional'],['escopo','Alcance da revisão'],['parecer','Parecer']].map(([key, label]) => <Field key={key} label={label}><Textarea value={review[key]} onChange={e => setReview({ ...review, [key]: e.target.value })} /></Field>)}
          <Field label="Documento do parecer"><select className={fieldClass} value={review.documentoId} onChange={e => setReview({ ...review, documentoId: e.target.value })}><option value="">Escolha um documento do imóvel</option>{query.data.documentos.map((d: any) => <option value={d.id} key={d.id}>{d.nome}</option>)}</select></Field>
          <Field label="Conclusão"><select className={fieldClass} value={review.conclusao} onChange={e => setReview({ ...review, conclusao: e.target.value })}><option value="concorda">Concorda</option><option value="ressalvas">Concorda com ressalvas</option><option value="rejeita">Rejeita</option></select></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={review.confirmoResponsabilidade} onChange={e => setReview({ ...review, confirmoResponsabilidade: e.target.checked })} />Confirmo a correspondência entre o parecer, seu responsável e esta revisão da análise.</label>
          <Button loading={reviewing} disabled={!review.confirmoResponsabilidade} onClick={recordReview}>Salvar revisão documentada</Button>
        </div>}
      </details>}
    </div>}
    {canManage && <details className="space-y-3 rounded-lg border p-3"><summary className="cursor-pointer font-medium">Validar precisão com transações documentadas</summary><p className="mt-3 text-sm text-muted-foreground">Importe dados separados em desenvolvimento e teste, sem repetir imóveis e com teste posterior ao desenvolvimento. Use identificadores sem nomes ou dados pessoais. O resultado mede erros e faixas, sem liberar automaticamente um modelo.</p>
      <div className="rounded-lg border border-dashed p-4" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importValidation(e.dataTransfer.files[0]); }}><label className="block space-y-2 text-sm"><span>Arraste um arquivo JSON ou selecione · até 750 KB</span><Input type="file" accept=".json,application/json" disabled={validating} onChange={e => { void importValidation(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
      <details className="text-sm"><summary className="cursor-pointer">Formato do arquivo</summary><pre className="mt-2 max-w-full overflow-auto rounded-lg bg-muted p-3">{JSON.stringify({ versaoModelo: 'versão identificada', moeda: 'BRL', linhas: [{ imovel: 'identificador-sem-dados-pessoais', regiao: 'cidade / região', categoria: 'residencial', grupo: 'treino ou teste', data: 'AAAA-MM-DD', dataPrevisao: 'AAAA-MM-DD', origem: 'transacao_documentada', fonte: 'referência do negócio documentado', area: 'número', realizado: 'número', previsto: 'número', minimo: 'opcional: número', maximo: 'opcional: número' }] }, null, 2)}</pre></details>
      {validating && <p role="status">Validando amostra…</p>}
      {validation && <div className="space-y-3 rounded-lg border p-3 text-sm"><p>{validation.geral.quantidade} negócios de teste · Erro absoluto médio {validation.geral.erroAbsolutoMedioPercentual}% · Viés {validation.geral.viesPercentual}% · Cobertura das faixas {validation.geral.coberturaFaixasPercentual ?? 'sem faixas'}{validation.geral.coberturaFaixasPercentual != null ? '%' : ''}</p>
        <p>Erro quadrático médio em valor (RMSE): {money(validation.geral.rmse, query.data.imovel.moeda)}. Superavaliações: {validation.geral.superavaliados}; subavaliações: {validation.geral.subavaliados}; diferenças acima de 20%: {validation.geral.errosAcima20Percentual}.</p>
        <p>Referência simples de comparação (mediana por área da amostra anterior): erro {validation.geral.baselineErroPercentual ?? 'indisponível'}{validation.geral.baselineErroPercentual != null ? '%' : ''}, para {validation.geral.quantidadeComBaseline} negócios. Faixas avaliadas: {validation.geral.quantidadeComFaixa}.</p>
        <p className="text-muted-foreground">{validation.conclusao}</p><div className="space-y-1">{validation.grupos.map((g: any) => <p key={g.grupo}>{g.grupo}: {g.quantidade} negócios · erro {g.erroAbsolutoMedioPercentual}% · viés {g.viesPercentual}% · cobertura {g.coberturaFaixasPercentual ?? 'sem faixas'}</p>)}</div></div>}
      {!!query.data.validacoes?.length && <div className="space-y-2 text-sm">{query.data.validacoes.map((v: any) => <button key={v.id} className="block text-primary underline" onClick={() => setValidation(v.resultado)}>{new Date(v.criado_em).toLocaleDateString('pt-BR')} · {v.resultado.versaoModelo} · {v.resultado.geral.quantidade} negócios de teste</button>)}</div>}
    </details>}
  </section>;
}
