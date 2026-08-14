import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const BIA_ID = "ec7d8735-7ef2-410b-8c19-07ce69f38e9d";
const INVALID_AGGREGATE_ID = "64d932a8-52d1-40fd-b357-2c9eca544cc0";
const REPAIR_ID = "repair_veneto_origin_20260814";
const SNAPSHOT_FROM = "2026-08-07 16:21:00";
const SNAPSHOT_TO = "2026-08-07 16:22:00";
const EXPECTED_INSTALLMENTS = 85;
const EXPECTED_TOTAL = 1_601_045.24;
const EXPECTED_PAID_COUNT = 8;
const EXPECTED_PAID_TOTAL = 194_568.80;

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function relationId(value: any): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object") return value;
  return value.id ?? null;
}

function relationItems(value: any, key: string) {
  if (!Array.isArray(value)) return [];
  return value
    .map((relation) => relationId(relation?.[key] ?? relation))
    .filter((id) => id !== null)
    .map((id) => ({ [key]: id }));
}

function toDirectusPayload(snapshot: any) {
  return {
    id: String(snapshot.id),
    bia: relationId(snapshot.bia) || BIA_ID,
    tipo: snapshot.tipo,
    valor: String(snapshot.valor),
    data: snapshot.data || null,
    descricao: snapshot.descricao || null,
    membro_responsavel: relationId(snapshot.membro_responsavel),
    status: snapshot.status || null,
    data_vencimento: snapshot.data_vencimento || null,
    data_pagamento: snapshot.data_pagamento || null,
    multa: snapshot.multa ?? null,
    juros: snapshot.juros ?? null,
    responsavel_multa_juros: relationId(snapshot.responsavel_multa_juros),
    favorecido_id: relationId(snapshot.favorecido_id),
    pagamento_provider: snapshot.pagamento_provider || null,
    pagamento_id: snapshot.pagamento_id || null,
    pagamento_url: snapshot.pagamento_url || null,
    pagamento_status: snapshot.pagamento_status || null,
    pagamento_pais: snapshot.pagamento_pais || null,
    pagamento_pagador_nome: snapshot.pagamento_pagador_nome || null,
    pagamento_pagador_email: snapshot.pagamento_pagador_email || null,
    pagamento_pagador_documento: snapshot.pagamento_pagador_documento || null,
    pagamento_gerado_em: snapshot.pagamento_gerado_em || null,
    Categoria: relationItems(snapshot.Categoria, "categorias_id"),
    tipo_de_cpp: relationItems(snapshot.tipo_de_cpp, "tipos_cpp_id"),
    Anexos: relationItems(snapshot.Anexos, "directus_files_id"),
  };
}

