import type { GuestFormalization } from '@shared/bia-mou-qualification';
import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Download, FileText, Layers3, MessageCircle, ReceiptText, UserRound, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { guestDashboard } from '@shared/oba-guest-dashboard';
import type { guestPayments } from '@shared/oba-guest';
import type { BiaOffer } from '@shared/bia-offer';
import { Button } from '@/components/ui/button';

export type GuestPortalData = {
  nome: string; email: string; aprovado: boolean; liberado: boolean; formalizacao?: GuestFormalization;
  candidaturas: { id: string; status: string }[];
  oferta?: BiaOffer | null; revisao: number; aquisicaoCotas: boolean;
  bia?: { nome: string; fase: string; etapa?: string | null };
  cotas?: number; totalCotas?: number;
  pagamentos?: ReturnType<typeof guestPayments>;
  novidades?: { id: string; data: string; etapa: string }[];
  documentos?: { id: string; titulo: string }[];
  responsavel?: { nome: string; telefone?: string | null } | null;
};
export const guestDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
  ? value.slice(0, 10).split('-').reverse().join('/') : 'Data a definir';
const monthLabel = (value: string) => new Date(value + '-01T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
const statusLabels: Record<string, string> = { pago: 'Pago', agendado: 'Agendado', pendente: 'Em análise', aprovado: 'Aprovada', aprovada: 'Aprovada', recusada: 'Não aprovada', vaga_preenchida: 'Indisponível', vencido: 'Vencido' };
export function GuestStatus({ status, label }: { status: string; label?: string }) {
  return <span className={'og-status og-status-' + status}>{status === 'pago' || status === 'aprovada' ? <CheckCircle2 size={12}/> : <Clock3 size={12}/>} {label || statusLabels[status] || status}</span>;
}

export function GuestApplications({ applications }: { applications: GuestPortalData['candidaturas'] }) {
  return <div>{applications.map((item, index) => <div key={item.id} className="og-request"><span>Cota solicitada {index + 1}</span><GuestStatus status={item.status}/></div>)}</div>;
}

export function GuestDashboard({ data, accessId, tab, onTab }: { data: GuestPortalData; accessId: string; tab: string; onTab: (tab: string) => void }) {
  const [filter, setFilter] = useState('todos');
  const payments = data.pagamentos || [];
  const stats = guestDashboard(payments, data.cotas ?? 0, data.totalCotas ?? 0);
  const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: data.oferta?.moeda || 'BRL' }).format(value);
  const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 5 });
  const percent = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  const fileHref = (id: string) => `/api/oba-guest/${encodeURIComponent(accessId)}/files/${encodeURIComponent(id)}`;
  const phone = String(data.responsavel?.telefone || '').replace(/\D/g, '');
  const next = stats.next;
  const filtered = payments.filter(item => filter === 'todos' || (filter === 'pagos' ? item.status === 'pago' : item.status !== 'pago'));
  const contact = data.responsavel && <section className="og-panel og-contact"><span className="og-icon"><UserRound size={22}/></span><div><p>Responsável pela sua BIA</p><strong>{data.responsavel.nome}</strong>
    {phone && <a href={'https://wa.me/' + phone} target="_blank" rel="noopener noreferrer">Conversar <ArrowUpRight size={14}/></a>}</div></section>;
  const nextPayment = <section className="og-panel"><div className="og-panel-header"><div><h2>Próximo aporte</h2><p>Seu próximo compromisso na BIA</p></div><CalendarDays/></div>
    {next ? <><GuestStatus status={next.status} label={next.status === 'pendente' ? 'A pagar' : undefined}/><p className="og-amount">{money(next.valor)}</p><p className="og-muted">{next.descricao}</p><div className="og-next"><p>Vencimento</p><strong>{guestDate(next.vencimento)}</strong>
      {next.pagamentoUrl && <Button asChild className="mt-4 w-full"><a href={next.pagamentoUrl} target="_blank" rel="noopener noreferrer">Ver cobrança <ArrowUpRight size={16}/></a></Button>}</div></> : <div className="og-empty"><CheckCircle2/><strong>Nenhum aporte a pagar</strong><p>Novos pagamentos aparecerão aqui quando forem registrados pela gestão.</p></div>}
  </section>;
  const summary = <div className="og-stats">
    <section className="og-stat og-stat-featured"><div><span>Suas cotas iniciais</span><Layers3 size={18}/></div><strong>{number(data.cotas ?? 0)} <span style={{ fontSize: '16px', fontWeight: 400 }}>de {number(data.totalCotas ?? 0)}</span></strong><small>Distribuição das cotas da aliança</small></section>
    <section className="og-stat"><div><span>Já aportado</span><ArrowDownLeft size={18}/></div><strong>{money(stats.pago)}</strong><small>Pagamentos registrados como pagos</small></section>
    <section className="og-stat"><div><span>Aportes a pagar</span><Wallet size={18}/></div><strong>{money(stats.aPagar)}</strong><small>Pagamentos pendentes registrados</small></section>
  </div>;

  if (tab === 'novidades') return <div className="og-dashboard-grid"><div className="og-stack"><section className="og-panel"><div className="og-panel-header"><div><h2>O que acontece na sua BIA</h2><p>Atualizações compartilhadas pela gestão</p></div><MessageCircle/></div>
    {(data.novidades || []).length ? <ol className="og-timeline">{data.novidades!.map(item => <li key={item.id}><time>{guestDate(item.data)}</time><p>{item.etapa}</p></li>)}</ol> : <div className="og-empty"><Clock3/><strong>Acompanhe os próximos passos</strong><p>As atualizações da BIA aparecerão aqui quando a gestão publicar uma nova etapa.</p></div>}
  </section><section className="og-panel"><div className="og-panel-header"><div><h2>Documentos da aliança</h2><p>Arquivos compartilhados na oferta</p></div><FileText/></div>
    {(data.documentos || []).length ? data.documentos!.map(doc => <a href={fileHref(doc.id)} key={doc.id} className="og-doc"><FileText/><span>{doc.titulo}</span><Download/></a>) : <p className="og-muted">Ainda não há documentos compartilhados.</p>}
  </section></div><div className="og-stack">{contact}<section className="og-panel"><div className="og-panel-header"><h2>Meus dados</h2><UserRound/></div><strong>{data.nome}</strong><p className="og-muted" style={{ overflowWrap: 'anywhere', marginTop: 6 }}>{data.email}</p></section>
    {!!data.candidaturas.length && <section className="og-panel"><h2>Minhas solicitações</h2><GuestApplications applications={data.candidaturas}/></section>}
  </div></div>;

  if (tab === 'dinheiro') return <>{summary}<div className="og-dashboard-grid"><section className="og-panel"><div className="og-panel-header"><div><h2>Aportes e comprovantes</h2><p>Seu histórico financeiro nesta BIA</p></div><ReceiptText/></div>
    <div className="og-tabs" role="group" aria-label="Filtrar aportes">{[{ id: 'todos', label: 'Todos' }, { id: 'pagos', label: 'Pagos' }, { id: 'pendentes', label: 'A pagar' }].map(item => <button key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {filtered.length ? filtered.map(item => <article key={item.id} className="og-payment"><span className="og-icon"><ReceiptText size={17}/></span><div><strong>{item.descricao}</strong><p>{item.status === 'pago' ? 'Pago em' : 'Vencimento'} · {guestDate(item.status === 'pago' ? item.pagoEm : item.vencimento)}</p>
      <div className="og-receipts">{item.arquivos.map((id: string, index: number) => <a key={id} href={fileHref(id)}><Download size={12}/>Comprovante {index + 1}</a>)}{item.status !== 'pago' && item.pagamentoUrl && <a href={item.pagamentoUrl} target="_blank" rel="noopener noreferrer">Ver cobrança <ArrowUpRight size={12}/></a>}</div></div><div><strong>{money(item.valor)}</strong><GuestStatus status={item.status} label={item.status === 'pendente' ? 'A pagar' : undefined}/></div></article>) : <div className="og-empty"><ReceiptText/><strong>Nenhum aporte nesta lista</strong><p>Os pagamentos registrados pela gestão aparecerão aqui.</p></div>}
    <p className="og-note">Valores dos seus lançamentos de caixa registrados nesta BIA.</p>
  </section><div className="og-stack">{nextPayment}{contact}</div></div></>;

  return <>{summary}<div className="og-dashboard-grid"><div className="og-stack"><section className="og-panel"><div className="og-panel-header"><div><h2>Seus aportes ao longo do tempo</h2><p>Valores pagos em cada mês</p></div><BarChart3/></div>
    {stats.monthly.length ? <><div className="og-chart" aria-label="Aportes pagos por mês. Consulte os valores na tabela abaixo.">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.monthly} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#e4eaee" strokeDasharray="3 4"/>
        <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#506474' }} dy={8} minTickGap={15}/>
        <YAxis width={48} tickFormatter={v => Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#506474' }}/>
        <Tooltip cursor={{ fill: '#f0f5f7' }} content={({ active, payload, label }) => active && payload?.length ? <div className="og-chart-tooltip">{monthLabel(String(label))}<strong>{money(Number(payload[0].value))}</strong></div> : null}/>
        <Bar dataKey="value" name="Aportado" fill="#005c81" radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive={false}/>
      </BarChart></ResponsiveContainer>
    </div><details className="og-chart-values"><summary>Ver valores por mês</summary><table><caption className="sr-only">Valores pagos por mês</caption><thead><tr><th scope="col">Mês</th><th scope="col">Aportado</th></tr></thead><tbody>{stats.monthly.map(item => <tr key={item.month}><td>{monthLabel(item.month)}</td><td>{money(item.value)}</td></tr>)}</tbody></table></details></> : <div className="og-empty"><BarChart3/><strong>Seu histórico começa aqui</strong><p>O gráfico será exibido quando houver pagamentos com data registrada.</p></div>}
    {stats.undatedPaid > 0 && <p className="og-note">{stats.undatedPaid} pagamento(s) sem data estão no total aportado, mas ainda não entram neste gráfico.</p>}
  </section><section className="og-panel"><div className="og-panel-header"><div><h2>Seus pagamentos</h2><p>Resumo dos aportes registrados</p></div><Wallet/></div>
    <div className="og-progress-label"><span>Pago <strong>{money(stats.pago)}</strong></span><span>A pagar <strong>{money(stats.aPagar)}</strong></span></div>
    {stats.paidPercent !== null ? <><div className="og-progress" role="progressbar" aria-label="Percentual pago dos aportes registrados" aria-valuenow={Math.round(stats.paidPercent)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: stats.paidPercent + '%' }}/></div><div className="og-progress-label"><span>{percent(stats.paidPercent)} pago</span><span>Total registrado {money(stats.total)}</span></div></> : <p className="og-note">Ainda não há aportes registrados.</p>}
    <Button variant="outline" className="mt-5 w-full" onClick={() => onTab('dinheiro')}>Ver aportes e comprovantes <ArrowRight size={16}/></Button>
  </section>{contact}</div><div className="og-stack"><section className="og-panel"><div className="og-panel-header"><div><h2>Suas cotas na aliança</h2><p>{number(data.cotas ?? 0)} de {number(data.totalCotas ?? 0)} cotas iniciais</p></div><Layers3/></div>
    {stats.quotaPercent !== null ? <><div className="og-quota-chart" role="img" aria-label={`${percent(stats.quotaPercent)} das cotas iniciais pertencem a você.`}>
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Suas cotas', value: data.cotas }, { name: 'Demais cotas', value: (data.totalCotas ?? 0) - (data.cotas ?? 0) }]} dataKey="value" innerRadius={64} outerRadius={83} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}><Cell fill="#005c81"/><Cell fill="#e1e9ed"/></Pie></PieChart></ResponsiveContainer>
      <div className="og-quota-center"><strong>{percent(stats.quotaPercent)}</strong><small>das cotas iniciais</small></div>
    </div><div className="og-legend"><span><i/>Suas cotas</span><span><i className="og-legend-rest"/>Demais cotas</span></div></> : <p className="og-muted">A distribuição das cotas ainda não foi informada.</p>}
    <p className="og-note">Esta divisão mostra as cotas iniciais. Os direitos econômicos seguem o MAP da BIA.</p>
  </section>{nextPayment}</div></div></>;
}
