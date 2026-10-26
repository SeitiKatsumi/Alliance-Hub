import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { splitExpense, inheritedExpensePayment } from "../shared/expense-contributions";

export const EXPENSE_CONTRIBUTIONS_SQL = `CREATE TABLE IF NOT EXISTS bia_despesa_aportes (
 id uuid PRIMARY KEY, bia_id text NOT NULL, autor text NOT NULL, pedido_hash text NOT NULL,
 movimentos jsonb NOT NULL, estado text NOT NULL DEFAULT 'pendente', criado_em timestamp NOT NULL DEFAULT now()
); CREATE INDEX IF NOT EXISTS bia_despesa_aportes_bia ON bia_despesa_aportes(bia_id);`;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const ids = z.array(z.string().min(1)).max(100).default([]);
export const expenseRequest = z.object({
  requestId: z.string().uuid(), bia: z.string().min(1),
  expense: z.object({ valor: z.number().positive(), data: date, descricao: z.string().trim().min(1).max(2000),
    membro_responsavel: z.string().nullable(), status: z.enum(["pendente", "agendado", "pago", "vencido", "parcial"]), data_vencimento: date,
    data_pagamento: date.nullable(), Categoria: ids, Favorecido: z.array(z.string().min(1)).max(1).default([]), anexos: z.array(z.string().uuid()).max(30).default([]) }),
  mode: z.enum(["equal", "map", "manual"]), participants: z.array(z.object({ memberId: z.string().min(1), value: z.number().optional(), attachmentIds: z.array(z.string().uuid()).max(30).optional() })).min(1).max(100),
  mirrorExpenses: z.literal(true).optional(),
  dueDate: date, cppType: z.string().min(1).nullable(),
  expected: z.array(z.object({ memberId: z.string(), amount: z.number() })).min(1).max(100),
});
const fault = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export async function expenseLinks(db: any, flowId: string) {
  return (await db.execute(sql`SELECT * FROM bia_despesa_aportes WHERE movimentos @> ${JSON.stringify([{ id: flowId }])}::jsonb LIMIT 1`)).rows[0];
}
export async function protectExpenseEntry(db: any, id: string, patch: any) {
  const lot = await expenseLinks(db, id);
  if (!lot) return;
  if (lot.estado !== "concluido") throw fault("Conclua a criação da despesa e dos aportes antes de alterar este lançamento.");
  if (!patch) throw fault("Este lançamento pertence a uma despesa com aportes vinculados e não pode ser excluído isoladamente.");
  const original = lot.movimentos.find((m: any) => m.id === id);
  if ((patch.bia !== undefined && String(patch.bia) !== lot.bia_id) || (patch.tipo !== undefined && patch.tipo !== original.tipo) || (patch.favorecido_id !== undefined && patch.favorecido_id !== original.favorecido_id)) throw fault("Não altere a BIA, o tipo ou o participante de um lançamento vinculado.");
}

