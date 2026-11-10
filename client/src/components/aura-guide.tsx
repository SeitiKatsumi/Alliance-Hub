import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { ModuleInfo } from "./module-info";

const steps = [
  { target: "aura-guide-score", title: "Sua Aura" },
  { target: "aura-guide-lookup", title: "Consultar Aura" },
  { target: "aura-guide-dimensions", title: "Dimensões da Aura" },
] as const;

const description = "Registra percepções reputacionais entre pessoas vinculadas na rede e consolida as evidências nas dimensões Técnica, Relacional e Comportamental.";
const sessionDecisions = new Set<string>();
const useGuideLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const preferenceKey = (id: string) => `built:aura:guide:v1:${id}`;

export function hasSeenAuraGuide(id: string) {
  const key = preferenceKey(id);
  try { return sessionDecisions.has(key) || window.localStorage.getItem(key) === "seen"; }
  catch { return sessionDecisions.has(key); }
}

export function rememberAuraGuide(id: string) {
  const key = preferenceKey(id);
  sessionDecisions.add(key);
  try { window.localStorage.setItem(key, "seen"); } catch { /* A decisão vale nesta sessão. */ }
}

type Props = { memberId: string | null; hasScore: boolean; canConsult: boolean; onConsult: () => void };

export function AuraGuide({ memberId, hasScore, canConsult, onConsult }: Props) {
  const [invite, setInvite] = useState(() => !!memberId && !hasSeenAuraGuide(memberId));
  const [step, setStep] = useState<number | null>(null);
  const help = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const active = step !== null;
  const instructions = [
    hasScore ? "Este índice reúne as percepções recebidas. Veja quantas pessoas avaliaram você e a cobertura dessas avaliações." : "Sua Aura está em formação. As percepções dos membros sobre sua atuação ajudam a formar seu índice.",
    canConsult ? "Procure um membro da rede. Em “Posso avaliar”, você encontra as pessoas para quem pode registrar uma percepção." : "Este botão mostra as condições para consultar membros e registrar percepções na rede BUILT.",
    "Técnica descreve como você entrega seu trabalho. Relacional mostra como você colabora. Comportamental reúne percepções sobre suas atitudes.",
  ];
  function dismissInvite() {
    if (memberId) rememberAuraGuide(memberId);
    setInvite(false);
  }
  function start() { dismissInvite(); setStep(0); }
  function close() {
    dialog.current?.close();
    setStep(null);
    help.current?.focus({ preventScroll: true });
  }
  useGuideLayoutEffect(() => {
    if (!active) return;
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, [active]);
  useGuideLayoutEffect(() => {
    if (step === null) return;
    const target = document.getElementById(steps[step].target);
    if (!target) { setStep(null); return; }
    target.scrollIntoView({ block: "start", behavior: "instant" });
    const measure = () => setRect(target.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);
  useEffect(() => { if (step !== null) panel.current?.focus({ preventScroll: true }); }, [step]);

  return <div className="min-w-0 space-y-1">
    <div className="flex items-center gap-2">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground"><Sparkles className="h-5 w-5 text-[#D7BB7D]" />Aura Percebida</h1>
      {memberId ? <button type="button" ref={help} onClick={start} aria-label="Abrir guia da Aura" title="Guia da Aura" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-4 w-4" /></button>
        : <ModuleInfo title="Aura Percebida" description={description} />}
    </div>
    <p className="text-sm text-muted-foreground">Reputação construída pela percepção da comunidade sobre você.</p>
    {invite && <section aria-label="Guia da Aura" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <p className="mr-2 text-sm font-medium">Quer conhecer sua Aura em 3 passos?</p>
      <Button type="button" size="sm" onClick={start}>Ver guia</Button>
      <Button type="button" size="sm" variant="ghost" onClick={dismissInvite}>Agora não</Button>
    </section>}
    {step !== null && <dialog ref={dialog} aria-labelledby="aura-guide-title" aria-describedby="aura-guide-text" onCancel={event => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-foreground backdrop:bg-transparent">
      {rect && <div aria-hidden="true" className="pointer-events-none fixed rounded-lg border-2 border-primary shadow-[0_0_0_200vmax_rgba(0,0,0,0.66)]"
        style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <div ref={panel} tabIndex={-1} className="fixed inset-x-3 bottom-3 max-h-[55dvh] overflow-auto rounded-xl border bg-card p-4 text-card-foreground shadow-lg outline-none sm:inset-x-auto sm:bottom-auto sm:w-80 sm:left-[var(--guide-left)] sm:top-[var(--guide-top)]"
        style={rect ? { "--guide-left": `${Math.max(12, Math.min(rect.left, window.innerWidth - 332))}px`, "--guide-top": `${Math.max(12, Math.min(rect.bottom + 12, window.innerHeight - (panel.current?.offsetHeight || 204) - 12))}px` } as React.CSSProperties : undefined}>
        <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground" aria-live="polite">Passo {step + 1} de {steps.length}</p><Button type="button" size="sm" variant="ghost" onClick={close}>Fechar</Button></div>
        <h2 id="aura-guide-title" className="mt-1 font-semibold">{steps[step].title}</h2>
        <p id="aura-guide-text" className="my-3 text-sm">{instructions[step]}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {step > 0 && <Button type="button" size="sm" variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>}
          {step < steps.length - 1 ? <Button type="button" size="sm" onClick={() => setStep(step + 1)}>Próximo</Button>
            : <Button type="button" size="sm" onClick={() => { close(); if (canConsult) onConsult(); }}>{canConsult ? "Consultar membros" : "Concluir"}</Button>}
        </div>
      </div>
    </dialog>}
  </div>;
}
