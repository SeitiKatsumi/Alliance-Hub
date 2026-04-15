import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createUserSchema, updateUserSchema, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS, nucleoTecnicoDocs, aliancaDocs } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import express from "express";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

// Cache of fields that Directus rejects with VALUE_OUT_OF_RANGE — discovered at runtime
const biasBlockedFields = new Set<string>();

// Resolved at startup: actual collection name for comunidade (default is "Comunidade" — confirmed always correct)
let COMUNIDADE_COL = "Comunidade";
// Promise that resolves once ensureComunidadeFields() has discovered the real collection name
let comunidadeColResolve: (() => void) | null = null;
const comunidadeColReady: Promise<void> = new Promise(res => { comunidadeColResolve = res; });
async function getComunidadeCol(): Promise<string> {
  await comunidadeColReady;
  return COMUNIDADE_COL;
}

async function ensureBiasExtraFields() {
  const fields = [
    {
      field: "situacao",
      type: "string",
      meta: { interface: "select-dropdown", display: "raw", hidden: false, options: { choices: [{ text: "Ativa", value: "ativa" }, { text: "Em Formação", value: "em_formacao" }] } },
      schema: { is_nullable: true, default_value: "ativa" },
    },
    {
      field: "destinacao",
      type: "string",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "diretor_nucleo_tecnico",
      type: "string",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "selo_certified_alliance",
      type: "boolean",
      meta: { interface: "boolean", display: "boolean", hidden: false },
      schema: { is_nullable: true, default_value: false },
    },
    {
      field: "comissao_realizada",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "ir_realizado",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "inss_realizado",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "manutencao_realizada",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "perc_dir_alianca",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "cpp_dir_alianca",
      type: "float",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "moeda",
      type: "string",
      meta: { interface: "input", display: "raw", hidden: false, note: "Código ISO da moeda (ex: BRL, USD, EUR)" },
      schema: { is_nullable: true, default_value: "BRL" },
    },
  ];
  for (const fieldDef of fields) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/bias_projetos`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(fieldDef),
      });
      if (res.ok) {
        console.log(`[bia] Field ${fieldDef.field} created in bias_projetos`);
      }
    } catch (e) {
      // silently ignore
    }
  }
}

async function ensureNomeBiaLength() {
  try {
    // Step 1: Get current schema snapshot (with hash needed for apply)
    const snapshotRes = await fetch(`${DIRECTUS_URL}/schema/snapshot`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!snapshotRes.ok) {
      console.warn("[bia] schema snapshot failed:", snapshotRes.status);
      return;
    }
    const snapshot = await snapshotRes.json();
    const currentHash = snapshot?.data?.hash;
    const fields: any[] = snapshot?.data?.fields ?? [];

    const nomeBiaField = fields.find((f: any) => f.collection === "bias_projetos" && f.field === "nome_bia");
    const currentMaxLen = nomeBiaField?.schema?.max_length;
    if (currentMaxLen != null && currentMaxLen >= 500) {
      console.log("[bia] nome_bia varchar length OK, skipping");
      return;
    }
    console.log("[bia] nome_bia current schema:", JSON.stringify(nomeBiaField?.schema));

    // Force ALTER TABLE to varchar(500) — fix MySQL column that may be too short or wrongly typed as text
    const patchRes = await fetch(`${DIRECTUS_URL}/fields/bias_projetos/nome_bia`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "string",
        schema: { data_type: "varchar", max_length: 500, is_nullable: false },
      }),
    });
    const patchBody = await patchRes.json().catch(() => ({}));
    if (patchRes.ok) {
      console.log("[bia] nome_bia expanded to varchar(500), schema:", JSON.stringify(patchBody?.data?.schema));
    } else {
      console.warn("[bia] nome_bia PATCH failed:", patchRes.status, JSON.stringify(patchBody?.errors?.[0]?.message ?? patchBody));
    }
  } catch (e) {
    console.warn("[bia] ensureNomeBiaLength error:", e);
  }
}

async function clearBiasFieldValidations() {
  try {
    const res = await fetch(`${DIRECTUS_URL}/fields/bias_projetos`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!res.ok) { console.log("[bias-valid] Cannot fetch fields:", res.status); return; }
    const data = await res.json();
    const fields: any[] = data.data || [];
    const numericTypes = ["integer", "bigInteger", "float", "decimal", "string"];
    let cleared = 0;
    for (const f of fields) {
      const hasValidation = f.meta?.validation && Object.keys(f.meta.validation).length > 0;
      if (!hasValidation) continue;
      if (!numericTypes.includes(f.type)) continue;
      const pRes = await fetch(`${DIRECTUS_URL}/fields/bias_projetos/${f.field}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ meta: { validation: null, validation_message: null } }),
      });
      if (pRes.ok) { console.log(`[bias-valid] Cleared validation on field: ${f.field}`); cleared++; }
      else console.warn(`[bias-valid] Could not clear validation on ${f.field}:`, (await pRes.json().catch(() => ({}))).errors?.[0]?.message);
    }
    if (cleared === 0) console.log("[bias-valid] No field validations to clear");
  } catch (e) { console.warn("[bias-valid] Error:", e); }
}

async function ensureGeoFields(collection: string, tag: string) {
  const fields = [
    { field: "latitude", type: "float", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "longitude", type: "float", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "localizacao", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
  ];
  for (const fieldDef of fields) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(fieldDef),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.errors?.[0]?.extensions?.code;
        if (code !== "RECORD_NOT_UNIQUE" && code !== "FORBIDDEN") {
          console.warn(`[${tag}] Field ${fieldDef.field} response: ${res.status}`);
        }
      }
    } catch (e) {
      // silently ignore network errors
    }
  }
}

async function ensureBiasGeoFields() {
  await ensureGeoFields("bias_projetos", "geo-bias");
}

async function ensureVitrineFields() {
  const fields = [
    { field: "na_vitrine", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "em_membros_built", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "em_built_capital", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "link_site", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "latitude", type: "float", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "longitude", type: "float", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "logo_empresa", type: "uuid", meta: { interface: "file-image", display: "image", hidden: false, note: "Logo ou marca da empresa" }, schema: { is_nullable: true } },
    { field: "especialidade_livre", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Especialidade em texto livre" }, schema: { is_nullable: true } },
    { field: "idiomas", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "Idiomas falados" }, schema: { is_nullable: true } },
    { field: "nucleos_alianca", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "Múltiplos núcleos de aliança" }, schema: { is_nullable: true } },
    { field: "tipos_alianca", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "Múltiplos tipos de aliança" }, schema: { is_nullable: true } },
  ];
  for (const fieldDef of fields) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/cadastro_geral`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(fieldDef),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.errors?.[0]?.extensions?.code;
        if (code !== "RECORD_NOT_UNIQUE" && code !== "FORBIDDEN") {
          console.warn(`[vitrine-fields] Field ${fieldDef.field} response: ${res.status}`);
        }
      }
    } catch (e) {
      // silently ignore
    }
  }
}

async function geocodeMembrosCadastro(membros: any[]): Promise<void> {
  const toGeocode = membros.filter(m => !m.latitude && !m.longitude && m.cidade);
  for (const m of toGeocode.slice(0, 8)) {
    try {
      const query = [m.cidade, m.estado, m.pais || "Brasil"].filter(Boolean).join(", ");
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const r = await fetch(url, { headers: { "User-Agent": "BuiltAlliances/1.0 contact@builtalliances.com" } });
      const data = await r.json();
      if (data?.[0]) {
        await directusUpdate("cadastro_geral", m.id, {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
        m.latitude = parseFloat(data[0].lat);
        m.longitude = parseFloat(data[0].lon);
      }
    } catch { /* ignore errors */ }
    await new Promise(res => setTimeout(res, 250));
  }
}

async function directusFetch(collection: string, params: string = "") {
  const url = `${DIRECTUS_URL}/items/${collection}?limit=-1&fields=*${params ? "&" + params : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Directus error: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

async function directusFetchOne(collection: string, id: string, params: string = "") {
  const url = `${DIRECTUS_URL}/items/${collection}/${id}?fields=*${params ? "&" + params : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Directus error: ${res.status}`);
  const json = await res.json();
  return json.data || null;
}

async function directusCreate(collection: string, data: Record<string, any>) {
  const url = `${DIRECTUS_URL}/items/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus create error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data;
}

async function directusUpdate(collection: string, id: string, data: Record<string, any>) {
  const url = `${DIRECTUS_URL}/items/${collection}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus update error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data;
}

async function directusDelete(collection: string, id: string) {
  const url = `${DIRECTUS_URL}/items/${collection}/${id}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus delete error ${res.status}: ${text}`);
  }
  return true;
}

