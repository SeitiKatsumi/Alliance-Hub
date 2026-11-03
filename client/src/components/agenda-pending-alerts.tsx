import React from "react";
import type { AgendaPendingAlert } from "../lib/agenda-alerts";

type Props = {
  items: AgendaPendingAlert[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (item: AgendaPendingAlert) => void;
};

export function AgendaPendingAlerts({ items, loading, error, onRetry, onOpen }: Props) {
  // Same endpoint projection and eligibility as the sidebar/summary count.
  const pending = items.filter(item => item.group === "pendencias" && item.active && item.action_required);
  return <section className="min-w-0 rounded-xl border border-border bg-card" aria-labelledby="pending-alerts-title">
    <h2 id="pending-alerts-title" className="border-b border-border px-4 py-4 font-semibold">Pendências ativas</h2>
    {loading ? <p className="p-6 text-sm text-muted-foreground" role="status">Carregando alertas...</p>
      : error ? <div className="space-y-3 p-6" role="alert">
        <p className="text-sm text-destructive">Não foi possível atualizar seus alertas.</p>
        <button type="button" onClick={onRetry} className="rounded-md border border-border px-4 py-2 text-sm font-medium">Tentar novamente</button>
      </div>
      : pending.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhuma pendência ativa no momento.</p>
      : <ul className="divide-y divide-border">
        {pending.map(item => <li key={item.id}>
          <button type="button" onClick={() => onOpen(item)} className="flex w-full min-w-0 items-center gap-3 p-4 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-semibold text-foreground">{item.title}</span>
              {item.description && <span className="mt-1 block break-words text-sm text-muted-foreground">{item.description}</span>}
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">Ver detalhes <span aria-hidden="true">→</span></span>
          </button>
        </li>)}
      </ul>}
  </section>;
}