function money(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizedStatus(item: any) {
  return String(item.status || item.pagamento_status || "").trim().toLowerCase();
}

function isPaid(item: any) {
  return ["pago", "paga", "confirmado", "confirmada", "concluido", "concluida", "recebido", "recebida"]
    .includes(normalizedStatus(item));
}

async function directusRequest(endpoint: string, init: RequestInit = {}) {
  const response = await fetch(`${process.env.DIRECTUS_URL}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Directus ${response.status}: ${await response.text()}`);
  if (response.status === 204) return true;
  const text = await response.text();
  return text ? JSON.parse(text).data : true;
}

async function fetchCurrentOriginEntries() {
  const query = new URLSearchParams({
    limit: "-1",
    fields: "*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*",
    "filter[bia][_eq]": BIA_ID,
    "filter[descricao][_contains]": "Valor de Origem da BIA",
  });
  return (await directusRequest(`/items/fluxo_caixa?${query}`)) || [];
}

function assertAggregateIsSafeToRemove(item: any) {
  if (!item) return;
  const valid = String(relationId(item.bia)) === BIA_ID
    && item.descricao === "Valor de Origem da BIA"
    && money(item.valor) === EXPECTED_TOTAL
    && normalizedStatus(item) === "pendente"
    && !item.data_pagamento
    && !item.pagamento_id
    && !item.pagamento_url;
  if (!valid) {
    throw new Error("O lancamento agregado foi alterado depois do incidente. Reparacao interrompida para evitar perda de dados.");
  }
}

async function recordRepairAudit(client: Client, id: string, action: string, before: any, after: any) {
  await client.query(`
    INSERT INTO fluxo_caixa_historico (
      fluxo_caixa_id, bia_id, acao, origem, dados_antes, dados_depois, payload
    )
    SELECT $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM fluxo_caixa_historico
      WHERE fluxo_caixa_id = $1 AND acao = $3 AND origem = $4
    )
  `, [
    id,
    BIA_ID,
    action,
    REPAIR_ID,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    JSON.stringify({ repairId: REPAIR_ID, snapshotFrom: SNAPSHOT_FROM, snapshotTo: SNAPSHOT_TO }),
  ]);
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL || !process.env.DIRECTUS_URL || !process.env.DIRECTUS_TOKEN) {
    throw new Error("DATABASE_URL, DIRECTUS_URL e DIRECTUS_TOKEN sao obrigatorios.");
  }

  const apply = process.argv.includes("--apply");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT ON (fluxo_caixa_id) fluxo_caixa_id, dados_antes
      FROM fluxo_caixa_historico
      WHERE bia_id = $1
        AND acao = 'excluido_por_sync'
        AND criado_em >= $2::timestamp
        AND criado_em < $3::timestamp
        AND dados_antes->>'descricao' ILIKE 'Valor de Origem da BIA - Parcela%'
      ORDER BY fluxo_caixa_id, criado_em DESC
    `, [BIA_ID, SNAPSHOT_FROM, SNAPSHOT_TO]);
    const snapshots = result.rows.map((row) => row.dados_antes);
    const total = money(snapshots.reduce((sum, item) => sum + Number(item.valor || 0), 0));
    const paid = snapshots.filter(isPaid);
    const paidTotal = money(paid.reduce((sum, item) => sum + Number(item.valor || 0), 0));
    if (snapshots.length !== EXPECTED_INSTALLMENTS || total !== EXPECTED_TOTAL
      || paid.length !== EXPECTED_PAID_COUNT || paidTotal !== EXPECTED_PAID_TOTAL) {
      throw new Error(`Snapshot inesperado: ${snapshots.length} parcelas, total ${total}, ${paid.length} pagas, total pago ${paidTotal}.`);
    }

    const current = await fetchCurrentOriginEntries();
    const currentById = new Map(current.map((item: any) => [String(item.id), item]));
    const aggregate = currentById.get(INVALID_AGGREGATE_ID) || null;
    assertAggregateIsSafeToRemove(aggregate);

    const missing: any[] = [];
    for (const snapshot of snapshots) {
      const expected = toDirectusPayload(snapshot);
      const existing = currentById.get(String(snapshot.id));
      if (!existing) {
        missing.push(expected);
        continue;
      }
      const normalizedExisting = toDirectusPayload(existing);
      if (JSON.stringify(normalizedExisting) !== JSON.stringify(expected)) {
        throw new Error(`A parcela ${snapshot.id} existe com dados diferentes. Reparacao interrompida.`);
      }
    }

    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      biaId: BIA_ID,
      installmentsInSnapshot: snapshots.length,
      installmentsToRestore: missing.length,
      total,
      paidInstallments: paid.length,
      paidTotal,
      invalidAggregatePresent: Boolean(aggregate),
    }, null, 2));
    if (!apply) return;

    if (missing.length > 0) {
      await directusRequest("/items/fluxo_caixa", {
        method: "POST",
        body: JSON.stringify(missing),
      });
    }

    const restored = await fetchCurrentOriginEntries();
    const restoredById = new Map(restored.map((item: any) => [String(item.id), item]));
    for (const snapshot of snapshots) {
      if (!restoredById.has(String(snapshot.id))) {
        throw new Error(`A parcela ${snapshot.id} nao foi restaurada. O agregado foi preservado.`);
      }
    }

    if (aggregate) {
      await directusRequest(`/items/fluxo_caixa/${INVALID_AGGREGATE_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ Categoria: [], tipo_de_cpp: [], Anexos: [], favorecido_id: null }),
      });
      await directusRequest(`/items/fluxo_caixa/${INVALID_AGGREGATE_ID}`, { method: "DELETE" });
    }

    for (const snapshot of snapshots) {
      await recordRepairAudit(client, String(snapshot.id), "restaurado_por_reparo", null, snapshot);
    }
    if (aggregate) {
      await recordRepairAudit(client, INVALID_AGGREGATE_ID, "excluido_por_reparo", aggregate, null);
    }

    const verified = await fetchCurrentOriginEntries();
    const verifiedInstallments = verified.filter((item: any) => /Parcela \d+\/85/.test(String(item.descricao || "")));
    const verifiedPaid = verifiedInstallments.filter(isPaid);
    const verifiedTotal = money(verifiedInstallments.reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0));
    const verifiedPaidTotal = money(verifiedPaid.reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0));
    if (verifiedInstallments.length !== EXPECTED_INSTALLMENTS || verifiedTotal !== EXPECTED_TOTAL
      || verifiedPaid.length !== EXPECTED_PAID_COUNT || verifiedPaidTotal !== EXPECTED_PAID_TOTAL) {
      throw new Error("A verificacao final da restauracao nao corresponde ao snapshot esperado.");
    }
    if (verified.some((item: any) => String(item.id) === INVALID_AGGREGATE_ID)) {
      throw new Error("O lancamento agregado incorreto ainda existe apos a restauracao.");
    }

    console.log(JSON.stringify({
      success: true,
      restoredInstallments: verifiedInstallments.length,
      restoredTotal: verifiedTotal,
      restoredPaidInstallments: verifiedPaid.length,
      restoredPaidTotal: verifiedPaidTotal,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
