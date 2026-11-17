import { GuestFormalizationFlow } from '@/components/oba-guest-formalization';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, Building2, Clock3, Home, LogOut, Mail, Newspaper, ShieldCheck, UsersRound, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ObaOfferScreen } from '@/components/oba-offer';
import { GuestAccessLayout, GuestPortalLayout } from '@/components/oba-guest-layout';
import { GuestApplications, GuestDashboard, type GuestPortalData } from '@/components/oba-guest-dashboard';
import { biaPhaseLabel } from '@shared/bia-phase';

export async function guestRequest(url: string, body?: unknown) {
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível continuar.'), { status: response.status });
  return data;
}

function EmailAccess({ opaId, token, accessId, onBack }: { opaId?: string; token?: string; accessId?: string; onBack?: () => void }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    if (!resendAt) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  const send = useMutation({ mutationFn: () => guestRequest('/api/oba-guest/code', { opaId, inviteToken: token, accessId, nome: name, email }),
    onSuccess: result => { setChallenge(result.challengeId); setResendAt(Date.now() + 60000); setCode(''); } });
  const verify = useMutation({ mutationFn: () => guestRequest('/api/oba-guest/verify', { challengeId: challenge, code }),
    onSuccess: result => { queryClient.removeQueries({ queryKey: ['oba-guest'] }); queryClient.removeQueries({ queryKey: ['oba-guest-mou'] }); navigate('/minha-bia/' + result.accessId); } });
  const error = verify.error || send.error;
  return <GuestAccessLayout>
    {onBack && !challenge && <button className="og-back" onClick={onBack}><ArrowLeft size={14}/> Opções de acesso</button>}
    <span className="og-icon">{challenge ? <ShieldCheck size={25}/> : <Mail size={25}/>}</span>
    <p className="og-eyebrow">{challenge ? 'CONFIRME SEU E-MAIL' : 'ACESSO À SUA BIA'}</p>
    <h2>{challenge ? 'Só falta o código.' : accessId ? 'Bom ter você de volta.' : 'Vamos começar?'}</h2>
    <p className="og-muted">{challenge ? <>Enviamos quatro números para <strong style={{ overflowWrap: 'anywhere' }}>{email}</strong>. Digite abaixo para continuar.</> : accessId ? 'Use o e-mail do seu convite para retomar o acompanhamento da BIA.' : 'Receba um código por e-mail e conheça a oferta. Você não precisa criar uma conta na plataforma.'}</p>
    <form onSubmit={event => { event.preventDefault(); if (send.isPending || verify.isPending) return; challenge ? code.length === 4 && verify.mutate() : send.mutate(); }}>
      {!challenge ? <>
        {!accessId && <label><span>Seu nome</span><Input autoComplete="name" placeholder="Como podemos chamar você?" required minLength={2} maxLength={200} value={name} onChange={event => setName(event.target.value)}/></label>}
        <label><span>E-mail</span><Input type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>
        <Button type="submit" loading={send.isPending} loadingText="Enviando…">Receber código <ArrowRight size={16}/></Button>
      </> : <>
        <label htmlFor="guest-access-code">Código de acesso</label>
        <InputOTP id="guest-access-code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={4} required value={code} onChange={value => { setCode(value.replace(/\D/g, '')); if (verify.error) verify.reset(); }} aria-describedby="guest-code-hint">
          <InputOTPGroup className="og-otp">{[0, 1, 2, 3].map(index => <InputOTPSlot key={index} index={index}/>)}</InputOTPGroup>
        </InputOTP>
        <Button type="submit" disabled={code.length !== 4 || send.isPending} loading={verify.isPending} loadingText="Confirmando…">Confirmar e continuar <ArrowRight size={16}/></Button>
        <div className="og-form-actions"><Button type="button" variant="ghost" disabled={send.isPending || verify.isPending} onClick={() => { setChallenge(''); verify.reset(); send.reset(); }}>Alterar e-mail</Button>
          <Button type="button" variant="ghost" disabled={remaining > 0 || verify.isPending} loading={send.isPending} loadingText="Enviando…" onClick={() => { verify.reset(); send.mutate(); }}>{remaining > 0 ? `Reenviar em ${remaining}s` : 'Reenviar código'}</Button></div>
        <p className="og-muted" id="guest-code-hint" style={{ fontSize: 12 }}>O código vale por 10 minutos. Não encontrou? Confira também a caixa de spam.</p>
      </>}
      {error && <p role="alert" className="og-alert">{error.message}</p>}
    </form>
  </GuestAccessLayout>;
}

export function ObaGuestEntry() {
  const { id = '' } = useParams<{ id: string }>();
  const token = window.location.hash.slice(1);
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [external, setExternal] = useState(false);
  const redeem = useMutation({ mutationFn: () => guestRequest(`/api/convite-publico/${encodeURIComponent(token)}/resgatar`, {}),
    onSuccess: result => navigate(result.redirect_url) });
  useEffect(() => { if (user && token && redeem.isIdle) redeem.mutate(); }, [user, token, redeem.isIdle]);
  if (!token) return <GuestAccessLayout><span className="og-icon"><Mail/></span><h2>Confira seu convite.</h2><p role="alert" className="og-muted">Este link está incompleto. Abra o link completo que você recebeu.</p></GuestAccessLayout>;
  if (isLoading || user) return <GuestAccessLayout><span className="og-icon"><Building2/></span><h2>Sua oportunidade está aqui.</h2><p className="og-muted" role={redeem.error ? 'alert' : 'status'}>{redeem.error?.message || 'Abrindo sua oportunidade…'}</p>
    {redeem.error && <Button className="mt-5" loading={redeem.isPending} loadingText="Abrindo…" onClick={() => redeem.mutate()}>Tentar novamente</Button>}</GuestAccessLayout>;
  if (external) return <EmailAccess opaId={id} token={token} onBack={() => setExternal(false)}/>;
  return <GuestAccessLayout>
    <span className="og-icon"><Building2 size={26}/></span><p className="og-eyebrow">VOCÊ FOI CONVIDADO</p><h2>Como quer participar?</h2>
    <p className="og-muted">Escolha como prefere conhecer esta oportunidade de aliança.</p>
    <div className="og-choice-list">
      <a className="og-choice" href={'/login?convite=' + encodeURIComponent(token)}><UsersRound/><span><strong>Já participo da BUILT</strong><small>Entrar na minha conta e ver a oportunidade.</small></span><ArrowRight/></a>
      <button className="og-choice og-choice-primary" onClick={() => setExternal(true)}><Building2/><span><strong>Quero participar só desta BIA</strong><small>Conhecer as cotas e acompanhar minha participação, sem criar uma conta.</small></span><ArrowRight/></button>
    </div>
    <p className="og-muted" style={{ fontSize: 12 }}>Você escolhe suas cotas e envia seu interesse para análise dos responsáveis pela BIA.</p>
  </GuestAccessLayout>;
}