async function findOrCreateValorOrigemCategoria(): Promise<number> {
  const cats = await directusFetch("Categorias", "fields=id,Nome_da_categoria");
  const existing = cats.find((c: any) => c.Nome_da_categoria === "Valor de Origem");
  if (existing) return existing.id;
  const created = await directusCreate("Categorias", { Nome_da_categoria: "Valor de Origem" });
  return created.id;
}

async function syncValorOrigemLancamento(biaId: string, valorOrigem: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const descricaoMarca = "Valor de Origem da BIA";
  const params = `filter[bia][_eq]=${biaId}&filter[descricao][_eq]=${encodeURIComponent(descricaoMarca)}&fields=id,valor`;
  const existing = await directusFetch("fluxo_caixa", params);

  if (valorOrigem > 0) {
    const catId = await findOrCreateValorOrigemCategoria();
    if (existing.length > 0) {
      const existingValor = parseFloat(existing[0].valor) || 0;
      if (Math.abs(existingValor - valorOrigem) > 0.001) {
        await directusUpdate("fluxo_caixa", existing[0].id, { valor: String(valorOrigem) });
      }
    } else {
      await directusCreate("fluxo_caixa", {
        bia: biaId,
        tipo: "saida",
        valor: String(valorOrigem),
        data: today,
        descricao: descricaoMarca,
        data_vencimento: today,
        status: "pendente",
        Categoria: [{ categorias_id: catId }],
        tipo_de_cpp: [],
        Favorecido: [],
        Anexos: [],
      });
    }
  } else if (existing.length > 0) {
    await directusDelete("fluxo_caixa", existing[0].id);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif",
      ".doc", ".docx", ".xls", ".xlsx", ".heic", ".heif",
    ];
    const allowedMime = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${ext || file.mimetype}`));
    }
  },
});

async function grantCollectionPermissions(collection: string) {
  try {
    const refRes = await fetch(`${DIRECTUS_URL}/permissions?filter[collection][_eq]=bias_projetos&limit=10`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!refRes.ok) { console.log(`[perms] Cannot read reference permissions (${refRes.status})`); return; }
    const refData = await refRes.json();
    const refPerms: any[] = refData.data || [];
    if (refPerms.length === 0) { console.log("[perms] No reference permissions found"); return; }

    const actions = ["read", "create", "update", "delete"];
    for (const action of actions) {
      const ref = refPerms.find((p: any) => p.action === action) || refPerms[0];
      const policyId = ref?.policy ?? null;
      const roleId = ref?.role ?? null;

      const filterPart = policyId
        ? `&filter[policy][_eq]=${policyId}`
        : roleId ? `&filter[role][_eq]=${roleId}` : "";
      const existsRes = await fetch(`${DIRECTUS_URL}/permissions?filter[collection][_eq]=${collection}&filter[action][_eq]=${action}${filterPart}&limit=1`, {
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (existsRes.ok) {
        const ed = await existsRes.json();
        if ((ed.data || []).length > 0) continue;
      }
      const body: any = { collection, action, fields: ["*"], permissions: {}, validation: {} };
      if (policyId) body.policy = policyId;
      else if (roleId) body.role = roleId;
      const r = await fetch(`${DIRECTUS_URL}/permissions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) console.log(`[perms] ${action} permission granted for ${collection}`);
      else console.warn(`[perms] ${action} warn:`, (await r.json().catch(() => ({}))).errors?.[0]?.message);
    }
  } catch (err) { console.error("[perms] Error:", err); }
}

async function ensureNucleoTecnicoCollection() {
  const COL = "nucleo_tecnico_docs";
  try {
    const check = await fetch(`${DIRECTUS_URL}/collections/${COL}`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (check.ok) {
      console.log("[nucleo_tecnico] Directus collection exists (data stored in local PostgreSQL)");
      return;
    }

    const colRes = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: COL,
        fields: [
          { field: "id", type: "uuid", meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] }, schema: { is_primary_key: true, has_auto_increment: false } },
          { field: "bia_id", type: "string", meta: { interface: "input", label: "BIA ID" }, schema: { is_nullable: true } },
          { field: "alianca_tipo", type: "string", meta: { interface: "select-dropdown", label: "Tipo de Aliança" }, schema: { is_nullable: true } },
          { field: "tipo_documento", type: "string", meta: { interface: "input", label: "Tipo de Documento" }, schema: { is_nullable: true } },
          { field: "descricao", type: "text", meta: { interface: "input-multiline", label: "Descrição" }, schema: { is_nullable: true } },
          { field: "membro_responsavel", type: "string", meta: { interface: "input", label: "Membro Responsável" }, schema: { is_nullable: true } },
          { field: "arquivo_ids", type: "json", meta: { interface: "tags", label: "Arquivos (IDs)" }, schema: { is_nullable: true } },
          { field: "date_created", type: "timestamp", meta: { interface: "datetime", readonly: true, hidden: false, special: ["date-created"] }, schema: { is_nullable: true } },
        ],
        meta: { singleton: false, icon: "folder_open" },
      }),
    });
    if (!colRes.ok) { console.error("[nucleo_tecnico] create collection failed:", await colRes.text()); return; }
    console.log("[nucleo_tecnico] Collection created with all fields");
  } catch (err) { console.error("[nucleo_tecnico] Error:", err); }
}

async function ensureEstudosViabilidadeCollection() {
  try {
    const checkRes = await fetch(`${DIRECTUS_URL}/collections/estudos_viabilidade`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (checkRes.ok) { console.log("[estudos] Collection already exists"); await grantCollectionPermissions("estudos_viabilidade"); return; }

    const colRes = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: "estudos_viabilidade",
        fields: [
          { field: "id", type: "uuid", meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] }, schema: { is_primary_key: true, has_auto_increment: false } },
        ],
        meta: { singleton: false, icon: "article" },
      }),
    });
    if (!colRes.ok) { console.error("[estudos] create collection failed:", await colRes.text()); return; }
    console.log("[estudos] Collection created");

    const fields = [
      { field: "bia_id", type: "string", meta: { interface: "input", label: "BIA ID" }, schema: { is_nullable: true } },
      { field: "tipo_documento", type: "string", meta: { interface: "select-dropdown", label: "Tipo de Documento" }, schema: { is_nullable: true } },
      { field: "descricao", type: "text", meta: { interface: "input-multiline", label: "Descrição" }, schema: { is_nullable: true } },
      { field: "membro_responsavel", type: "string", meta: { interface: "input", label: "Membro Responsável" }, schema: { is_nullable: true } },
      { field: "arquivo_ids", type: "json", meta: { interface: "tags", label: "Arquivos (IDs)" }, schema: { is_nullable: true } },
      { field: "date_created", type: "timestamp", meta: { interface: "datetime", readonly: true, hidden: false, special: ["date-created"] }, schema: { is_nullable: true } },
    ];
    for (const f of fields) {
      try {
        const r = await fetch(`${DIRECTUS_URL}/fields/estudos_viabilidade`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(f),
        });
        if (r.ok) console.log(`[estudos] Field ${f.field} created`);
        else console.warn(`[estudos] Field ${f.field} warn:`, (await r.json().catch(() => ({}))).errors?.[0]?.message);
      } catch {}
    }
  } catch (err) {
    console.error("[estudos] Error:", err);
  }
}

async function directusFieldPost(collection: string, body: object): Promise<{ ok: boolean; code?: string }> {
  try {
    const r = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true };
    const err = await r.json().catch(() => ({}));
    return { ok: false, code: err?.errors?.[0]?.extensions?.code };
  } catch { return { ok: false }; }
}

async function directusRelationPost(body: object): Promise<{ ok: boolean; code?: string }> {
  try {
    const r = await fetch(`${DIRECTUS_URL}/relations`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true };
    const err = await r.json().catch(() => ({}));
    return { ok: false, code: err?.errors?.[0]?.extensions?.code };
  } catch { return { ok: false }; }
}

async function ensureComunidadeM2O(col: string, field: string, relatedCollection: string) {
  const silent = new Set(["RECORD_NOT_UNIQUE", "FORBIDDEN", "INVALID_PAYLOAD"]);
  const fr = await directusFieldPost(col, {
    field,
    type: "uuid",
    meta: { interface: "select-dropdown-m2o", display: "related-values", options: { template: "{{nome}}" }, hidden: false },
    schema: { is_nullable: true },
  });
  if (!fr.ok && !silent.has(fr.code!)) console.warn(`[comunidade] M2O field '${field}' response: ${fr.code}`);

  const rr = await directusRelationPost({
    collection: col, field, related_collection: relatedCollection,
    schema: { on_delete: "SET NULL" },
    meta: { many_collection: col, many_field: field, one_collection: relatedCollection, one_field: null },
  });
  if (!rr.ok && !silent.has(rr.code!)) console.warn(`[comunidade] M2O relation '${field}' response: ${rr.code}`);
}

async function getDirectusFieldType(collection: string, field: string): Promise<string> {
  try {
    const r = await fetch(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!r.ok) return "uuid";
    const d = await r.json();
    return d?.data?.type || "uuid";
  } catch { return "uuid"; }
}