export function registerExpenseContributions(app: any, deps: {
  db: any; access: (req: any, res: any, bia: string, level: "view" | "edit") => Promise<any>;
  phase: (id: string) => Promise<void>; lock: (id: string, work: () => Promise<any>) => Promise<any>;
  map: (bia: any, id: string) => Promise<{ memberId: string; percent: number }[]>;
  members: (bia: any) => string[];
  one: (collection: string, id: string, fields?: string) => Promise<any>;
  createBatch: (items: any[]) => Promise<any>;
}) {
  app.post("/api/fluxo-caixa/despesa-aportes", async (req: any, res: any) => {
    let canRevise = false;
    try {
      const input = expenseRequest.parse(req.body);
      const auth = await deps.access(req, res, input.bia, "edit"); if (!auth) return;
      const biaId = String(auth.bia.id);
      const actor = String(req.session.directusUserId);
      const hash = createHash("sha256").update(JSON.stringify({ ...input, bia: biaId })).digest("hex");
      const result = await deps.lock(biaId, async () => {
        let lot = (await deps.db.execute(sql`SELECT * FROM bia_despesa_aportes WHERE id=${input.requestId}`)).rows[0];
        canRevise = !lot;
        if (lot && (lot.bia_id !== biaId || lot.autor !== actor || lot.pedido_hash !== hash)) throw fault("Esta solicitação já foi usada com outros dados. Retome o lote original.");
        if (lot?.estado === "concluido") return { id: lot.id, movimentos: lot.movimentos, estado: lot.estado };
        await deps.phase(biaId);
        if (!lot) {
          const map = await deps.map(auth.bia, biaId);
          const allowed = new Set([...deps.members(auth.bia), ...map.map(m => m.memberId)]);
          for (const p of input.participants) {
            if (!allowed.has(p.memberId) || !await deps.one("cadastro_geral", p.memberId, "fields=id")) throw fault("Participante indisponível nesta BIA.", 400);
          }
          for (const id of [input.expense.membro_responsavel, ...input.expense.Favorecido].filter(Boolean) as string[]) {
            if (!await deps.one("cadastro_geral", id, "fields=id")) throw fault("Responsável ou favorecido inválido.", 400);
          }
          if (input.cppType && !await deps.one("Tipos_CPP", input.cppType, "fields=id")) throw fault("Tipo de CPP inválido.", 400);
          for (const id of input.expense.Categoria) if (!await deps.one("Categorias", id, "fields=id")) throw fault("Categoria inválida.", 400);
          let split;
          try { split = splitExpense(input.expense.valor, input.mode, input.participants, map); }
          catch (e: any) { throw fault(e.message, 400); }
          if (JSON.stringify(split) !== JSON.stringify(input.expected)) throw fault("O rateio mudou. Atualize o MAP e confira a prévia antes de salvar novamente.");
          let payment;
          try { payment = inheritedExpensePayment(input.expense); }
          catch (e: any) { throw fault(e.message, 400); }
          const expenseId = randomUUID();
          const movements: any[] = [{ ...input.expense, id: expenseId, bia: biaId, tipo: "saida", valor: String(input.expense.valor),
            favorecido_id: input.expense.Favorecido[0] || null,
            Categoria: input.expense.Categoria.map(id => ({ categorias_id: id })), tipo_de_cpp: [],
            Anexos: input.expense.anexos.map(id => ({ directus_files_id: id })) },
            ...split.map(p => ({ id: randomUUID(), bia: biaId, tipo: "entrada", valor: String(p.amount), data: input.expense.data,
              descricao: `Aporte para: ${input.expense.descricao}`, membro_responsavel: p.memberId, favorecido_id: p.memberId,
              ...payment, data_vencimento: input.dueDate, Categoria: [],
              tipo_de_cpp: input.cppType ? [{ tipos_cpp_id: input.cppType }] : [], Anexos: [] }))];
          if (input.mirrorExpenses) {
            if (input.mode !== "manual") throw fault("Os aportes devem herdar os valores da saída.", 400);
            const expenseBase = movements[0];
            const pairs = split.flatMap(p => {
              const id = randomUUID();
              const contribution = movements.find(m => m.tipo === "entrada" && m.favorecido_id === p.memberId);
              return [{ ...expenseBase, id, valor: String(p.amount), favorecido_id: p.memberId, Favorecido: [p.memberId],
                tipo_de_cpp: input.cppType ? [{ tipos_cpp_id: input.cppType }] : [],
                Anexos: [...new Set([...input.expense.anexos, ...(input.participants.find(row => row.memberId === p.memberId)?.attachmentIds || [])])].map(file => ({ directus_files_id: file })) },
                { ...contribution, despesa_origem_id: id }];
            });
            movements.splice(0, movements.length, ...pairs);
          }
          // Persist the intent before remote I/O. IDs remain identical after a lost response.
          canRevise = false;
          await deps.db.execute(sql`INSERT INTO bia_despesa_aportes (id,bia_id,autor,pedido_hash,movimentos) VALUES (${input.requestId},${biaId},${actor},${hash},${JSON.stringify(movements)}::jsonb)`);
          lot = { id: input.requestId, bia_id: biaId, movimentos: movements };
        }
        const found = await Promise.all(lot.movimentos.map((m: any) => deps.one("fluxo_caixa", m.id, "fields=id,bia")));
        if (found.some(Boolean) && !found.every(Boolean)) throw fault("Lote incompleto: mantenha esta solicitação e contate o suporte para conciliação.", 503);
        if (!found.some(Boolean)) await deps.createBatch(lot.movimentos.map(({ Favorecido, anexos, despesa_origem_id, ...m }: any) => m));
        // Audit and completion commit together. Retrying never repeats these records.
        await deps.db.transaction(async (tx: any) => {
          for (const m of lot.movimentos) await tx.execute(sql`INSERT INTO fluxo_caixa_historico (fluxo_caixa_id,bia_id,acao,ator_user_id,origem,dados_depois,payload)
            VALUES (${m.id},${biaId},'criado',${actor},'despesa-aportes',${JSON.stringify(m)}::jsonb,${JSON.stringify({ lote: lot.id, despesa: m.despesa_origem_id || (m.tipo === "saida" ? m.id : lot.movimentos[0].id) })}::jsonb)`);
          await tx.execute(sql`UPDATE bia_despesa_aportes SET estado='concluido' WHERE id=${lot.id}`);
        });
        return { id: lot.id, movimentos: lot.movimentos, estado: "concluido" };
      });
      res.json(result);
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : error.statusCode || 503).json({ canRevise: error instanceof z.ZodError || canRevise, error: error instanceof z.ZodError ? "Revise os campos da despesa e dos aportes." : error.statusCode ? error.message : "Não foi possível concluir o lote. Tente novamente com a mesma solicitação." });
    }
  });
  app.get("/api/fluxo-caixa/:id/vinculos", async (req: any, res: any) => {
    try {
      if (!req.session?.directusUserId) return res.status(401).json({ error: "Não autenticado" });
      const lot = await expenseLinks(deps.db, String(req.params.id));
      if (!lot) return res.json(null);
      if (!await deps.access(req, res, lot.bia_id, "view")) return;
      const current = lot.movimentos.find((m: any) => m.id === req.params.id);
      const expenseId = current.despesa_origem_id || (current.tipo === "saida" ? current.id : lot.movimentos[0].id);
      const paired = lot.movimentos.some((m: any) => m.despesa_origem_id);
      const related = paired ? lot.movimentos.filter((m: any) => m.id === expenseId || m.despesa_origem_id === expenseId) : lot.movimentos;
      const entries = await Promise.all(related.map((m: any) => deps.one("fluxo_caixa", m.id, "fields=id,descricao,valor,status,bia")));
      res.json({ id: lot.id, estado: lot.estado, despesaId: expenseId, movimentos: related.map((m: any, i: number) => ({ id: m.id, tipo: m.tipo, descricao: entries[i]?.descricao || m.descricao, valor: entries[i]?.valor ?? m.valor, status: entries[i]?.status || "pendente" })) });
    } catch { res.status(503).json({ error: "Vínculos indisponíveis. Tente novamente." }); }
  });
}
