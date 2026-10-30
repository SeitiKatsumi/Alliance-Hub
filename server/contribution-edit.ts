import { categoryText } from "../shared/financial-categories";
import { confirmsContributionReceipt, relatedContributionIds } from "../shared/contribution-edit";

const relation = (value: any): string => String(value?.id ?? value ?? "");
const fault = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export type ContributionEditDependencies = {
  lot: (id: string) => Promise<any>;
  lock: (bia: string, work: () => Promise<any>) => Promise<any>;
  access: (id: string) => Promise<any>;
  phase: (bia: string) => Promise<void>;
  category: (id: string) => Promise<any>;
  member: (id: string) => Promise<any>;
  protect: (id: string, patch: any) => Promise<void>;
  update: (id: string, patch: any) => Promise<any>;
  batch: (id: string, patch: any, rows: any[]) => Promise<any>;
  audit: (id: string, action: string, before: any, after: any, details: any) => Promise<void>;
};

/** Applies only to linked incoming contributions; no writes to the expense or lot snapshot. */
export async function editLinkedContribution(id: string, patch: any, applyCategory: boolean, actorMemberId: string | null, deps: ContributionEditDependencies) {
  const initial = await deps.lot(id);
  if (!initial) {
    if (applyCategory) throw fault("Este lançamento não possui aportes vinculados.", 400);
    return null;
  }
  const original = initial.movimentos.find((m: any) => String(m.id) === id);
  if (original?.tipo !== "entrada") {
    if (applyCategory) throw fault("A categoria em conjunto está disponível nos aportes de entrada.", 400);
    return null;
  }
  return deps.lock(initial.bia_id, async () => {
    const lot = await deps.lot(id);
    if (!lot || lot.id !== initial.id || lot.bia_id !== initial.bia_id || lot.estado !== "concluido") throw fault("Atualize os vínculos antes de editar este aporte.");
    const ids = applyCategory ? relatedContributionIds(lot, id) : [id];
    const snapshots = new Map<string, any>();
    for (const target of ids) {
      const current = await deps.access(target);
      if (!current) throw fault("Sem permissão para editar os aportes desta despesa.", 403);
      if (relation(current.bia) !== String(lot.bia_id) || current.tipo !== "entrada") throw fault("Os vínculos dos aportes mudaram. Atualize a página.");
      snapshots.set(target, current);
    }
    await deps.phase(lot.bia_id);
    const before = snapshots.get(id);
    const data = { ...patch };
    if (confirmsContributionReceipt(before, data)) {
      if (!actorMemberId || !await deps.member(actorMemberId)) throw fault("Seu usuário precisa estar vinculado a um membro para confirmar este aporte.", 400);
      data.membro_responsavel = actorMemberId;
    } else delete data.membro_responsavel;
    if (applyCategory) {
      if (!Array.isArray(data.Categoria) || data.Categoria.length > 1) throw fault("Selecione uma categoria válida para os aportes.", 400);
      for (const row of data.Categoria) {
        if (!row || !relation(row.categorias_id)) throw fault("Selecione uma categoria válida para os aportes.", 400);
        const category = await deps.category(relation(row.categorias_id));
        const direction = categoryText(category?.Tipo_de_categoria).toLowerCase();
        if (!category || (category.bia_id && relation(category.bia_id) !== String(lot.bia_id)) || (direction && direction !== "entrada"))
          throw fault("Categoria indisponível para os aportes desta BIA.", 400);
      }
      data.Categoria = data.Categoria.map((row: any) => ({ categorias_id: relation(row.categorias_id) }));
    }
    const rows = ids.map(target => ({ id: target, ...(target === id ? data : { Categoria: data.Categoria }) }));
    for (const { id: target, ...change } of rows) await deps.protect(target, change);
    const details = { lote: lot.id, categoriaEmConjunto: applyCategory, movimentos: ids };
    // Durable intent preserves the operator and before-values even after a lost remote response.
    for (const row of rows) await deps.audit(row.id, "edicao_aporte_solicitada", snapshots.get(row.id), row, details);
    const result = applyCategory ? await deps.batch(id, data, rows) : await deps.update(id, data);
    for (const row of rows) await deps.audit(row.id, row.id === id && confirmsContributionReceipt(before, data) ? "pagamento_confirmado" : "editado",
      snapshots.get(row.id), { ...snapshots.get(row.id), ...row }, details);
    return { item: applyCategory ? (Array.isArray(result) ? result.find(r => String(r.id) === id) : result) : result, updatedIds: ids };
  });
}
