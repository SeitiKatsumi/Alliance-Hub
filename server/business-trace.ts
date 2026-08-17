import { sql } from "drizzle-orm";
import { db } from "./db";
import { createBusinessTraceCode, traceObjectTypeForRegistry, traceStageLabel } from "./business-trace-domain";

export { createBusinessTraceCode, traceObjectTypeForRegistry, traceStageLabel } from "./business-trace-domain";

export type TraceActor = {
  userId?: string | null;
  memberId?: string | null;
};

export type TraceRegistry = {
  id?: any;
  source_type?: any;
  source_id?: any;
  codigo?: any;
  tipo?: any;
  titulo?: any;
  status?: string | null;
  bia_id?: string | null;
  criado_em?: string | Date | null;
};

function registryValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

async function applyBusinessTraceTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_journeys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo text NOT NULL UNIQUE,
      titulo text,
      root_type text NOT NULL,
      root_id text NOT NULL,
      root_registry_id uuid REFERENCES opportunity_registry(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'ativa',
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL,
      UNIQUE (root_type, root_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_nodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      journey_id uuid NOT NULL REFERENCES business_trace_journeys(id) ON DELETE CASCADE,
      registry_id uuid REFERENCES opportunity_registry(id) ON DELETE SET NULL,
      object_type text NOT NULL,
      object_id text NOT NULL,
      object_code text,
      titulo text,
      status text,
      papel text NOT NULL DEFAULT 'etapa',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL,
      UNIQUE (journey_id, object_type, object_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_business_trace_nodes_object ON business_trace_nodes (object_type, object_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_business_trace_nodes_registry ON business_trace_nodes (registry_id)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      journey_id uuid NOT NULL REFERENCES business_trace_journeys(id) ON DELETE CASCADE,
      source_node_id uuid REFERENCES business_trace_nodes(id) ON DELETE SET NULL,
      destination_node_id uuid NOT NULL REFERENCES business_trace_nodes(id) ON DELETE CASCADE,
      relation_type text NOT NULL,
      justificativa text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_business_trace_links_unique
    ON business_trace_links (journey_id, COALESCE(source_node_id, '00000000-0000-0000-0000-000000000000'::uuid), destination_node_id, relation_type)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      journey_id uuid NOT NULL REFERENCES business_trace_journeys(id) ON DELETE CASCADE,
      node_id uuid REFERENCES business_trace_nodes(id) ON DELETE SET NULL,
      source_event_id uuid,
      event_type text NOT NULL,
      titulo text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE business_trace_events ADD COLUMN IF NOT EXISTS source_event_id uuid`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_business_trace_events_source
    ON business_trace_events (source_event_id, journey_id) WHERE source_event_id IS NOT NULL
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_business_trace_events_journey ON business_trace_events (journey_id, criado_em DESC)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      economic_key text NOT NULL UNIQUE,
      source_registry_id uuid REFERENCES opportunity_registry(id) ON DELETE SET NULL,
      resultado text NOT NULL,
      participante_user_id text,
      participante_membro_id text,
      valor numeric(16,2),
      moeda text,
      sem_valor_financeiro boolean NOT NULL DEFAULT false,
      contratado_em timestamp,
      concluido_em timestamp,
      observacoes text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_trace_result_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id uuid NOT NULL REFERENCES business_trace_results(id) ON DELETE CASCADE,
      journey_id uuid NOT NULL REFERENCES business_trace_journeys(id) ON DELETE CASCADE,
      node_id uuid REFERENCES business_trace_nodes(id) ON DELETE SET NULL,
      criado_em timestamp DEFAULT now() NOT NULL,
      UNIQUE (result_id, journey_id)
    )
  `);
}

let traceTablesPromise: Promise<void> | null = null;
export async function ensureBusinessTraceTables() {
  if (!traceTablesPromise) {
    traceTablesPromise = applyBusinessTraceTables().catch((error) => {
      traceTablesPromise = null;
      throw error;
    });
  }
  return traceTablesPromise;
}

async function uniqueTraceCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = createBusinessTraceCode();
    const existing = await db.execute(sql`SELECT 1 FROM business_trace_journeys WHERE codigo = ${code} LIMIT 1`);
    if (!existing.rows?.[0]) return code;
  }
  throw new Error("Não foi possível gerar um código de rastreio único.");
}