async function ensureComunidadeM2M(col: string, aliasField: string, relatedCollection: string) {
  const silent = new Set(["RECORD_NOT_UNIQUE", "FORBIDDEN", "INVALID_PAYLOAD", "INTERNAL_SERVER_ERROR"]);
  const junction = `${col.toLowerCase()}_${aliasField}`;
  const fkParent = `${col.toLowerCase()}_id`;
  const fkRelated = `${relatedCollection}_id`;

  // Determine the actual id type of the parent collection to avoid FK type mismatch
  const parentIdType = await getDirectusFieldType(col, "id");
  const relatedIdType = await getDirectusFieldType(relatedCollection, "id");
  console.log(`[comunidade] M2M '${aliasField}': parent_id=${parentIdType}, related_id=${relatedIdType}`);

  // 1. Create junction collection if absent (with correct FK types)
  const colCheck = await fetch(`${DIRECTUS_URL}/collections/${junction}`, {
    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!colCheck.ok) {
    const colResp = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: junction,
        meta: { hidden: true, icon: "import_export" },
        schema: {},
        fields: [
          { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
          {
            field: fkParent, type: parentIdType, meta: { hidden: true },
            schema: { is_nullable: true, foreign_key_table: col, foreign_key_column: "id" },
          },
          {
            field: fkRelated, type: relatedIdType, meta: { hidden: true },
            schema: { is_nullable: true, foreign_key_table: relatedCollection, foreign_key_column: "id" },
          },
        ],
      }),
    });
    if (!colResp.ok) {
      const e = await colResp.json().catch(() => ({}));
      const code = e?.errors?.[0]?.extensions?.code;
      if (!silent.has(code)) console.warn(`[comunidade] Junction '${junction}' create: ${colResp.status} ${code}`);
      else console.log(`[comunidade] Junction '${junction}': ${code || colResp.status}`);
    } else {
      console.log(`[comunidade] Junction '${junction}' created`);
    }
  } else {
    console.log(`[comunidade] Junction '${junction}' already exists`);
  }

  // 2. Alias M2M field on parent collection
  const ar = await directusFieldPost(col, {
    field: aliasField,
    type: "alias",
    meta: {
      interface: "list-m2m",
      display: "related-values",
      special: ["m2m"],
      junction_field: fkRelated,
      options: { template: `{{${fkRelated}.nome}}` },
      hidden: false,
    },
    schema: null,
  });
  if (!ar.ok && !silent.has(ar.code!)) console.warn(`[comunidade] M2M alias '${aliasField}': ${ar.code}`);
  else if (!ar.ok) console.log(`[comunidade] M2M alias '${aliasField}': ${ar.code}`);

  // 3. Relation: junction.fkParent → parent (carries one_field alias)
  const r1 = await directusRelationPost({
    collection: junction, field: fkParent, related_collection: col,
    meta: {
      many_collection: junction, many_field: fkParent,
      one_collection: col, one_field: aliasField,
      junction_field: fkRelated, sort_field: null,
    },
  });
  if (!r1.ok && !silent.has(r1.code!)) console.warn(`[comunidade] M2M rel1 '${aliasField}': ${r1.code}`);
  else if (!r1.ok) console.log(`[comunidade] M2M rel1 '${aliasField}': ${r1.code}`);

  // 4. Relation: junction.fkRelated → related collection
  const r2 = await directusRelationPost({
    collection: junction, field: fkRelated, related_collection: relatedCollection,
    meta: {
      many_collection: junction, many_field: fkRelated,
      one_collection: relatedCollection, one_field: null,
      junction_field: fkParent, sort_field: null,
    },
  });
  if (!r2.ok && !silent.has(r2.code!)) console.warn(`[comunidade] M2M rel2 '${aliasField}': ${r2.code}`);
  else if (!r2.ok) console.log(`[comunidade] M2M rel2 '${aliasField}': ${r2.code}`);
}

