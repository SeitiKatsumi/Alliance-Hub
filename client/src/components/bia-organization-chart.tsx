import React, { useRef, useState } from 'react';
import { ChevronDown, Crown, Network, ShieldCheck, Target, UserRound, Users } from 'lucide-react';
import { biaOrganization, type OrganizationMember, type OrganizationPerson } from '../../../shared/bia-organization';
import { BiaParticipantDialog } from './bia-participant-dialog';
import './bia-organization-chart.css';

type Props = { bia: Record<string, unknown>; names: Record<string, string>; members: ReadonlyArray<OrganizationMember>; canViewFinancial?: boolean };

function Condition({ person }: { person: OrganizationPerson | null }) {
  if (!person) return null;
  return <span className="bia-org-conditions">
    {person.guardian && <span className="bia-org-badge bia-org-guardian">Guardião</span>}
    {person.multiplier && <span className="bia-org-badge bia-org-multiplier">Multiplicador</span>}
  </span>;
}

export function BiaOrganizationChart({ bia, names, members, canViewFinancial = false }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeParticipant = () => setSelectedId(null);
  const chart = biaOrganization(bia, members);
  const selected = [chart.director, chart.advisor, chart.author, ...chart.branches.flatMap(branch => [branch.person, ...branch.members]), ...chart.participants].find(person => person?.id === selectedId);
  const memberName = (p: OrganizationPerson) => names[p.id]?.trim() || 'Participante vinculado';
  const personLink = (p: OrganizationPerson, className = '') => <button type="button" onClick={event => { triggerRef.current = event.currentTarget; setSelectedId(p.id); }} className={`${className} rounded-sm text-left hover:text-primary focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`Ver participação de ${memberName(p)}`}>{memberName(p)}</button>;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).filter((_, i, parts) => i === 0 || i === parts.length - 1).map(part => part[0]).join('').toLocaleUpperCase('pt-BR');
  const node = (label: string | null, person: OrganizationPerson | null, leadership = false) => (
    <button type="button" disabled={!person} onClick={event => { if (person) { triggerRef.current = event.currentTarget; setSelectedId(person.id); } }} aria-label={person ? `Ver participação de ${memberName(person)}` : `${label}: Não atribuído`} className={`bia-org-node w-full text-left enabled:hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${person?.guardian ? 'bia-org-node-guardian' : ''} ${person?.multiplier ? 'bia-org-node-multiplier' : ''}`}>
      <span className="bia-org-avatar" aria-hidden="true">{person && names[person.id]?.trim() ? initials(memberName(person)) : <UserRound size={18} />}</span>
      <span className="bia-org-person">
        {label && <span className="bia-org-role block">{label}</span>}
        <span className={`bia-org-name block ${!person ? 'bia-org-unassigned' : ''}`}>{person ? memberName(person) : 'Não atribuído'}</span>
        {!leadership && person && person.activity.length > 0 && <span className="bia-org-activity block">{person.activity.join(' · ')}</span>}
        <Condition person={person} />
      </span>
    </button>
  );
  const team = (branch: typeof chart.branches[number]) => branch.members.length > 0 && (
    <ul className="bia-org-team" aria-label={`Participantes — ${branch.title}`}>
      {branch.members.map(person => <li key={person.id}>{node(null, person)}</li>)}
    </ul>
  );
  const initialBranch = Math.max(0, chart.branches.findIndex(branch => branch.members.length > 0 || branch.person));
  return <section className="bia-org rounded-xl border border-border bg-card text-card-foreground" aria-label="Organograma da governança" data-testid="bia-organization-chart">
    <header className="bia-org-header">
      <div><h2><Network aria-hidden="true" size={20} />Governança</h2><p>Estrutura organizacional da BIA</p></div>
      <div className="bia-org-legend" aria-label="Condições dos participantes"><span className="bia-org-badge bia-org-guardian">Guardião</span><span className="bia-org-badge bia-org-multiplier">Multiplicador</span></div>
    </header>
    <div className="bia-org-tree">
      <div className="bia-org-leadership">
        <div className="bia-org-director">{node('Diretor de Aliança', chart.director, true)}</div>
        <aside className="bia-org-advisor" aria-label="Conselheiro da BIA">{node('Aliado Licenciado · Conselheiro', chart.advisor, true)}</aside>
      </div>
      <ul className="bia-org-branches" aria-label="Núcleos coordenados pela Diretoria de Aliança">
        {chart.branches.map(branch => <li key={branch.role} className="bia-org-branch">
          {node(branch.label, branch.person, true)}
          {team(branch)}
        </li>)}
      </ul>
      <div className="bia-org-mobile" aria-label="Núcleos coordenados pela Diretoria de Aliança">
        {chart.branches.map((branch, index) => <details key={branch.role} className="bia-org-nucleus" open={index === initialBranch}>
          <summary><span><strong>{branch.title}</strong><span className="bia-org-summary-name">{branch.person ? memberName(branch.person) : 'Não atribuído'}</span></span><ChevronDown size={18} aria-hidden="true" /></summary>
          <div className="bia-org-nucleus-content">{node(branch.label, branch.person, true)}{team(branch)}</div>
        </details>)}
      </div>
    </div>
    {chart.author && <div className="bia-org-author"><Target aria-hidden="true" size={16} /><span>Autor da oportunidade</span>{personLink(chart.author, 'font-medium')}</div>}
    {chart.participants.length > 0 && <details className="bia-org-participants"><summary><span><Users aria-hidden="true" size={16} />Outros participantes <span className="text-muted-foreground">({chart.participants.length})</span></span><ChevronDown aria-hidden="true" size={18} /></summary><ul>{chart.participants.map(person => <li key={person.id}>{node(null, person)}</li>)}</ul></details>}
    {selected && <BiaParticipantDialog key={`${String(bia.id)}:${selected.id}`} biaId={String(bia.id || '')} biaName={String(bia.nome || bia.nome_bia || 'BIA')} currency={String(bia.moeda || 'BRL')} person={selected} name={memberName(selected)} member={members.find(member => member.id === selected.id)} canViewFinancial={canViewFinancial} onClose={closeParticipant} restoreFocus={() => triggerRef.current?.focus()}/>}
  </section>;
}