async function insertNode(
  journeyId: string,
  object: {
    registryId?: string | null;
    type: string;
    id: string;
    code?: string | null;
    title?: string | null;
    status?: string | null;
    role?: string;
    metadata?: Record<string, unknown>;
  },
  actor: TraceActor = {},
) {
  const inserted = await db.execute(sql`
    INSERT INTO business_trace_nodes (
      journey_id, registry_id, object_type, object_id, object_code, titulo, status,
      papel, metadata, criado_por_user_id, criado_por_membro_id
    ) VALUES (
      ${journeyId}, ${object.registryId || null}, ${object.type}, ${object.id}, ${object.code || null},
      ${object.title || null}, ${object.status || null}, ${object.role || "etapa"},
      ${JSON.stringify(object.metadata || {})}::jsonb, ${actor.userId || null}, ${actor.memberId || null}
    ) ON CONFLICT (journey_id, object_type, object_id) DO UPDATE SET
      registry_id = COALESCE(EXCLUDED.registry_id, business_trace_nodes.registry_id),
      object_code = COALESCE(EXCLUDED.object_code, business_trace_nodes.object_code),
      titulo = COALESCE(EXCLUDED.titulo, business_trace_nodes.titulo),
      status = COALESCE(EXCLUDED.status, business_trace_nodes.status),
      metadata = business_trace_nodes.metadata || EXCLUDED.metadata,
      atualizado_em = now()
    RETURNING *
  `);
  return inserted.rows?.[0] as any;
}

async function insertLink(
  journeyId: string,
  sourceNodeId: string | null,
  destinationNodeId: string,
  relationType: string,
  actor: TraceActor = {},
  justification?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await db.execute(sql`
    INSERT INTO business_trace_links (
      journey_id, source_node_id, destination_node_id, relation_type, justificativa,
      metadata, criado_por_user_id, criado_por_membro_id
    ) VALUES (
      ${journeyId}, ${sourceNodeId}, ${destinationNodeId}, ${relationType}, ${justification || null},
      ${JSON.stringify(metadata)}::jsonb, ${actor.userId || null}, ${actor.memberId || null}
    ) ON CONFLICT DO NOTHING
  `);
}

export async function getOrCreateTraceForRegistry(registry: TraceRegistry, actor: TraceActor = {}) {
  await ensureBusinessTraceTables();
  const existing = await db.execute(sql`
    SELECT journey.* FROM business_trace_journeys journey
    JOIN business_trace_nodes node ON node.journey_id = journey.id
    WHERE node.registry_id = ${registryValue(registry.id)}
    ORDER BY journey.criado_em ASC LIMIT 1
  `);
  if (existing.rows?.[0]) return existing.rows[0] as any;

  const incoming = await db.execute(sql`
    SELECT relation.tipo AS relation_type, source.*
    FROM opportunity_relations relation
    JOIN opportunity_registry source ON source.id = relation.origem_registry_id
    WHERE relation.destino_registry_id = ${registryValue(registry.id)}
    ORDER BY relation.criado_em ASC
  `);
  if (incoming.rows?.length) {
    for (const source of incoming.rows as any[]) {
      await inheritTraceBetweenRegistries(source, registry, String(source.relation_type), actor);
    }
    const inherited = await journeysForRegistry(registryValue(registry.id));
    if (inherited[0]) return inherited[0];
  }

  if (registryValue(registry.tipo) === "oportunidade") {
    const source = (await db.execute(sql`
      SELECT source_registry.*
      FROM economic_opportunity_sources source
      JOIN opportunity_registry source_registry
        ON source_registry.source_type = 'demanda' AND source_registry.source_id = source.source_id
      WHERE source.economic_opportunity_id::text = ${registryValue(registry.source_id)}
        AND source.source_type = 'demanda'
      ORDER BY source.criado_em ASC LIMIT 1
    `)).rows?.[0] as any;
    if (source) {
      await inheritTraceBetweenRegistries(source, registry, "demanda_gerou_oportunidade", actor);
      const inherited = await journeysForRegistry(registryValue(registry.id));
      if (inherited[0]) return inherited[0];
    }
  }

  if (registry.bia_id && ["demanda", "oba"].includes(registryValue(registry.tipo))) {
    await attachRegistryToObjectTraces(
      { type: "bia", id: String(registry.bia_id), code: String(registry.bia_id), title: "BIA" },
      registry,
      `bia_gerou_${registryValue(registry.tipo)}`,
      actor,
    );
    const inherited = await journeysForRegistry(registryValue(registry.id));
    if (inherited[0]) return inherited[0];
  }

  const code = await uniqueTraceCode();
  const created = await db.execute(sql`
    INSERT INTO business_trace_journeys (
      codigo, titulo, root_type, root_id, root_registry_id, criado_por_user_id, criado_por_membro_id
    ) VALUES (
      ${code}, ${registryValue(registry.titulo)}, ${traceObjectTypeForRegistry(registry)}, ${registryValue(registry.source_id)}, ${registryValue(registry.id)},
      ${actor.userId || null}, ${actor.memberId || null}
    ) ON CONFLICT (root_type, root_id) DO UPDATE SET atualizado_em = now()
    RETURNING *
  `);
  const journey = created.rows?.[0] as any;
  await insertNode(journey.id, {
    registryId: registryValue(registry.id),
    type: traceObjectTypeForRegistry(registry),
    id: registryValue(registry.source_id),
    code: registryValue(registry.codigo),
    title: registryValue(registry.titulo),
    status: registry.status,
    role: "origem",
  }, actor);
  return journey;
}

