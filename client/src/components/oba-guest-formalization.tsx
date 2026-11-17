import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Clock3, FileCheck2 } from 'lucide-react';
import { MOU_PERSON_FIELDS, MOU_ADDRESS_FIELDS, mouIsMarried, type MouQualification, type GuestFormalization, type GuestMouReview } from '@shared/bia-mou-qualification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ACCEPTANCE_LOCATION_NOTICE, captureRequiredAcceptanceLocation } from '@/lib/acceptanceLocation';

type Props = { accessId: string; name: string; email: string; state?: GuestFormalization; request: (url: string, body?: unknown) => Promise<any> };
export function GuestFormalizationFlow({ accessId, name, email, state, request }: Props) {
  const client = useQueryClient();
  const [data, setData] = useState<MouQualification>(() => state?.dados || { nome_completo: name, email, mesmo_endereco: true });
  const [step, setStep] = useState<'dados' | 'mou'>(() => state?.dados ? 'mou' : 'dados');
  const [accepted, setAccepted] = useState(false);
  const base = '/api/oba-guest/' + encodeURIComponent(accessId);
  const refresh = () => client.invalidateQueries({ queryKey: ['oba-guest', accessId] });
  const review = useQuery<{ mou?: GuestMouReview; dados?: MouQualification; resolved?: boolean }, Error>({
    queryKey: ['oba-guest-mou', accessId], queryFn: () => request(base + '/mou', {}),
    enabled: step === 'mou' && state?.mouDisponivel === true, retry: false, staleTime: 0,
  });
  useEffect(() => { setAccepted(false); }, [review.data?.mou?.hash]);
  useEffect(() => { if (review.data?.resolved) void refresh(); }, [review.data?.resolved]);
  const save = useMutation({ mutationFn: () => request(base + '/formalizacao', { dados: data }), onSuccess: async () => {
    client.removeQueries({ queryKey: ['oba-guest-mou', accessId] }); await refresh(); setStep('mou');
  } });
  const accept = useMutation({ mutationFn: async () => {
    if (!accepted || !review.data?.mou) throw new Error('Leia e confirme o aceite do MOU.');
    const location = await captureRequiredAcceptanceLocation();
    return request(base + '/mou', { aceitar_mou: true, mou_hash: review.data.mou.hash, map_revisao: review.data.mou.map_revisao, aceite_localizacao: location });
  }, onSuccess: async () => { client.removeQueries({ queryKey: ['oba-guest-mou', accessId] }); await refresh(); },
  onError: (error: Error & { status?: number }) => { if (error.status === 409) { setAccepted(false); void review.refetch(); } } });
  const set = (key: string, value: string | boolean) => setData(previous => ({ ...previous, [key]: value }));
  const fields = (items: readonly (readonly [string, string])[], prefix = '') => items.map(([key, label]) => {
    const id = prefix + key;
    return <label key={id} htmlFor={'formal-' + id}><span>{label} *</span><Input id={'formal-' + id} required maxLength={500}
      type={key === 'email' ? 'email' : key === 'data_nascimento' ? 'date' : key === 'telefone' ? 'tel' : 'text'}
      value={String(data[id] || '')} readOnly={id === 'email'} onChange={event => set(id, event.target.value)}/></label>;
  });
  const married = mouIsMarried(data);
  const error = save.error || accept.error;
  return <section className="og-panel og-formalization">
    <p className="og-eyebrow"><Check size={15}/> CANDIDATURA APROVADA</p>
    <h2>Vamos formalizar sua participação.</h2>
    <p className="og-muted">Preencha seus dados e aceite o MOU para acessar o painel da BIA.</p>
    <ol className="og-formal-steps" aria-label="Etapas da formalização">
      {['Dados para formalização', 'Leitura e aceite do MOU', 'Acesso à BIA'].map((label, index) => <li key={label} aria-current={index === (step === 'dados' ? 0 : 1) ? 'step' : undefined}><span>{index === 0 && step === 'mou' ? <Check size={15}/> : index + 1}</span>{label}</li>)}
    </ol>
    {step === 'dados' ? <form onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
      <fieldset disabled={save.isPending}>
        <legend>Seus dados</legend><div className="og-formal-grid">{fields(MOU_PERSON_FIELDS)}
          <label htmlFor="formal-civil"><span>Estado civil *</span><select id="formal-civil" required value={String(data.estado_civil || '')} onChange={event => set('estado_civil', event.target.value)}>
            <option value="">Selecione</option>{[['solteiro', 'Solteiro(a)'], ['casado', 'Casado(a)'], ['divorciado', 'Divorciado(a)'], ['viuvo', 'Viúvo(a)'], ['uniao_estavel', 'União estável']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        {married && <><h3>Dados do cônjuge</h3><div className="og-formal-grid">
          <label htmlFor="formal-regime"><span>Regime de comunhão *</span><select id="formal-regime" required value={String(data.regime_comunhao || '')} onChange={event => set('regime_comunhao', event.target.value)}>
            <option value="">Selecione</option>{[['comunhao_parcial', 'Comunhão parcial de bens'], ['comunhao_universal', 'Comunhão universal de bens'], ['separacao_total', 'Separação total de bens'], ['participacao_final_aquestos', 'Participação final nos aquestos'], ['outro', 'Outro']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>{fields(MOU_PERSON_FIELDS, 'conjuge_')}
        </div></>}
        <h3>Endereço</h3>
        {married && <label className="og-formal-check"><input type="checkbox" checked={data.mesmo_endereco === true} onChange={event => set('mesmo_endereco', event.target.checked)}/> Moro no mesmo endereço que meu cônjuge</label>}
        {married && data.mesmo_endereco !== true ? <><h4>Seu endereço</h4><div className="og-formal-grid">{fields(MOU_ADDRESS_FIELDS, 'titular_')}</div><h4>Endereço do cônjuge</h4><div className="og-formal-grid">{fields(MOU_ADDRESS_FIELDS, 'conjuge_')}</div></> : <div className="og-formal-grid">{fields(MOU_ADDRESS_FIELDS)}</div>}
      </fieldset>
      {error && <p role="alert" className="og-alert">{error.message}</p>}
      <div className="og-formal-actions"><Button type="submit" loading={save.isPending}>Salvar e continuar <ArrowRight size={16}/></Button></div>
    </form> : <>
      <Button variant="ghost" disabled={accept.isPending} onClick={() => { setStep('dados'); accept.reset(); setAccepted(false); }}><ArrowLeft size={16}/> Editar meus dados</Button>
      {!state?.mouDisponivel ? <div className="og-formal-wait" role="status"><Clock3/><h3>Seus dados estão salvos.</h3><p>Os responsáveis estão preparando o MOU desta BIA. Volte a este link para revisar e aceitar o documento assim que ele estiver disponível.</p></div>
        : review.isPending ? <p role="status">Preparando o MOU…</p>
        : review.error ? <><p className="og-alert" role="alert">{review.error.message}</p><Button loading={review.isFetching} loadingText="Abrindo…" onClick={() => review.refetch()}>Tentar novamente</Button></>
        : review.data?.mou && <>
          <div className="og-formal-document-heading"><FileCheck2/><div><h3>{review.data.mou.titulo}</h3><p className="og-muted">Versão {review.data.mou.versao} · Revisão {review.data.mou.map_revisao}</p></div></div>
          <details className="og-formal-data"><summary>Conferir meus dados para o aceite</summary><dl>{Object.entries(review.data.dados || {}).filter(([key]) => key !== 'mesmo_endereco').map(([key, value]) => <div key={key}><dt>{[...MOU_PERSON_FIELDS, ...MOU_ADDRESS_FIELDS].find(([id]) => id === key.replace(/^(conjuge_|titular_)/, ''))?.[1] || (key === 'estado_civil' ? 'Estado civil' : 'Regime de comunhão')}{key.startsWith('conjuge_') ? ' do cônjuge' : key.startsWith('titular_') ? ' do titular' : ''}</dt><dd>{String(value).replaceAll('_', ' ')}</dd></div>)}</dl></details>
          <div className="og-formal-document" role="region" aria-label="Texto completo do MOU" tabIndex={0}>{review.data.mou.texto}</div>
          <label className="og-formal-check"><input type="checkbox" checked={accepted} disabled={accept.isPending} onChange={event => setAccepted(event.target.checked)}/> Li o MOU e concordo com seus termos e com os dados informados para minha participação nesta BIA.</label>
          <p className="og-note">{ACCEPTANCE_LOCATION_NOTICE}</p>
          {error && <p role="alert" className="og-alert">{error.message}</p>}
          <div className="og-formal-actions"><Button disabled={!accepted || review.isFetching} loading={accept.isPending} loadingText="Registrando aceite…" onClick={() => accept.mutate()}>Aceitar MOU e acessar a BIA <ArrowRight size={16}/></Button></div>
        </>}
    </>}
  </section>;
}
