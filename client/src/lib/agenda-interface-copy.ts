import { agendaTaskTitle, agendaSourceAction, type AgendaActionSource } from '@shared/agenda-action';
import type { Language } from '@shared/user-preferences';
import { translateInterface } from './interface-language';
export function localizedTaskTitle(task: AgendaActionSource, language: Language) {
  const title = agendaTaskTitle(task);
  if (task.contexto_tipo === 'aporte_reminder' && task.origem_tarefa_id && title === 'Pagar aporte') return translateInterface(title,language);
  if (task.contexto_tipo === 'bia' && agendaSourceAction(task)) {
    const revision = /^Ler e aceitar MOU · revisão (\d+)$/.exec(title);
    if (revision) return translateInterface('Ler e aceitar MOU · revisão {0}',language).replace('{0}',()=>revision[1]);
  }
  return title;
}
export function localizedTaskDescription(task: AgendaActionSource & { descricao?: string | null }, language: Language) {
  const raw = task.descricao || '';
  if (task.contexto_tipo === 'aporte_reminder' && task.origem_tarefa_id && raw.startsWith('Aporte de ')) {
    return translateInterface('Aporte de {0}',language).replace('{0}',()=>raw.slice('Aporte de '.length));
  }
  if (task.contexto_tipo === 'bia' && agendaSourceAction(task)) {
    const match = /^O MAP Inicial da BIA (.+) mudou para a revisão (\d+)\. Leia o documento atualizado e confirme seu aceite antes da ativação\.$/.exec(raw);
    if (match) return translateInterface('O MAP Inicial da BIA {0} mudou para a revisão {1}. Leia o documento atualizado e confirme seu aceite antes da ativação.',language).replace(/\{([01])\}/g,(_,index)=>match[Number(index)+1]);
  }
  return raw;
}