export async function getOrCreateTraceForObject(
  object: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null },
  actor: TraceActor = {},
) {
  await ensureBusinessTraceTables();
  const current = await db.execute(sql`
    SELECT journey.* FROM business_trace_journeys journey
    WHERE journey.root_type = ${object.type} AND journey.root_id = ${object.id}
    LIMIT 1
  `);
  if (current.rows?.[0]) return current.rows[0] as any;
  const code = await uniqueTraceCode();
  const result = await db.execute(sql`
    INSERT INTO business_trace_journeys (
      codigo, titulo, root_type, root_id, criado_por_user_id, criado_por_membro_id
    ) VALUES (${code}, ${object.title || null}, ${object.type}, ${object.id}, ${actor.userId || null}, ${actor.memberId || null})
    ON CONFLICT (root_type, root_id) DO UPDATE SET atualizado_em = now()
    RETURNING *
  `);
  const journey = result.rows?.[0] as any;
  await insertNode(journey.id, { ...object, role: "origem" }, actor);
  return journey;
}

async function journeysForRegistry(registryId: string) {
  const result = await db.execute(sql`
    SELECT journey.*, node.id AS source_node_id
    FROM business_trace_journeys journey
    JOIN business_trace_nodes node ON node.journey_id = journey.id
    WHERE node.registry_id = ${registryId}
    ORDER BY journey.criado_em ASC
  `);
  return result.rows as any[];
}

export async function inheritTraceBetweenRegistries(
  source: TraceRegistry,
  destination: TraceRegistry,
  relationType: string,
  actor: TraceActor = {},
  justification?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await ensureBusinessTraceTables();
  let journeys = await journeysForRegistry(source.id);
  if (!journeys.length) {
    await getOrCreateTraceForRegistry(source, actor);
    journeys = await journeysForRegistry(source.id);
  }
  for (const journey of journeys) {
    let sourceNodeId = String(journey.source_node_id);
    if (destination.bia_id && ["demanda", "oba"].includes(String(destination.tipo))) {
      const biaNode = await insertNode(journey.id, {
        type: "bia",
        id: String(destination.bia_id),
        code: String(destination.bia_id),
        title: "BIA",
      }, actor);
      await insertLink(journey.id, sourceNodeId, biaNode.id, "vinculada_a_bia", actor, justification, { bia_id: destination.bia_id });
      sourceNodeId = String(biaNode.id);
    }
    const destinationNode = await insertNode(journey.id, {
      registryId: destination.id,
      type: traceObjectTypeForRegistry(destination),
      id: destination.source_id,
      code: destination.codigo,
      title: destination.titulo,
      status: destination.status,
    }, actor);
    await insertLink(journey.id, sourceNodeId, destinationNode.id, relationType, actor, justification, metadata);
  }
  return journeys;
}