export function ObaGuestPortal() {
  const { accessId = '' } = useParams<{ accessId: string }>();
  const [tab, setTab] = useState('inicio');
  const changeTab = (nextTab: string) => { setTab(nextTab); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const client = useQueryClient();
  const portal = useQuery<GuestPortalData, Error & { status?: number }>({ queryKey: ['oba-guest', accessId],
    queryFn: () => guestRequest('/api/oba-guest/' + accessId), retry: false, refetchInterval: 15000, staleTime: 0 });
  useEffect(() => { if (portal.data?.liberado) window.scrollTo({ top: 0, behavior: 'instant' }); }, [portal.data?.liberado]);
  const logout = useMutation({ mutationFn: () => guestRequest(`/api/oba-guest/${accessId}/logout`, {}),
    onSuccess: () => { client.removeQueries({ queryKey: ['oba-guest'] }); client.removeQueries({ queryKey: ['oba-guest-mou'] }); window.location.reload(); } });
  if (portal.isPending) return <GuestAccessLayout><h2>Preparando seu espaço.</h2><p className="og-muted" role="status">Abrindo sua BIA…</p></GuestAccessLayout>;
  if (portal.error?.status === 401) return <EmailAccess accessId={accessId}/>;
  if (portal.error) return <GuestAccessLayout><h2>Não foi possível abrir a BIA.</h2><p role="alert" className="og-alert">{portal.error.message}</p><Button className="mt-5" loading={portal.isFetching} loadingText="Abrindo…" onClick={() => portal.refetch()}>Tentar novamente</Button></GuestAccessLayout>;
  const data = portal.data;
  const actions = <Button variant="ghost" size="sm" loading={logout.isPending} loadingText="Saindo…" onClick={() => logout.mutate()}><LogOut size={15}/> Sair</Button>;
  if (!data.aprovado && !data.candidaturas.length) return <GuestPortalLayout actions={actions} contentAs="div"><div className="og-offer"><ObaOfferScreen opaId="" guestAccessId={accessId}/></div>{logout.error && <p role="alert" className="og-alert">{logout.error.message}</p>}</GuestPortalLayout>;
  const pending = data.candidaturas.some(item => item.status === 'pendente');
  const navigation = data.liberado === true && <nav className="og-nav" aria-label="Menu da BIA">
    {([{ id: 'inicio', label: 'Visão geral', Icon: Home }, { id: 'dinheiro', label: 'Meus aportes', Icon: Wallet }, { id: 'novidades', label: 'Novidades e documentos', Icon: Newspaper }]).map(({ id, label, Icon }) =>
      <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id)}><Icon size={18}/>{label}</button>)}
  </nav>;
  return <GuestPortalLayout actions={actions} navigation={navigation}>
    {logout.error && <p role="alert" className="og-alert">{logout.error.message}</p>}
    <header className="og-hero"><div><p className="og-eyebrow">OLÁ, {data.nome}</p><h1>{data.bia?.nome || data.oferta?.titulo || 'Minha BIA'}</h1><div className="og-hero-meta">
      {data.bia?.fase && <span className="og-status"><Building2 size={13}/>{biaPhaseLabel(data.bia.fase)}</span>}
      {data.bia?.etapa && <span>Etapa atual: {data.bia.etapa}</span>}
      {!data.aprovado && <span>Seu interesse na oportunidade</span>}
    </div></div>{data.oferta?.imagem && <img src={data.oferta.imagem} alt="Imóvel da BIA"/>}</header>
    {!data.aprovado ? <section className="og-panel og-pending"><span className="og-icon"><Clock3 size={25}/></span><p className="og-eyebrow">{pending ? 'INTERESSE ENVIADO' : 'ANÁLISE CONCLUÍDA'}</p>
      <h2>{pending ? 'O próximo passo é com a BIA.' : 'Confira suas solicitações.'}</h2><p className="og-muted">{pending ? 'Os responsáveis estão analisando sua solicitação. Após a aprovação, você preencherá os dados de formalização e aceitará o MOU para acessar sua BIA.' : 'Veja abaixo a decisão dos responsáveis para cada cota solicitada.'}</p>
      <GuestApplications applications={data.candidaturas}/><p className="og-note">Guarde este link para acompanhar a decisão. Você pode voltar usando seu e-mail.</p>
    </section> : data.liberado !== true ? <GuestFormalizationFlow accessId={accessId} name={data.nome} email={data.email} state={data.formalizacao} request={guestRequest}/> : <GuestDashboard data={data} accessId={accessId} tab={tab} onTab={changeTab}/>}
  </GuestPortalLayout>;
}