async function ensureComunidadeFields() {
  // Try common naming variants (Directus is case-sensitive)
  const candidates = ["Comunidade", "comunidade", "comunidades", "Comunidades"];
  let COL = "";
  try {
    for (const name of candidates) {
      const check = await fetch(`${DIRECTUS_URL}/collections/${name}`, {
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (check.ok) { COL = name; break; }
    }
    if (!COL) {
      console.warn("[comunidade] Collection not found in Directus — skipping field creation");
      comunidadeColResolve?.(); // Unblock pending requests using default "Comunidade"
      return;
    }
    COMUNIDADE_COL = COL;
    console.log(`[comunidade] Found collection as '${COL}'`);
  } catch {
    comunidadeColResolve?.(); // Unblock on error with default
    return;
  }

  // Scalar fields (INVALID_PAYLOAD can occur when field already exists with different meta)
  const silent = new Set(["RECORD_NOT_UNIQUE", "FORBIDDEN", "INVALID_PAYLOAD"]);
  const scalarFields = [
    { field: "nome", type: "string", meta: { interface: "input", hidden: false, note: "BUILT País | Território | Comunidade A01" }, schema: { is_nullable: true } },
    { field: "sigla", type: "string", meta: { interface: "input", hidden: false, note: "Código sistêmico: BR-BHZ-COM-A01" }, schema: { is_nullable: true } },
    { field: "pais", type: "string", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "sigla_pais", type: "string", meta: { interface: "input", hidden: false, note: "Ex: BR, PT, US" }, schema: { is_nullable: true } },
    { field: "territorio", type: "string", meta: { interface: "input", hidden: false, note: "Cidade ou região" }, schema: { is_nullable: true } },
    { field: "sigla_territorio", type: "string", meta: { interface: "input", hidden: false, note: "Ex: BHZ, SPO" }, schema: { is_nullable: true } },
    { field: "codigo_sequencial", type: "string", meta: { interface: "input", hidden: false, note: "A01, A02…B01" }, schema: { is_nullable: true } },
    { field: "status", type: "string", meta: { interface: "select-dropdown", hidden: false, options: { choices: [{ text: "Ativa", value: "ativa" }, { text: "Inativa", value: "inativa" }] }, default_value: "ativa" }, schema: { is_nullable: true, default_value: "ativa" } },
    { field: "date_created", type: "timestamp", meta: { interface: "datetime", readonly: true, hidden: false, special: ["date-created"] }, schema: { is_nullable: true } },
  ];
  for (const f of scalarFields) {
    const r = await directusFieldPost(COL, f);
    if (!r.ok && !silent.has(r.code!)) console.warn(`[comunidade] Scalar field '${f.field}': ${r.code}`);
  }

  // M2O: aliado → cadastro_geral
  await ensureComunidadeM2O(COL, "aliado", "cadastro_geral");

  // M2M: membros ↔ cadastro_geral (junction: ${COL}_membros)
  await ensureComunidadeM2M(COL, "membros", "cadastro_geral");

  // M2M: bias ↔ bias_projetos (junction: ${COL}_bias)
  await ensureComunidadeM2M(COL, "bias", "bias_projetos");

  console.log("[comunidade] Fields ensured (M2O/M2M)");
  comunidadeColResolve?.(); // Unblock pending route handlers
}

function nextComunidadeCode(codes: string[]): string {
  // Sequence: A01...A99, B01...B99, ...
  if (codes.length === 0) return "A01";
  const sorted = [...codes].sort();
  const last = sorted[sorted.length - 1];
  const match = last.match(/^([A-Z])(\d{2})$/);
  if (!match) return "A01";
  const letter = match[1];
  const num = parseInt(match[2], 10);
  if (num < 99) {
    return `${letter}${String(num + 1).padStart(2, "0")}`;
  }
  const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
  return `${nextLetter}01`;
}

async function resolveFileIds(ids: string[]): Promise<any[]> {
  if (!ids || ids.length === 0) return [];
  const results = [];
  for (const id of ids) {
    try {
      const r = await fetch(`${DIRECTUS_URL}/files/${id}`, {
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (r.ok) {
        const d = await r.json();
        const f = d.data;
        results.push({ id: f.id, title: f.title, filename: f.filename_download, url: `/api/files/${f.id}`, size: String(f.filesize ?? "") });
      }
    } catch {}
  }
  return results;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Clear Directus field validations that block saving numeric fields
  clearBiasFieldValidations().catch(console.error);
  // Ensure geo fields exist in Directus
  ensureBiasGeoFields().catch(console.error);
  ensureVitrineFields().catch(console.error);
  ensureGeoFields("tipos_oportunidades", "geo-opa").catch(console.error);
  ensureBiasExtraFields().catch(console.error);
  ensureComunidadeFields().catch(console.error);
  ensureNomeBiaLength().catch(console.error);
  ensureEstudosViabilidadeCollection().catch(console.error);
  ensureNucleoTecnicoCollection().catch(console.error);
  // Update observacoes field label in Directus admin
  fetch(`${DIRECTUS_URL}/fields/bias_projetos/observacoes`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { note: "Descrição da BIA" } }),
  }).catch(() => {});

  // Proxy para servir arquivos do Directus sem expor o token
  app.get("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const directusRes = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (!directusRes.ok) {
        return res.status(directusRes.status).json({ error: "Arquivo não encontrado" });
      }
      const contentType = directusRes.headers.get("content-type") || "application/octet-stream";
      const contentDisposition = directusRes.headers.get("content-disposition");
      res.setHeader("Content-Type", contentType);
      if (contentDisposition) res.setHeader("Content-Disposition", contentDisposition);
      res.setHeader("Cache-Control", "private, max-age=3600");
      const buffer = await directusRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/upload", (req, res) => {
    upload.array("files", 10)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Arquivo excede o limite de 10MB" });
          if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ error: "Máximo de 10 arquivos por vez" });
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: err.message });
      }
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      try {
        const directusFileIds: string[] = [];
        for (const file of files) {
          const formData = new FormData();
          const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
          formData.append("file", blob, file.originalname);

          const directusRes = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            body: formData,
          });

          if (!directusRes.ok) {
            const errText = await directusRes.text();
            console.error("Directus file upload error:", errText);
            throw new Error(`Erro ao enviar arquivo ao Directus: ${directusRes.status} — ${errText}`);
          }

          const json = await directusRes.json();
          directusFileIds.push(json.data.id);
        }

        res.json({ success: true, fileIds: directusFileIds });
      } catch (uploadErr: any) {
        res.status(500).json({ error: uploadErr.message });
      }
    });
  });

  // ========== VITRINE (membros que optaram por aparecer na Vitrine) ==========
  app.get("/api/vitrine", async (req, res) => {
    // Require authenticated session — Vitrine is available to all logged-in users
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      // Fetch all members with the na_vitrine field and filter server-side
      // (avoids URL bracket encoding issues with Directus filter API)
      // Note: "especialidade" and "foto" are not direct fields — use Especialidades relation and foto_perfil instead
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (!response.ok) throw new Error(`Directus error: ${response.status}`);
      const json = await response.json();
      const items = (json.data || [])
        .filter((m: any) => m.na_vitrine === true || m.na_vitrine === 1)
        .map((m: any) => {
          // Extract first especialidade from relation
          const especialidades = (m.Especialidades || [])
            .map((e: any) => e?.especialidades_id?.nome_especialidade)
            .filter(Boolean);
          return {
            ...m,
            cargo: m.cargo || m.responsavel_cargo || null,
            foto: m.foto_perfil || null,
            especialidade: especialidades[0] || null,
            latitude: m.latitude ? parseFloat(m.latitude) : null,
            longitude: m.longitude ? parseFloat(m.longitude) : null,
          };
        });
      // Fire-and-forget: geocode members without coordinates (max 8 per call, 250ms apart)
      const needGeo = items.filter((m: any) => !m.latitude && !m.longitude && m.cidade);
      if (needGeo.length > 0) geocodeMembrosCadastro(needGeo).catch(() => {});
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MEMBROS BUILT (PROUD MEMBER only) ==========
  app.get("/api/membros-built", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!response.ok) throw new Error(`Directus error: ${response.status}`);
      const json = await response.json();
      const items = (json.data || [])
        .filter((m: any) => {
          const redes = m.Outras_redes_as_quais_pertenco || [];
          return Array.isArray(redes) && redes.includes("BUILT_PROUD_MEMBER");
        })
        .map((m: any) => {
          const especialidades = (m.Especialidades || [])
            .map((e: any) => e?.especialidades_id?.nome_especialidade)
            .filter(Boolean);
          return {
            ...m,
            cargo: m.cargo || m.responsavel_cargo || null,
            foto: m.foto_perfil || null,
            especialidade: especialidades[0] || null,
            latitude: m.latitude ? parseFloat(m.latitude) : null,
            longitude: m.longitude ? parseFloat(m.longitude) : null,
          };
        });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ESPECIALIDADES (from Directus) ==========
  app.get("/api/especialidades", async (req, res) => {
    try {
      const url = `${DIRECTUS_URL}/items/especialidades?limit=-1&fields=id,nome_especialidade,categoria&sort=nome_especialidade`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const json = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: json.errors?.[0]?.message || "Erro Directus" });
      res.json(json.data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/especialidades", async (req, res) => {
    try {
      const { nome_especialidade, categoria } = req.body;
      if (!nome_especialidade?.trim()) {
        return res.status(400).json({ error: "Nome da especialidade é obrigatório." });
      }
      const url = `${DIRECTUS_URL}/items/especialidades`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nome_especialidade: nome_especialidade.trim(), categoria: categoria?.trim() || null }),
      });
      const json = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: json.errors?.[0]?.message || "Erro Directus" });
      res.json(json.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MEMBROS (from Directus: cadastro_geral) ==========
  // Helper: check if the session role allows full Cadastro Geral access
  function requireCadastroAccess(req: any, res: any): boolean {
    const role = (req.session as any).role || "user";
    if (role === "admin" || role === "manager") return true;
    res.status(403).json({ error: "Acesso restrito a administradores e gestores." });
    return false;
  }

  // Helper: allow if admin/manager OR if user is accessing their own membro record
  function requireCadastroOrOwn(req: any, res: any): boolean {
    const role = (req.session as any).role || "user";
    if (role === "admin" || role === "manager") return true;
    const sessionMembroId = (req.session as any).membroId as string | null;
    if (sessionMembroId && req.params.id === sessionMembroId) return true;
    res.status(403).json({ error: "Acesso restrito a administradores e gestores." });
    return false;
  }

  app.get("/api/membros", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const items = await directusFetch("cadastro_geral", "fields=*,Especialidades.*.*");
      const mapped = items.map((m: any) => {
        // Parse relational Especialidades (M2M or O2M from Directus)
        let especialidades_arr: string[] = [];
        const esp = m.Especialidades;
        if (Array.isArray(esp)) {
          especialidades_arr = esp.map((e: any) => {
            if (typeof e === "string") return e;
            if (typeof e === "number") return String(e);
            // M2M junction: junction field is especialidades_id → nome_especialidade
            const nested = e?.especialidades_id || e?.Especialidades_id || e?.especialidade_id || e;
            if (typeof nested === "object" && nested !== null) {
              return nested.nome_especialidade || nested.nome || nested.name || nested.titulo || nested.label || String(nested.id || "");
            }
            return null;
          }).filter(Boolean) as string[];
        } else if (typeof esp === "string" && esp) {
          especialidades_arr = [esp];
        } else if (typeof esp === "object" && esp !== null) {
          const n = esp.nome || esp.name || esp.titulo;
          if (n) especialidades_arr = [n];
        }
        // Fallback to plain text field
        if (especialidades_arr.length === 0 && m.especialidade) {
          especialidades_arr = [m.especialidade];
        }
        return {
          ...m,
          cargo: m.cargo || m.responsavel_cargo || null,
          especialidade: especialidades_arr[0] || m.especialidade || null,
          especialidades: especialidades_arr,
          foto: m.foto_perfil || m.foto || null,
        };
      });
      res.json(mapped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/membros/:id", async (req, res) => {
    if (!requireCadastroOrOwn(req, res)) return;
    try {
      const m = await directusFetchOne("cadastro_geral", req.params.id, "fields=*,Especialidades.especialidades_id.id,Especialidades.especialidades_id.nome_especialidade");
      if (!m) return res.status(404).json({ error: "Membro não encontrado" });
      // Extract first specialty id and name from M2M relation
      const espArr = Array.isArray(m.Especialidades) ? m.Especialidades : [];
      const firstEsp = espArr[0]?.especialidades_id;
      res.json({
        ...m,
        cargo: m.cargo || m.responsavel_cargo || null,
        foto: m.foto_perfil || m.foto || null,
        especialidade_id: (typeof firstEsp === "object" ? firstEsp?.id : null) ?? null,
        especialidade: (typeof firstEsp === "object" ? firstEsp?.nome_especialidade : null) ?? null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros", async (req, res) => {
    if (!requireCadastroAccess(req, res)) return;
    try {
      const item = await directusCreate("cadastro_geral", req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/membros/:id", async (req, res) => {
    if (!requireCadastroOrOwn(req, res)) return;
    try {
      const item = await directusUpdate("cadastro_geral", req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id", async (req, res) => {
    if (!requireCadastroAccess(req, res)) return;
    try {
      await directusDelete("cadastro_geral", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIAS PROJETOS (from Directus) ==========
  function resolveAnexosBia(items: any[]): any[] {
    return items.map((b: any) => ({
      ...b,
      Anexos: (b.Anexos || []).map((a: any) => {
        const f = a.directus_files_id;
        if (!f || typeof f !== "object") return null;
        return {
          id: f.id,
          title: f.title || f.filename_download || f.id,
          filename: f.filename_download || f.id,
          url: `${DIRECTUS_URL}/assets/${f.id}`,
          size: f.filesize,
        };
      }).filter(Boolean),
    }));
  }

  app.get("/api/bias", async (req, res) => {
    try {
      const items = await directusFetch("bias_projetos", "fields=*,Anexos.directus_files_id.*");
      res.json(resolveAnexosBia(items));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:id", async (req, res) => {
    try {
      const item = await directusFetchOne("bias_projetos", req.params.id, "fields=*,Anexos.directus_files_id.*");
      if (!item) return res.status(404).json({ error: "BIA não encontrada" });
      res.json(resolveAnexosBia([item])[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function prepareBiaPayload(body: Record<string, any>): Record<string, any> {
    const data = { ...body };
    if (data.Anexos !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (Array.isArray(data.Anexos) && data.Anexos.every((a: any) => typeof a === "string")) {
        const validIds: string[] = data.Anexos.filter((id: string) => uuidRegex.test(id));
        data.Anexos = validIds.map((fileId: string) => ({ directus_files_id: fileId }));
      }
    }
    return data;
  }

  app.post("/api/bias", async (req, res) => {
    try {
      const item = await directusCreate("bias_projetos", prepareBiaPayload(req.body));
      const valorOrigem = parseFloat(req.body.valor_origem) || 0;
      if (valorOrigem > 0) {
        syncValorOrigemLancamento(item.id, valorOrigem).catch(console.error);
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bias/:id", async (req, res) => {
    try {
      let payload = prepareBiaPayload(req.body);
      // Remove already-known blocked fields before first attempt
      for (const f of biasBlockedFields) delete (payload as any)[f];

      let lastError: any = null;
      const newlySkipped: string[] = [];
      const maxAttempts = Object.keys(payload).length + 5;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const item = await directusUpdate("bias_projetos", req.params.id, payload);
          if (newlySkipped.length > 0) console.log(`[bias patch] discovered blocked fields: ${newlySkipped.join(", ")}`);
          if (req.body.valor_origem !== undefined) {
            const valorOrigem = parseFloat(req.body.valor_origem) || 0;
            syncValorOrigemLancamento(req.params.id, valorOrigem).catch(console.error);
          }
          return res.json(item);
        } catch (err: any) {
          const msg: string = err.message || "";
          let parsed: any = null;
          try {
            const jsonStr = msg.replace(/^Directus update error \d+: /, "");
            parsed = JSON.parse(jsonStr);
          } catch {}
          const outOfRange: string[] = (parsed?.errors || [])
            .filter((e: any) => e.extensions?.code === "VALUE_OUT_OF_RANGE")
            .map((e: any) => e.extensions?.field)
            .filter(Boolean);
          if (outOfRange.length === 0) { lastError = err; break; }
          for (const f of outOfRange) {
            biasBlockedFields.add(f);
            newlySkipped.push(f);
            delete (payload as any)[f];
          }
          lastError = err;
          if (Object.keys(payload).length === 0) break;
        }
      }

      res.status(500).json({ error: lastError?.message || "Unknown error" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bias/:id", async (req, res) => {
    try {
      await directusDelete("bias_projetos", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== FLUXO DE CAIXA (from Directus) ==========
  app.get("/api/fluxo-caixa", async (req, res) => {
    try {
      const items = await directusFetch("fluxo_caixa", "fields=*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*,favorecido_id.id,favorecido_id.nome,favorecido_id.Nome_de_usuario,favorecido_id.razao_social");
      const mapped = items.map((f: any) => {
        const anexos = (f.Anexos || []).map((a: any) => {
          if (a && a.directus_files_id) {
            const file = typeof a.directus_files_id === "object" ? a.directus_files_id : null;
            if (file) {
              return {
                id: file.id,
                title: file.title || file.filename_download,
                filename: file.filename_download,
                url: `/api/files/${file.id}`,
                size: file.filesize,
              };
            }
            return { id: a.directus_files_id, url: `/api/files/${a.directus_files_id}` };
          }
          return a;
        });
        const categorias = (f.Categoria || []).map((c: any) => {
          if (c && typeof c === "object" && c.categorias_id && typeof c.categorias_id === "object") {
            return c.categorias_id;
          }
          return c;
        });
        const tiposCpp = (f.tipo_de_cpp || []).map((c: any) => {
          if (c && typeof c === "object" && c.tipos_cpp_id && typeof c.tipos_cpp_id === "object") {
            return c.tipos_cpp_id;
          }
          return c;
        });
        return {
          id: f.id,
          bia: f.bia,
          tipo: f.tipo,
          valor: f.valor,
          data: f.data,
          descricao: f.descricao,
          membro_responsavel: f.membro_responsavel,
          status: f.status || null,
          data_vencimento: f.data_vencimento || null,
          data_pagamento: f.data_pagamento || null,
          multa: f.multa || null,
          juros: f.juros || null,
          responsavel_multa_juros: f.responsavel_multa_juros || null,
          Categoria: categorias,
          tipo_de_cpp: tiposCpp,
          Favorecido: (() => {
            if (!f.favorecido_id) return [];
            if (typeof f.favorecido_id === "object") {
              const fav = f.favorecido_id as any;
              return [{ id: fav.id, nome: fav.Nome_de_usuario || fav.nome || fav.razao_social || fav.id }];
            }
            return [{ id: f.favorecido_id }];
          })(),
          anexos,
        };
      });
      res.json(mapped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fluxo-caixa", async (req, res) => {
    try {
      const body = req.body;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const anexoFileIds: string[] = (body.anexos || []).filter((id: string) => uuidRegex.test(id));
      const anexosPayload = anexoFileIds.map((fileId: string) => ({
        directus_files_id: fileId,
      }));
      const toM2MCategorias = (ids: any[]) =>
        ids.map((id: any) => (typeof id === "object" ? id : { categorias_id: id }));
      const toM2MTiposCpp = (ids: any[]) =>
        ids.map((id: any) => (typeof id === "object" ? id : { tipos_cpp_id: id }));
      const data: Record<string, any> = {
        bia: body.bia || body.bia_id || null,
        tipo: body.tipo,
        valor: String(body.valor),
        data: body.data || null,
        descricao: body.descricao || null,
        membro_responsavel: body.membro_responsavel || null,
        status: body.status || null,
        data_vencimento: body.data_vencimento || null,
        data_pagamento: body.data_pagamento || null,
        multa: body.multa != null && body.multa !== "" ? String(body.multa) : null,
        juros: body.juros != null && body.juros !== "" ? String(body.juros) : null,
        responsavel_multa_juros: body.responsavel_multa_juros || null,
        Categoria: toM2MCategorias(body.Categoria || []),
        tipo_de_cpp: toM2MTiposCpp(body.tipo_de_cpp || []),
        favorecido_id: (body.Favorecido || [])[0] || null,
        Anexos: anexosPayload.length > 0 ? anexosPayload : [],
      };
      const item = await directusCreate("fluxo_caixa", data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      const body = req.body;
      const data: Record<string, any> = {};
      if (body.tipo !== undefined) data.tipo = body.tipo;
      if (body.valor !== undefined) data.valor = String(body.valor);
      if (body.data !== undefined) data.data = body.data;
      if (body.descricao !== undefined) data.descricao = body.descricao;
      if (body.membro_responsavel !== undefined) data.membro_responsavel = body.membro_responsavel;
      if (body.status !== undefined) data.status = body.status;
      if (body.data_vencimento !== undefined) data.data_vencimento = body.data_vencimento || null;
      if (body.data_pagamento !== undefined) data.data_pagamento = body.data_pagamento || null;
      if (body.multa !== undefined) data.multa = body.multa != null && body.multa !== "" ? String(body.multa) : null;
      if (body.juros !== undefined) data.juros = body.juros != null && body.juros !== "" ? String(body.juros) : null;
      if (body.responsavel_multa_juros !== undefined) data.responsavel_multa_juros = body.responsavel_multa_juros || null;
      if (body.Categoria !== undefined)
        data.Categoria = (body.Categoria || []).map((id: any) =>
          typeof id === "object" ? id : { categorias_id: id }
        );
      if (body.tipo_de_cpp !== undefined)
        data.tipo_de_cpp = (body.tipo_de_cpp || []).map((id: any) =>
          typeof id === "object" ? id : { tipos_cpp_id: id }
        );
      if (body.Favorecido !== undefined)
        data.favorecido_id = (body.Favorecido || [])[0] || null;
      if (body.anexos !== undefined) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validIds: string[] = (body.anexos || []).filter((id: string) => uuidRegex.test(id));
        data.Anexos = validIds.map((fileId: string) => ({ directus_files_id: fileId }));
      }

      const item = await directusUpdate("fluxo_caixa", req.params.id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      // Limpa relações M2M primeiro para evitar violação de foreign key
      await directusUpdate("fluxo_caixa", req.params.id, {
        Categoria: [],
        tipo_de_cpp: [],
        favorecido_id: null,
        Anexos: [],
      });
      await directusDelete("fluxo_caixa", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TIPOS CPP (from Directus) ==========
  app.get("/api/tipos-cpp", async (req, res) => {
    try {
      const items = await directusFetch("Tipos_CPP");
      const mapped = items.map((c: any) => ({ id: c.id, Nome: c.Nome, Descricao: c.Descricao }));
      res.json(mapped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tipos-cpp", async (req, res) => {
    try {
      const item = await directusCreate("Tipos_CPP", { Nome: req.body.nome || req.body.Nome, Descricao: req.body.descricao || req.body.Descricao });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== CATEGORIAS (from Directus) ==========
  app.get("/api/categorias", async (req, res) => {
    try {
      const items = await directusFetch("Categorias");
      const mapped = items.map((c: any) => ({ id: c.id, Nome_da_categoria: c.Nome_da_categoria, Descricao_das_categorias: c.Descricao_das_categorias, Tipo_de_categoria: c.Tipo_de_categoria || null }));
      res.json(mapped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categorias", async (req, res) => {
    try {
      const item = await directusCreate("Categorias", { Nome_da_categoria: req.body.nome || req.body.Nome_da_categoria, Descricao_das_categorias: req.body.descricao || req.body.Descricao_das_categorias });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== OPORTUNIDADES (from Directus: tipos_oportunidades) ==========
  function resolveAnexosOpa(items: any[]): any[] {
    return items.map((o: any) => ({
      id: o.id,
      nome_oportunidade: o.nome_oportunidade,
      tipo: o.tipo,
      bia: o.bia,
      bia_id: o.bia,
      valor_origem_opa: o.valor_origem_opa,
      Minimo_esforco_multiplicador: o.Minimo_esforco_multiplicador,
      objetivo_alianca: o.objetivo_alianca,
      nucleo_alianca: o.nucleo_alianca,
      pais: o.pais,
      descricao: o.descricao,
      perfil_aliado: o.perfil_aliado,
      status: o.status || "ativa",
      motivo_encerramento: o.motivo_encerramento || null,
      date_created: o.date_created || null,
      Anexos: (o.anexos || []).map((a: any) => {
        const f = a?.directus_files_id;
        if (!f || typeof f !== "object") return null;
        return {
          id: f.id,
          title: f.title || f.filename_download,
          filename: f.filename_download,
          url: f.id ? `/api/assets/${f.id}` : null,
          size: f.filesize ? `${Math.round(f.filesize / 1024)} KB` : null,
        };
      }).filter(Boolean),
    }));
  }

  app.get("/api/oportunidades", async (req, res) => {
    try {
      const items = await directusFetch("tipos_oportunidades", "fields=*,anexos.directus_files_id.*");
      res.json(resolveAnexosOpa(items));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function prepareOpaPayload(body: Record<string, any>): Record<string, any> {
    const data = { ...body };
    if (Array.isArray(data.Anexos)) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds: string[] = data.Anexos.filter((id: any) => typeof id === "string" && uuidRegex.test(id));
      data.anexos = validIds.map((fileId: string) => ({ directus_files_id: fileId }));
      delete data.Anexos;
    }
    return data;
  }

  app.post("/api/oportunidades", async (req, res) => {
    try {
      const item = await directusCreate("tipos_oportunidades", prepareOpaPayload(req.body));
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/oportunidades/tipos", async (req, res) => {
    try {
      const r = await fetch(`${DIRECTUS_URL}/fields/tipos_oportunidades/tipo`, {
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
      });
      const d = await r.json();
      const choices: { text: string; value: string }[] = d?.data?.meta?.options?.choices || [];
      res.json(choices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/oportunidades/:id", async (req, res) => {
    try {
      const item = await directusUpdate("tipos_oportunidades", req.params.id, prepareOpaPayload(req.body));
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/oportunidades/:id", async (req, res) => {
    try {
      await directusDelete("tipos_oportunidades", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== OPA INTERESSES ==========
  app.get("/api/oportunidades/:id/interesse", async (req, res) => {
    try {
      const { id } = req.params;
      const interesses = await storage.getInteressesByOpa(id);
      const directusUserId = (req.session as any).directusUserId as string | undefined;
      const meuInteresse = directusUserId ? await storage.getUserInteresseByOpa(id, directusUserId) : null;
      res.json({ interesses, meuInteresse: meuInteresse || null, total: interesses.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oportunidades/:id/interesse", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId as string | undefined;
      if (!directusUserId) return res.status(401).json({ error: "Não autenticado" });
      const membroId = (req.session as any).membroId as string | undefined;
      const nome = (req.session as any).nome as string | undefined;
      const { id } = req.params;
      const existing = await storage.getUserInteresseByOpa(id, directusUserId);
      if (existing) return res.status(409).json({ error: "Interesse já registrado" });
      const item = await storage.createOpaInteresse({
        opa_id: id,
        user_id: directusUserId,
        membro_id: membroId || null,
        membro_nome: nome || directusUserId,
        mensagem: req.body.mensagem || null,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/oportunidades/:id/interesse", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId as string | undefined;
      if (!directusUserId) return res.status(401).json({ error: "Não autenticado" });
      const { id } = req.params;
      await storage.deleteOpaInteresse(id, directusUserId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== AI ANALYZE (per-item) ==========
  app.post("/api/analyze/bia/:id", async (req, res) => {
    try {
      const bia = await directusFetchOne("bias_projetos", req.params.id);
      if (!bia) return res.status(404).json({ success: false, error: "BIA not found" });
      const { question } = req.body;

      const systemPrompt = `Você é um analista especializado em projetos BIA da Built Alliances.
PROJETO BIA EM ANÁLISE:
- Nome: ${bia.nome_bia}
- Objetivo: ${bia.objetivo_alianca || 'N/A'}
- Localização: ${bia.localizacao || 'N/A'}
- Dados: ${JSON.stringify(bia)}
Responda em português brasileiro, de forma clara e objetiva.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question || "Faça uma análise completa deste projeto BIA." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      res.json({ success: true, message: response.choices[0]?.message?.content || "Não foi possível analisar.", bia });
    } catch (error: any) {
      console.error("BIA Analysis error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/analyze/oportunidade/:id", async (req, res) => {
    try {
      const { question } = req.body;
      const systemPrompt = `Você é um analista especializado em oportunidades de negócio da Built Alliances. Responda em português brasileiro.`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question || "Faça uma análise desta oportunidade." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });
      res.json({ success: true, message: response.choices[0]?.message?.content || "Não foi possível analisar." });
    } catch (error: any) {
      console.error("Oportunidade Analysis error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== AI ASSISTANT ==========
  app.post("/api/assistant", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const [allMembros, allBias, allOportunidades] = await Promise.all([
        directusFetch("cadastro_geral"),
        directusFetch("bias_projetos"),
        directusFetch("tipos_oportunidades"),
      ]);

      const systemPrompt = `Você é o assistente inteligente da Built Alliances, uma plataforma de gestão de membros, projetos BIA e oportunidades de negócio.

DADOS ATUAIS DO SISTEMA:
- Total de Membros: ${allMembros.length}
- Total de BIAS (Projetos): ${allBias.length}
- Total de Oportunidades: ${allOportunidades.length}

MEMBROS CADASTRADOS:
${allMembros.slice(0, 20).map((m) => `- ${m.nome} | Empresa: ${m.empresa || 'N/A'} | Cargo: ${m.cargo || 'N/A'}`).join('\n')}

PROJETOS BIA ATIVOS:
${allBias.slice(0, 15).map((b) => `- ${b.nome_bia} | Local: ${b.localizacao || 'N/A'}`).join('\n')}

Responda sempre em português brasileiro, de forma clara e objetiva.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      res.json({
        success: true,
        message: response.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.",
        stats: { membros: allMembros.length, bias: allBias.length, oportunidades: allOportunidades.length }
      });
    } catch (error: any) {
      console.error("AI Assistant error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { prompt, type } = req.body;

      const systemPrompt = type === "oportunidades"
        ? `Você é um consultor especialista em construção civil e investimentos imobiliários da Built Alliances. Analise as oportunidades de aliança (OPAs) e forneça insights estratégicos em português brasileiro. Seja conciso. Máximo 3 parágrafos.`
        : `Você é um consultor especialista da Built Alliances em BIAs. Analise os projetos de aliança e forneça insights. Seja conciso. Máximo 3 parágrafos.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      res.json({ success: true, analysis: response.choices[0]?.message?.content || "Análise não disponível." });
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== AUTH (Directus-based) ==========
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });

      // Authenticate against Directus
      const authRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!authRes.ok) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const authData = await authRes.json();
      const accessToken = authData.data?.access_token;
      if (!accessToken) return res.status(401).json({ error: "Erro ao obter token" });

      // Get the Directus user info
      const meRes = await fetch(`${DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,role`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meData = await meRes.json();
      const directusUser = meData.data;
      if (!directusUser) return res.status(401).json({ error: "Usuário não encontrado" });

      // Find the matching member in cadastro_geral by email
      let membroId: string | null = null;
      let nome = [directusUser.first_name, directusUser.last_name].filter(Boolean).join(" ") || email;

      try {
        const qs = new URLSearchParams();
        qs.set("filter[email][_eq]", email);
        qs.set("fields", "id,Nome_de_usuario,nome,email");
        qs.set("limit", "1");
        const lookupUrl = `${DIRECTUS_URL}/items/cadastro_geral?${qs.toString()}`;
        console.log("[login] cadastro_geral lookup:", lookupUrl);
        const cadastroRes = await fetch(lookupUrl, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        });
        const cadastroText = await cadastroRes.text();
        console.log("[login] cadastro_geral status:", cadastroRes.status, "body:", cadastroText.slice(0, 300));
        if (cadastroRes.ok) {
          const cadastroData = JSON.parse(cadastroText);
          const membros = cadastroData.data || [];
          if (membros.length > 0) {
            membroId = membros[0].id;
            const m = membros[0];
            nome = m.Nome_de_usuario || m.nome || nome;
          } else {
            // Fallback: fetch all and find by email match (case-insensitive)
            console.log("[login] no direct match, trying full scan fallback");
            const allRes = await fetch(`${DIRECTUS_URL}/items/cadastro_geral?fields=id,email,Nome_de_usuario,nome&limit=200`, {
              headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            });
            if (allRes.ok) {
              const allData = await allRes.json();
              const match = (allData.data || []).find((m: any) =>
                m.email && m.email.toLowerCase() === email.toLowerCase()
              );
              if (match) {
                membroId = match.id;
                nome = match.Nome_de_usuario || match.nome || nome;
                console.log("[login] fallback found member:", membroId, nome);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[login] cadastro_geral lookup error:", err.message);
      }

      // Check local users table for admin role by email
      let role = "user";
      try {
        const localUser = await storage.getUserByEmail(email);
        if (localUser && localUser.ativo) {
          role = localUser.role || "user";
        }
      } catch {
        // ignore — local user lookup is optional
      }

      // Store session
      (req.session as any).directusUserId = directusUser.id;
      (req.session as any).membroId = membroId;
      (req.session as any).nome = nome;
      (req.session as any).email = email;
      (req.session as any).role = role;

      res.json({
        id: directusUser.id,
        nome,
        email,
        membro_directus_id: membroId,
        role,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/me", (req, res) => {
    const directusUserId = (req.session as any).directusUserId;
    if (!directusUserId) return res.status(401).json({ error: "Não autenticado" });
    res.json({
      id: directusUserId,
      nome: (req.session as any).nome || "",
      email: (req.session as any).email || "",
      membro_directus_id: (req.session as any).membroId || null,
      role: (req.session as any).role || "user",
    });
  });

  // ========== USER MANAGEMENT ==========
  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      const { password, ...safe } = user;
      res.json(safe);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const parsed = createUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) return res.status(409).json({ error: "Username já existe" });

      const user = await storage.createUser({
        ...parsed,
        email: parsed.email || null,
        membro_directus_id: parsed.membro_directus_id || null,
        permissions: (parsed.permissions as any) || (parsed.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS),
      });
      const { password, ...safe } = user;
      res.json(safe);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: error.message });
    }
  });

  // ── Núcleo Técnico Documentos (PostgreSQL local) ─────────────────
  app.get("/api/nucleo-tecnico-docs", async (req, res) => {
    try {
      let query = db.select().from(nucleoTecnicoDocs).orderBy(desc(nucleoTecnicoDocs.created_at));
      const rows = await query;
      const filtered = rows.filter((r: any) => {
        if (req.query.bia_id && r.bia_id !== req.query.bia_id) return false;
        if (req.query.alianca_tipo && r.alianca_tipo !== req.query.alianca_tipo) return false;
        return true;
      });
      const enriched = await Promise.all(filtered.map(async (item: any) => {
        const ids: string[] = Array.isArray(item.arquivo_ids) ? item.arquivo_ids : [];
        const arquivos = await resolveFileIds(ids);
        return { ...item, arquivos };
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/nucleo-tecnico-docs", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const [item] = await db.insert(nucleoTecnicoDocs).values(rest).returning();
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/nucleo-tecnico-docs/:id", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const [item] = await db.update(nucleoTecnicoDocs).set(rest).where(eq(nucleoTecnicoDocs.id, req.params.id)).returning();
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/nucleo-tecnico-docs/:id", async (req, res) => {
    try {
      await db.delete(nucleoTecnicoDocs).where(eq(nucleoTecnicoDocs.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Directus Asset Proxy ────────────────────────────────────────
  app.get("/api/assets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const qs = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${DIRECTUS_URL}/assets/${id}${qs ? `?${qs}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` } });
      if (!r.ok) return res.status(r.status).end();
      const ct = r.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = await r.arrayBuffer();
      res.end(Buffer.from(buf));
    } catch (error: any) { res.status(500).end(); }
  });

  // ── Aliança Docs (Obra / Comercial / Capital) ────────────────────
  app.get("/api/alianca-docs", async (req, res) => {
    try {
      const rows = await db.select().from(aliancaDocs).orderBy(desc(aliancaDocs.created_at));
      const filtered = rows.filter((r: any) => {
        if (req.query.modulo && r.modulo !== req.query.modulo) return false;
        if (req.query.bia_id && r.bia_id !== req.query.bia_id) return false;
        if (req.query.alianca_tipo && r.alianca_tipo !== req.query.alianca_tipo) return false;
        return true;
      });
      const enriched = await Promise.all(filtered.map(async (item: any) => {
        const ids: string[] = Array.isArray(item.arquivo_ids) ? item.arquivo_ids : [];
        const arquivos = await resolveFileIds(ids);
        return { ...item, arquivos };
      }));
      res.json(enriched);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/alianca-docs", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const [item] = await db.insert(aliancaDocs).values(rest).returning();
      res.json(item);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.patch("/api/alianca-docs/:id", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const [item] = await db.update(aliancaDocs).set(rest).where(eq(aliancaDocs.id, req.params.id)).returning();
      res.json(item);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/alianca-docs/:id", async (req, res) => {
    try {
      await db.delete(aliancaDocs).where(eq(aliancaDocs.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ── Estudos de Viabilidade ──────────────────────────────────────
  app.get("/api/estudos-viabilidade", async (req, res) => {
    try {
      const biaFilter = req.query.bia_id ? `&filter[bia_id][_eq]=${req.query.bia_id}` : "";
      const items = await directusFetch("estudos_viabilidade", `sort=-date_created${biaFilter}`);
      const enriched = await Promise.all(items.map(async (item: any) => {
        const ids: string[] = Array.isArray(item.arquivo_ids) ? item.arquivo_ids : [];
        const arquivos = await resolveFileIds(ids);
        return { ...item, arquivos };
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/estudos-viabilidade", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const item = await directusCreate("estudos_viabilidade", rest);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/estudos-viabilidade/:id", async (req, res) => {
    try {
      const { arquivos, ...rest } = req.body;
      const item = await directusUpdate("estudos_viabilidade", req.params.id, rest);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/estudos-viabilidade/:id", async (req, res) => {
    try {
      await directusDelete("estudos_viabilidade", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const parsed = updateUserSchema.parse(req.body);
      const updateData: any = { ...parsed };
      if (parsed.email === "") updateData.email = null;
      if (parsed.membro_directus_id === "") updateData.membro_directus_id = null;
      if (parsed.password === "") delete updateData.password;

      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      const { password, ...safe } = user;
      res.json(safe);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const ok = await storage.deleteUser(req.params.id);
      if (!ok) return res.status(404).json({ error: "Usuário não encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TRANSFERÊNCIA DE COTAS ==========
  app.get("/api/transferencia-cotas", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId;
      if (!directusUserId) return res.status(401).json({ error: "Não autenticado" });
      const biaId = req.query.bia_id as string;
      if (!biaId) return res.status(400).json({ error: "bia_id é obrigatório" });
      const items = await storage.getTransferenciasCotasByBia(biaId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transferencia-cotas", async (req, res) => {
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const sessionDirectusUserId = (req.session as any).directusUserId;
      const sessionRole = (req.session as any).role || "user";
      if (!sessionDirectusUserId) return res.status(401).json({ error: "Não autenticado" });
      const { bia_id, membro_origem_id, membro_destino_id, valor_total, percentual_transferencia, observacoes } = req.body;
      if (!bia_id || !membro_origem_id || !membro_destino_id) {
        return res.status(400).json({ error: "Campos obrigatórios: bia_id, membro_origem_id, membro_destino_id" });
      }
      // Fetch the BIA to check roles
      const bia = await directusFetchOne("bias_projetos", bia_id, "fields=diretor_alianca,aliado_built");
      const biaDiretorAlianca = bia?.diretor_alianca as string | null | undefined;
      const biaAliadoBuilt = bia?.aliado_built as string | null | undefined;
      const isOrigem = sessionMembroId && sessionMembroId === membro_origem_id;
      const isDiretorAlianca = sessionMembroId && biaDiretorAlianca && sessionMembroId === biaDiretorAlianca;
      const isAliadoBuilt = sessionMembroId && biaAliadoBuilt && sessionMembroId === biaAliadoBuilt;
      // Origem, diretor_alianca, aliado_built e admin podem solicitar transferência de qualquer cota
      if (sessionRole !== "admin" && !isOrigem && !isDiretorAlianca && !isAliadoBuilt) {
        return res.status(403).json({ error: "Você não tem permissão para solicitar esta transferência" });
      }
      if (membro_origem_id === membro_destino_id) {
        return res.status(400).json({ error: "Origem e destino não podem ser o mesmo membro" });
      }
      const item = await storage.createTransferenciaCotas({
        bia_id,
        membro_origem_id,
        membro_destino_id,
        valor_total: valor_total != null ? String(valor_total) : null,
        percentual_transferencia: percentual_transferencia != null ? String(percentual_transferencia) : null,
        status: "pendente",
        solicitado_por: sessionDirectusUserId,
        observacoes: observacoes || null,
        motivo_rejeicao: null,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/transferencia-cotas/:id", async (req, res) => {
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const sessionDirectusUserId = (req.session as any).directusUserId;
      const sessionRole = (req.session as any).role || "user";
      if (!sessionDirectusUserId) return res.status(401).json({ error: "Não autenticado" });

      const { action, motivo_rejeicao } = req.body;
      if (!action || !["aceitar", "rejeitar"].includes(action)) {
        return res.status(400).json({ error: "action deve ser 'aceitar' ou 'rejeitar'" });
      }

      const transfer = await storage.getTransferenciaCotas(req.params.id);
      if (!transfer) return res.status(404).json({ error: "Solicitação não encontrada" });
      if (transfer.status !== "pendente") {
        return res.status(400).json({ error: "Solicitação já foi processada" });
      }

      // Fetch the BIA to get diretor_alianca and aliado_built
      const bia = await directusFetchOne("bias_projetos", transfer.bia_id!, "fields=diretor_alianca,aliado_built");
      const biaDiretorAlianca = bia?.diretor_alianca as string | null | undefined;
      const biaAliadoBuilt = bia?.aliado_built as string | null | undefined;

      // Membro de origem cannot accept/reject their own transfer request
      if (sessionMembroId && sessionMembroId === transfer.membro_origem_id) {
        return res.status(403).json({ error: "O membro de origem não pode aceitar ou rejeitar a própria solicitação" });
      }
      // Only diretor_alianca, aliado_built, or admin can approve/reject
      const canProcess =
        sessionRole === "admin" ||
        (sessionMembroId && biaDiretorAlianca && sessionMembroId === biaDiretorAlianca) ||
        (sessionMembroId && biaAliadoBuilt && sessionMembroId === biaAliadoBuilt);
      if (!canProcess) {
        return res.status(403).json({ error: "Sem permissão para processar esta solicitação" });
      }

      if (action === "rejeitar") {
        const updated = await storage.updateTransferenciaCotas(req.params.id, {
          status: "rejeitada",
          motivo_rejeicao: motivo_rejeicao || null,
        });
        return res.json(updated);
      }

      // action === "aceitar": update all Directus fluxo_caixa entradas for this BIA from origem to destino
      const filterParams = [
        `filter[bia][_eq]=${transfer.bia_id}`,
        `filter[tipo][_eq]=entrada`,
        `filter[favorecido_id][_eq]=${transfer.membro_origem_id}`,
        `fields=id`,
      ].join("&");
      const url = `${DIRECTUS_URL}/items/fluxo_caixa?${filterParams}`;
      const fetchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (!fetchRes.ok) {
        const text = await fetchRes.text();
        throw new Error(`Directus fetch error ${fetchRes.status}: ${text}`);
      }
      const fetchJson = await fetchRes.json();
      const entradas: { id: string }[] = fetchJson.data || [];

      for (const entrada of entradas) {
        await directusUpdate("fluxo_caixa", entrada.id, {
          favorecido_id: transfer.membro_destino_id,
        });
      }

      const updated = await storage.updateTransferenciaCotas(req.params.id, {
        status: "aceita",
      });
      res.json({ ...updated, transferidos: entradas.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== COMUNIDADES ==========
  // Explicit fields list — excludes legacy aliado_id/membros_ids/bias_ids; expands M2O (aliado) and M2M (membros, bias)
  const COMUNIDADE_FIELDS =
    "fields=id,nome,sigla,pais,sigla_pais,territorio,sigla_territorio,codigo_sequencial,status,date_created," +
    "aliado.id,aliado.nome,aliado.foto_perfil,aliado.cargo,aliado.empresa," +
    "membros.cadastro_geral_id.id,membros.cadastro_geral_id.nome,membros.cadastro_geral_id.foto_perfil,membros.cadastro_geral_id.cargo,membros.cadastro_geral_id.empresa," +
    "bias.bias_projetos_id.id,bias.bias_projetos_id.nome_bia";

  // Convert frontend payload (aliado_id, membros_ids[], bias_ids[]) to Directus M2O/M2M format
  function toComunidadePayload(body: any) {
    const { aliado_id, membros_ids, bias_ids, ...rest } = body;
    return {
      ...rest,
      ...(aliado_id !== undefined ? { aliado: aliado_id || null } : {}),
      ...(membros_ids !== undefined ? { membros: (membros_ids as string[]).map(id => ({ cadastro_geral_id: id })) } : {}),
      ...(bias_ids !== undefined ? { bias: (bias_ids as string[]).map(id => ({ bias_projetos_id: id })) } : {}),
    };
  }

  app.get("/api/comunidades", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      const all: any[] = await directusFetch(col, COMUNIDADE_FIELDS);
      const membroId = req.query.membro_id as string | undefined;

      let items = all;
      if (membroId) {
        items = all.filter((c: any) => {
          // M2O aliado
          const aId = typeof c.aliado === "string" ? c.aliado : c.aliado?.id;
          if (aId === membroId) return true;
          // M2M membros
          const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
          return membros.some((m: any) => {
            const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
            return id === membroId;
          });
        });
      }

      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comunidades/proximo-codigo", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const { pais, territorio } = req.query as { pais?: string; territorio?: string };
    try {
      const col = await getComunidadeCol();
      const all: any[] = await directusFetch(col, "fields=pais,territorio,codigo_sequencial");
      const same = all.filter((c: any) =>
        c.pais?.toLowerCase() === pais?.toLowerCase() &&
        c.territorio?.toLowerCase() === territorio?.toLowerCase()
      );
      const codes = same.map((c: any) => c.codigo_sequencial).filter(Boolean);
      res.json({ codigo: nextComunidadeCode(codes) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comunidades/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      const url = `${DIRECTUS_URL}/items/${col}/${req.params.id}?${COMUNIDADE_FIELDS}`;
      const r = await fetch(url, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
      if (!r.ok) return res.status(404).json({ error: "Não encontrado" });
      const d = await r.json();
      res.json(d.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comunidades", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      const payload = toComunidadePayload(req.body);

      // Server-side uniqueness: recalculate codigo_sequencial to avoid race conditions on concurrent creation
      if (payload.pais && payload.territorio) {
        const all: any[] = await directusFetch(col, "fields=pais,territorio,codigo_sequencial");
        const same = all.filter((c: any) =>
          c.pais?.toLowerCase() === payload.pais?.toLowerCase() &&
          c.territorio?.toLowerCase() === payload.territorio?.toLowerCase()
        );
        const codes = same.map((c: any) => c.codigo_sequencial).filter(Boolean);
        payload.codigo_sequencial = nextComunidadeCode(codes);
        // Regenerate nome and sigla with guaranteed code
        const { sigla_pais, sigla_territorio } = payload;
        if (sigla_pais && sigla_territorio) {
          payload.sigla = `${sigla_pais.toUpperCase()}-${sigla_territorio.toUpperCase()}-COM-${payload.codigo_sequencial}`;
        }
        payload.nome = `BUILT ${payload.pais} | ${payload.territorio} | Comunidade ${payload.codigo_sequencial}`;
      }

      const created = await directusCreate(col, payload);
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/comunidades/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      const updated = await directusUpdate(col, req.params.id, toComunidadePayload(req.body));
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comunidades/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      await directusDelete(col, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