export async function attachObjectToRegistryTraces(
  registry: TraceRegistry,
  object: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null; metadata?: Record<string, unknown> },
  relationType: string,
  actor: TraceActor = {},
  justification?: string | null,
) {
  await ensureBusinessTraceTables();
  let journeys = await journeysForRegistry(registry.id);
  if (!journeys.length) {
    await getOrCreateTraceForRegistry(registry, actor);
    journeys = await journeysForRegistry(registry.id);
  }
  for (const journey of journeys) {
    const node = await insertNode(journey.id, object, actor);
    await insertLink(journey.id, journey.source_node_id, node.id, relationType, actor, justification, object.metadata || {});
  }
  return journeys;
}

export async function attachOriginObjectToRegistryTraces(
  registry: TraceRegistry,
  object: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null; metadata?: Record<string, unknown> },
  relationType: string,
  actor: TraceActor = {},
) {
  await ensureBusinessTraceTables();
  let journeys = await journeysForRegistry(registry.id);
  if (!journeys.length) {
    await getOrCreateTraceForRegistry(registry, actor);
    journeys = await journeysForRegistry(registry.id);
  }
  for (const journey of journeys) {
    const registryNode = (await db.execute(sql`
      SELECT * FROM business_trace_nodes
      WHERE journey_id = ${journey.id} AND registry_id = ${registry.id}
      LIMIT 1
    `)).rows?.[0] as any;
    const currentOrigins = (await db.execute(sql`
      SELECT id, registry_id FROM business_trace_nodes
      WHERE journey_id = ${journey.id} AND papel = 'origem'
    `)).rows as any[];
    const shouldBecomeOrigin = currentOrigins.length === 0
      || (currentOrigins.length === 1 && String(currentOrigins[0].registry_id || "") === String(registry.id));
    const originNode = await insertNode(journey.id, {
      ...object,
      role: shouldBecomeOrigin ? "origem" : "fonte",
    }, actor);
    await db.execute(sql`
      UPDATE business_trace_nodes
      SET papel = ${shouldBecomeOrigin ? "origem" : "fonte"}, atualizado_em = now()
      WHERE id = ${originNode.id}
    `);
    if (registryNode) {
      if (shouldBecomeOrigin) {
        await db.execute(sql`UPDATE business_trace_nodes SET papel = 'etapa', atualizado_em = now() WHERE id = ${registryNode.id}`);
      }
      await insertLink(journey.id, originNode.id, registryNode.id, relationType, actor, null, object.metadata || {});
    }
  }
  return journeys;
}

export async function attachRegistryToObjectTraces(
  object: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null },
  registry: TraceRegistry,
  relationType: string,
  actor: TraceActor = {},
) {
  await ensureBusinessTraceTables();
  let objectNodes = (await db.execute(sql`
    SELECT journey.*, node.id AS source_node_id
    FROM business_trace_journeys journey
    JOIN business_trace_nodes node ON node.journey_id = journey.id
    WHERE node.object_type = ${object.type} AND node.object_id = ${object.id}
    ORDER BY journey.criado_em ASC
  `)).rows as any[];
  if (!objectNodes.length) {
    await getOrCreateTraceForObject(object, actor);
    objectNodes = (await db.execute(sql`
      SELECT journey.*, node.id AS source_node_id
      FROM business_trace_journeys journey
      JOIN business_trace_nodes node ON node.journey_id = journey.id
      WHERE node.object_type = ${object.type} AND node.object_id = ${object.id}
    `)).rows as any[];
  }
  for (const journey of objectNodes) {
    const node = await insertNode(journey.id, {
      registryId: registry.id,
      type: traceObjectTypeForRegistry(registry),
      id: registry.source_id,
      code: registry.codigo,
      title: registry.titulo,
      status: registry.status,
    }, actor);
    await insertLink(journey.id, journey.source_node_id, node.id, relationType, actor);
  }
  return objectNodes;
}

