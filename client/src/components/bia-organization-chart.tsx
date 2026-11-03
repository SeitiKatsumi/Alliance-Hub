import React from 'react';
import { ChevronDown, Crown, Network, ShieldCheck, Target, UserRound, Users } from 'lucide-react';
import { biaOrganization, type OrganizationMember, type OrganizationPerson } from '../../../shared/bia-organization';
import { BiaMemberLink } from './bia-member-link';
import './bia-organization-chart.css';

type Props = { bia: Record<string, unknown>; names: Record<string, string>; members: ReadonlyArray<OrganizationMember> };

function Condition({ person }: { person: OrganizationPerson | null }) {
  if (!person) return null;
  return <span className="bia-org-conditions">
    {person.guardian && <span className="bia-org-badge bia-org-guardian">Guardião</span>}
    {person.multiplier && <span className="bia-org-badge bia-org-multiplier">Multiplicador</span>}
  </span>;
}

export function BiaOrganizationChart({ bia, names, members }: Props) {
  const chart = biaOrganization(bia, members);
  const memberName = (p: OrganizationPerson) => names[p.id]?.trim() || 'Participante vinculado';
  const personLink = (p: OrganizationPerson, className = '') => <BiaMemberLink memberId={p.id} name={memberName(p)} members={members} className={className} />;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).filter((_, i, parts) => i === 0 || i === parts.length - 1).map(part => part[0]).join('').toLocaleUpperCase('pt-BR');
  const node = (label: string | null, person: OrganizationPerson | null, leadership = false) => (
    <div className={`bia-org-node ${person?.guardian ? 'bia-org-node-guardian' : ''} ${person?.multiplier ? 'bia-org-node-multiplier' : ''}`}>
      <span className="bia-org-avatar" aria-hidden="true">{person && names[person.id]?.trim() ? initials(memberName(person)) : <UserRound size={18} />}</span>
      <div className="bia-org-person">
        {label && <p className="bia-org-role">{label}</p>}
        <div className={`bia-org-name ${!person ? 'bia-org-unassigned' : ''}`}>{person ? personLink(person) : 'Não atribuído'}</div>
        {!leadership && person && person.activity.length > 0 && <p className="bia-org-activity">{person.activity.join(' · ')}</p>}
        <Condition person={person} />
      </div>
    </div>
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
  </section>;
}
