import type { ReactNode } from 'react';
import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react';
import builtLogo from '@assets/Logo_Built_2_Horizontal_Branca_Nova.png';
import builtHorizontalLogo from '@assets/Logo_Built_3_Horizontal_Negativo.png';
import './oba-guest.css';

export function GuestBrand({ horizontal = false }: { horizontal?: boolean }) {
  return <picture>{horizontal && <source media="(min-width: 801px)" srcSet={builtHorizontalLogo}/>}<img className={'og-logo' + (horizontal ? ' og-logo-header' : '')} src={builtLogo} alt="BUILT — Builders United for Investment, Logistics and Trade"/></picture>;
}

export function GuestAccessLayout({ children, step = 0 }: { children: ReactNode; step?: number }) {
  return <main className="og og-access" data-theme-fixed>
    <div className="og-access-layout">
      <section className="og-intro">
        <GuestBrand/>
        <div className="og-intro-copy"><p className="og-eyebrow">UM CONVITE PARA CONSTRUIR JUNTOS</p>
          <h1>Uma aliança.<br/><span>Novas possibilidades.</span></h1>
          <p>Conheça a oportunidade, escolha suas cotas e acompanhe sua BIA em um só lugar.</p>
        </div>
        <ol className="og-journey" aria-label="Como funciona">
          {['Confirme seu acesso', 'Escolha suas cotas', 'Formalize sua participação', 'Acompanhe sua BIA'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>
            <span>{index < step ? <Check size={16}/> : `0${index + 1}`}</span><div>{label}{index === 1 && <small>Interesse sujeito à aprovação da BIA</small>}{index === 2 && <small>Dados e aceite do MOU após a aprovação</small>}</div>
          </li>)}
        </ol>
        <p className="og-signature">Build it. Own it. <ArrowUpRight size={17}/></p>
      </section>
      <section className="og-access-card">{children}<p className="og-access-foot"><LockKeyhole size={15}/> Acesso individual, vinculado ao seu e-mail.</p></section>
    </div>
  </main>;
}

export function GuestPortalLayout({ children, actions, navigation, contentAs: Content = 'main' }: { children: ReactNode; actions?: ReactNode; navigation?: ReactNode; contentAs?: 'main' | 'div' }) {
  return <div className="og og-portal" data-theme-fixed>
    <header className="og-topbar"><div><GuestBrand horizontal/><span className="og-space-label">Seu espaço na aliança</span></div>{actions}</header>
    {navigation}
    <Content className="og-content">{children}</Content>
    <footer className="og-footer"><span>BUILT · Sua BIA, mais perto de você.</span><span>Build it. Own it.</span></footer>
  </div>;
}