export async function attachObjectToObjectTraces(
  source: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null },
  destination: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null; metadata?: Record<string, unknown> },
  relationType: string,
  actor: TraceActor = {},
  justification?: string | null,
) {
  await ensureBusinessTraceTables();
  let sourceNodes = (await db.execute(sql`
    SELECT journey.*, node.id AS source_node_id
    FROM business_trace_journeys journey
    JOIN business_trace_nodes node ON node.journey_id = journey.id
    WHERE node.object_type = ${source.type} AND node.object_id = ${source.id}
    ORDER BY journey.criado_em ASC
  `)).rows as any[];
  if (!sourceNodes.length) {
    await getOrCreateTraceForObject(source, actor);
    sourceNodes = (await db.execute(sql`
      SELECT journey.*, node.id AS source_node_id
      FROM business_trace_journeys journey
      JOIN business_trace_nodes node ON node.journey_id = journey.id
      WHERE node.object_type = ${source.type} AND node.object_id = ${source.id}
      ORDER BY journey.criado_em ASC
    `)).rows as any[];
  }
  for (const journey of sourceNodes) {
    const destinationNode = await insertNode(journey.id, destination, actor);
    await insertLink(
      journey.id,
      String(journey.source_node_id),
      destinationNode.id,
      relationType,
      actor,
      justification,
      destination.metadata || {},
    );
  }
  return sourceNodes;
}

export async function recordTraceEventForRegistry(
  registryId: string,
  eventType: string,
  title: string,
  payload: Record<string, unknown> = {},
  actor: TraceActor = {},
  sourceEventId?: string | null,
) {
  await ensureBusinessTraceTables();
  await db.execute(sql`
    INSERT INTO business_trace_events (
      journey_id, node_id, source_event_id, event_type, titulo, payload, criado_por_user_id, criado_por_membro_id
    )
    SELECT node.journey_id, node.id, ${sourceEventId || null}, ${eventType}, ${title}, ${JSON.stringify(payload)}::jsonb,
      ${actor.userId || null}, ${actor.memberId || null}
    FROM business_trace_nodes node
    WHERE node.registry_id = ${registryId}
    ON CONFLICT DO NOTHING
  `);
}

export async function recordTraceEventForObject(
  object: { type: string; id: string; code?: string | null; title?: string | null; status?: string | null },
  eventType: string,
  title: string,
  payload: Record<string, unknown> = {},
  actor: TraceActor = {},
) {
  await ensureBusinessTraceTables();
  const existing = await db.execute(sql`
    SELECT node.journey_id, node.id AS node_id
    FROM business_trace_nodes node
    WHERE node.object_type = ${object.type} AND node.object_id = ${object.id}
  `);
  if (!existing.rows?.length) await getOrCreateTraceForObject(object, actor);
  await db.execute(sql`
    INSERT INTO business_trace_events (
      journey_id, node_id, event_type, titulo, payload, criado_por_user_id, criado_por_membro_id
    )
    SELECT node.journey_id, node.id, ${eventType}, ${title}, ${JSON.stringify(payload)}::jsonb,
      ${actor.userId || null}, ${actor.memberId || null}
    FROM business_trace_nodes node
    WHERE node.object_type = ${object.type} AND node.object_id = ${object.id}
  `);
}

export async function syncTraceResultForRegistry(registryId: string) {
  await ensureBusinessTraceTables();
  const outcome = (await db.execute(sql`
    SELECT * FROM opportunity_outcomes WHERE registry_id = ${registryId} LIMIT 1
  `)).rows?.[0] as any;
  if (!outcome) return null;
  const result = (await db.execute(sql`
    INSERT INTO business_trace_results (
      economic_key, source_registry_id, resultado, participante_user_id, participante_membro_id,
      valor, moeda, sem_valor_financeiro, contratado_em, concluido_em, observacoes,
      criado_em, atualizado_em
    ) VALUES (
      ${`opportunity_outcome:${outcome.id}`}, ${registryId}, ${outcome.resultado},
      ${outcome.participante_user_id || null}, ${outcome.participante_membro_id || null},
      ${outcome.valor ?? null}, ${outcome.moeda || null}, ${Boolean(outcome.sem_valor_financeiro)},
      ${outcome.contratado_em || null}, ${outcome.concluido_em || null}, ${outcome.observacoes || null},
      ${outcome.criado_em || new Date()}, ${outcome.atualizado_em || new Date()}
    ) ON CONFLICT (economic_key) DO UPDATE SET
      resultado = EXCLUDED.resultado, participante_user_id = EXCLUDED.participante_user_id,
      participante_membro_id = EXCLUDED.participante_membro_id, valor = EXCLUDED.valor,
      moeda = EXCLUDED.moeda, sem_valor_financeiro = EXCLUDED.sem_valor_financeiro,
      contratado_em = EXCLUDED.contratado_em, concluido_em = EXCLUDED.concluido_em,
      observacoes = EXCLUDED.observacoes, atualizado_em = EXCLUDED.atualizado_em
    RETURNING *
  `)).rows?.[0] as any;
  await db.execute(sql`
    INSERT INTO business_trace_result_links (result_id, journey_id, node_id)
    SELECT ${result.id}, node.journey_id, node.id
    FROM business_trace_nodes node WHERE node.registry_id = ${registryId}
    ON CONFLICT (result_id, journey_id) DO NOTHING
  `);
  return result;
}

let backfillPromise: Promise<void> | null = null;
let backfillCompleted = false;
export async function backfillBusinessTraces(force = false) {
  if (backfillCompleted && !force) return;
  if (backfillPromise && !force) return backfillPromise;
  backfillPromise = (async () => {
    await ensureBusinessTraceTables();
    const [registryResult, relationResult] = await Promise.all([
      db.execute(sql`SELECT * FROM opportunity_registry ORDER BY criado_em ASC`),
      db.execute(sql`SELECT * FROM opportunity_relations ORDER BY criado_em ASC`),
    ]);
    const registries = (registryResult.rows || []) as any[];
    const registryById = new Map(registries.map((item) => [String(item.id), item]));
    const incoming = new Set((relationResult.rows || []).map((item: any) => String(item.destino_registry_id)));

    for (const registry of registries) {
      const isBiaChild = Boolean(registry.bia_id && ["demanda", "oba"].includes(String(registry.tipo)));
      if (!incoming.has(String(registry.id)) && !isBiaChild) await getOrCreateTraceForRegistry(registry);
    }
    for (const relation of relationResult.rows || []) {
      const source = registryById.get(String((relation as any).origem_registry_id));
      const destination = registryById.get(String((relation as any).destino_registry_id));
      if (source && destination) {
        await inheritTraceBetweenRegistries(source, destination, String((relation as any).tipo), {}, null, (relation as any).metadata || {});
      }
    }

    const economicBias = await db.execute(sql`
      SELECT r.*, economic.bia_id AS economic_bia_id
      FROM opportunity_registry r
      JOIN economic_opportunities economic ON economic.id::text = r.source_id
      WHERE r.tipo = 'oportunidade' AND economic.bia_id IS NOT NULL
    `);
    for (const registry of economicBias.rows || []) {
      await attachObjectToRegistryTraces(registry as any, {
        type: "bia", id: String((registry as any).economic_bia_id), code: String((registry as any).economic_bia_id),
        title: "BIA estruturada", status: "em_formacao",
      }, "oportunidade_gerou_bia");
    }

    const assetBias = await db.execute(sql`
      SELECT id, bia_id, bia_nome, estagio, data
      FROM land_bank_assets
      WHERE bia_id IS NOT NULL
      ORDER BY created_at ASC
    `);
    for (const asset of assetBias.rows || []) {
      const data = (asset as any).data && typeof (asset as any).data === "object" ? (asset as any).data : {};
      await attachObjectToObjectTraces({
        type: "land_bank_asset",
        id: String((asset as any).id),
        code: String((asset as any).id),
        title: data.qualificacao || "Ativo do Banco de Ativos",
      }, {
        type: "bia",
        id: String((asset as any).bia_id),
        code: String((asset as any).bia_id),
        title: String((asset as any).bia_nome || "BIA estruturada"),
        status: "em_formacao",
      }, "ativo_gerou_bia");
    }

    const demandAssets = await db.execute(sql`
      SELECT id, demanda_origem_id, data
      FROM land_bank_assets
      WHERE demanda_origem_id IS NOT NULL
      ORDER BY created_at ASC
    `);
    for (const asset of demandAssets.rows || []) {
      const demandRegistry = registries.find((item) => item.source_type === "carteira_demanda" && String(item.source_id) === String((asset as any).demanda_origem_id));
      if (!demandRegistry) continue;
      const data = (asset as any).data && typeof (asset as any).data === "object" ? (asset as any).data : {};
      await getOrCreateTraceForRegistry(demandRegistry);
      await attachObjectToObjectTraces({
        type: "demanda",
        id: String(demandRegistry.source_id),
        code: demandRegistry.codigo,
        title: demandRegistry.titulo,
      }, {
        type: "land_bank_asset",
        id: String((asset as any).id),
        code: String((asset as any).id),
        title: data.qualificacao || "Ativo do Banco de Ativos",
      }, "demanda_gerou_ativo");
    }

    const biaChildren = registries.filter((item) => item.bia_id && ["demanda", "oba"].includes(String(item.tipo)));
    for (const child of biaChildren) {
      await attachRegistryToObjectTraces({ type: "bia", id: String(child.bia_id), code: String(child.bia_id), title: "BIA" }, child, `bia_gerou_${child.tipo}`);
    }

    for (const registry of registries) {
      if (!(await journeysForRegistry(String(registry.id))).length) await getOrCreateTraceForRegistry(registry);
    }

    const economicSources = await db.execute(sql`
      SELECT source.*, registry.id AS registry_id
      FROM economic_opportunity_sources source
      JOIN opportunity_registry registry
        ON registry.source_type = 'economic_opportunity'
       AND registry.source_id = source.economic_opportunity_id::text
      WHERE source.source_type <> 'demanda'
      ORDER BY source.criado_em ASC
    `);
    for (const source of economicSources.rows || []) {
      const registry = registryById.get(String((source as any).registry_id));
      if (!registry) continue;
      const labels: Record<string, string> = {
        land_bank_asset: "Ativo do Banco de Ativos",
        oportunidade_externa: "Oportunidade externa",
        imovel: "Imóvel da Carteira",
        servico: "Prestação de serviço",
      };
      await attachOriginObjectToRegistryTraces(registry, {
        type: String((source as any).source_type),
        id: String((source as any).source_id),
        code: String((source as any).source_id),
        title: labels[String((source as any).source_type)] || "Origem",
        metadata: (source as any).metadata || {},
      }, `${String((source as any).source_type)}_gerou_oportunidade`);
    }

    const meetingItems = await db.execute(sql`
      SELECT meeting.id, meeting.codigo, meeting.titulo, meeting.status, item.registry_id
      FROM opportunity_meeting_items item
      JOIN opportunity_meetings meeting ON meeting.id = item.meeting_id
      ORDER BY meeting.criado_em ASC
    `);
    for (const item of meetingItems.rows || []) {
      const registry = registryById.get(String((item as any).registry_id));
      if (registry) await attachObjectToRegistryTraces(registry, {
        type: "ro", id: String((item as any).id), code: String((item as any).codigo),
        title: String((item as any).titulo), status: String((item as any).status),
      }, "discutida_em_ro");
    }

    const outcomes = await db.execute(sql`SELECT registry_id FROM opportunity_outcomes`);
    for (const item of outcomes.rows || []) await syncTraceResultForRegistry(String((item as any).registry_id));

    await db.execute(sql`
      INSERT INTO business_trace_events (
        journey_id, node_id, source_event_id, event_type, titulo, payload,
        criado_por_user_id, criado_por_membro_id, criado_em
      )
      SELECT node.journey_id, node.id, event.id, event.tipo,
        COALESCE(event.titulo, event.tipo), event.payload,
        event.criado_por_user_id, event.criado_por_membro_id, event.criado_em
      FROM opportunity_events event
      JOIN business_trace_nodes node ON node.registry_id = event.registry_id
      ON CONFLICT DO NOTHING
    `);
  })()
    .then(() => { backfillCompleted = true; })
    .finally(() => { backfillPromise = null; });
  return backfillPromise;
}
