import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createUserSchema, updateUserSchema, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS, nucleoTecnicoDocs, aliancaDocs, isValidQuinzena } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import express from "express";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { getStripeClient } from "./stripe";

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

async function ensureCadastroGeralFields() {
  // Fields to expand: [field, type, schema]
  const fieldsToExpand = [
    { field: "nome",          type: "string", schema: { data_type: "varchar", max_length: 500, is_nullable: true } },
    { field: "perfil_aliado", type: "text",   schema: { data_type: "text",    is_nullable: true } },
    { field: "nucleo_alianca",type: "text",   schema: { data_type: "text",    is_nullable: true } },
    { field: "empresa",       type: "string", schema: { data_type: "varchar", max_length: 500, is_nullable: true } },
    { field: "cargo",         type: "string", schema: { data_type: "varchar", max_length: 500, is_nullable: true } },
  ];

  // Get schema snapshot to compare current lengths
  let snapshotFields: any[] = [];
  try {
    const snapshotRes = await fetch(`${DIRECTUS_URL}/schema/snapshot`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (snapshotRes.ok) {
      const snap = await snapshotRes.json();
      snapshotFields = snap?.data?.fields ?? [];
    }
  } catch (_) {}

  for (const { field, type, schema } of fieldsToExpand) {
    try {
      const current = snapshotFields.find((f: any) => f.collection === "cadastro_geral" && f.field === field);
      const currentType = current?.schema?.data_type;
      const currentLen  = current?.schema?.max_length;
      // Skip if already text (unlimited) or already >= 500 varchar
      if (currentType === "text" || (currentType === "varchar" && currentLen != null && currentLen >= 500 && schema.data_type === "varchar")) {
        console.log(`[cadastro_geral] ${field} already OK (${currentType}/${currentLen}), skipping`);
        continue;
      }
      const patchRes = await fetch(`${DIRECTUS_URL}/fields/cadastro_geral/${field}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, schema }),
      });
      const body = await patchRes.json().catch(() => ({}));
      if (patchRes.ok) {
        console.log(`[cadastro_geral] ${field} expanded to ${schema.data_type}${schema.max_length ? `(${schema.max_length})` : ""}`);
      } else {
        console.warn(`[cadastro_geral] ${field} PATCH failed:`, patchRes.status, JSON.stringify(body?.errors?.[0]?.message ?? body));
      }
    } catch (e) {
      console.warn(`[cadastro_geral] ${field} error:`, e);
    }
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
    { field: "ramo_atuacao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Ramo de atuação (cascata)" }, schema: { is_nullable: true } },
    { field: "segmento", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Segmento dentro do ramo de atuação" }, schema: { is_nullable: true } },
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

// Like directusFetch but does NOT prepend fields=* — for targeted queries with explicit fields + filters
async function directusFetchScoped(collection: string, params: string) {
  const url = `${DIRECTUS_URL}/items/${collection}?limit=-1&${params}`;
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

async function directusBulkCreate(collection: string, items: Record<string, any>[]) {
  if (items.length === 0) return [];
  const url = `${DIRECTUS_URL}/items/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus bulk create error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data || [];
}

async function directusBulkPatch(collection: string, ids: (string | number)[], data: Record<string, any>) {
  if (ids.length === 0) return;
  const url = `${DIRECTUS_URL}/items/${collection}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keys: ids, data }),
  });
  if (!res.ok) { /* best effort */ }
}

async function directusBulkDelete(collection: string, ids: (string | number)[]) {
  if (ids.length === 0) return;
  const url = `${DIRECTUS_URL}/items/${collection}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ids),
  });
  if (!res.ok) { /* best effort */ }
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
  // Directus may return 204 No Content or an empty body in some edge cases
  const text = await res.text();
  if (!text) return {};
  try {
    const json = JSON.parse(text);
    return json.data ?? json;
  } catch {
    return {};
  }
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
  const cats = await directusFetchScoped("Categorias", "fields=id,Nome_da_categoria");
  const existing = cats.find((c: any) => c.Nome_da_categoria === "Valor de Origem");
  if (existing) return existing.id;
  const created = await directusCreate("Categorias", { Nome_da_categoria: "Valor de Origem" });
  return created.id;
}

// Cache of category name → id to avoid repeated Directus calls within a sync
let _catCache: Record<string, number> | null = null;
async function findCppCategoriaId(categoryName: string): Promise<number | null> {
  if (!_catCache) {
    const cats = await directusFetchScoped("Categorias", "fields=id,Nome_da_categoria");
    _catCache = {};
    for (const c of cats) {
      if (c.Nome_da_categoria) _catCache[c.Nome_da_categoria.trim()] = c.id;
    }
  }
  return _catCache[categoryName.trim()] ?? null;
}

let _tipoCppCache: Record<string, number> | null = null;
async function findTipoCppId(nome: string): Promise<number | null> {
  if (!_tipoCppCache) {
    try {
      // Use scoped fetch (no fields=*) and try both field name casings
      const tipos = await directusFetchScoped("tipos_cpp", "fields=id,Nome,nome");
      _tipoCppCache = {};
      for (const t of tipos) {
        const n = t.Nome || t.nome;
        if (n) _tipoCppCache[n.trim()] = t.id;
      }
    } catch (err: any) {
      console.warn(`[findTipoCppId] Could not fetch tipos_cpp: ${err.message} — tipo_de_cpp will be empty`);
      _tipoCppCache = {};
    }
  }
  return _tipoCppCache[nome.trim()] ?? null;
}

const CPP_CONTRIBUTOR_CATEGORY: Record<string, string> = {
  "BUILT":               "Direito Econômico Institucional BUILT (DEI-B)",
  "Aliado BUILT":        "Direito Econômico Institucional do Aliado (DEI-A)",
  "Dir. de Aliança":     "Direito Econômico por Liderança de Aliança (DE-LA)",
  "Dir. Núcleo Técnico": "Direito Econômico por Liderança Técnica (DE-LTec)",
  "Dir. Núcleo de Obra": "Direito Econômico por Liderança de Obra (DE-LObr)",
  "Dir. Núcleo Comercial":"Direito Econômico por Liderança Comercial (DE-LCom)",
  "Dir. Núcleo de Capital":"Direito Econômico por Liderança de Capital (DE-LCap)",
};

interface CppContributor {
  label: string;
  memberId: string | null;
  percentual: number;
  alwaysCreate?: boolean;
  isAporte?: boolean;
}

interface SyncCppSummary {
  cppCount: number;
  contributorLabels: string[];
  parcelas: number;
}

async function syncValorOrigemLancamento(
  biaId: string,
  valorOrigem: number,
  vencimento?: string | null,
  numeroParcelas?: number | null,
  vencimentosParcelas?: string[],
  valoresParcelas?: number[],
  contributors?: CppContributor[]
): Promise<SyncCppSummary> {
  const summary: SyncCppSummary = { cppCount: 0, contributorLabels: [], parcelas: 0 };
  const today = new Date().toISOString().split("T")[0];
  const MARCA_BASE = "Valor de Origem da BIA";
  const CPP_MARCA = "CPP";
  const DIVISOR_MARCA = "Divisor Multiplicador";
  const APORTE_MARCA = "Aporte do Fator de Multiplicação";
  _catCache = null;
  _tipoCppCache = null; // reset per-sync so stale IDs are never used

  // Fetch only this BIA's fluxo_caixa entries — server-side filtered, minimal fields
  let existing: any[] = [];
  try {
    const biaEntries = await directusFetchScoped(
      "fluxo_caixa",
      `fields=id,descricao&filter[bia][_eq]=${encodeURIComponent(biaId)}`
    );
    existing = biaEntries.filter((e: any) => {
      const desc = e.descricao || "";
      return desc.includes(MARCA_BASE) || (desc.includes(CPP_MARCA) && desc.includes(biaId)) || desc.startsWith(DIVISOR_MARCA) || desc.startsWith(APORTE_MARCA);
    });
  } catch (fetchErr: any) {
    console.error(`[sync fluxo_caixa] fetch failed: ${fetchErr.message} — skipping cleanup`);
  }

  // Bulk-clear M2M relations then bulk-delete all existing entries (2 API calls regardless of count)
  const existingIds = existing.map((e: any) => e.id);
  if (existingIds.length > 0) {
    await directusBulkPatch("fluxo_caixa", existingIds, { Categoria: [], tipo_de_cpp: [], Favorecido: [], Anexos: [] });
    await directusBulkDelete("fluxo_caixa", existingIds);
  }

  if (valorOrigem <= 0) return summary;

  // Pre-resolve all category/tipo IDs before building the batch (avoids per-entry async calls)
  const catId = await findOrCreateValorOrigemCategoria();
  const contribCatIds: Record<string, number | null> = {};
  let aporteCatId: number | null = null;
  let aporteTipoCppId: number | null = null;
  if (contributors && contributors.length > 0) {
    for (const contrib of contributors) {
      const cppCatName = CPP_CONTRIBUTOR_CATEGORY[contrib.label];
      if (cppCatName && !(cppCatName in contribCatIds)) {
        contribCatIds[cppCatName] = await findCppCategoriaId(cppCatName);
      }
    }
    const hasAporte = contributors.some(c => c.isAporte && c.memberId);
    if (hasAporte) {
      aporteCatId = await findCppCategoriaId("Esforço multiplicador convertido em CPP");
      aporteTipoCppId = await findTipoCppId("CPP de Liderança");
    }
  }

  const isParcelado = numeroParcelas && numeroParcelas > 1;
  summary.parcelas = isParcelado ? numeroParcelas : 1;

  const activeContributorLabels = new Set<string>();
  const entriesToCreate: Record<string, any>[] = [];

  if (isParcelado) {
    const valorParcelaDefault = parseFloat((valorOrigem / numeroParcelas).toFixed(2));
    for (let i = 0; i < numeroParcelas; i++) {
      const dataVencimento = (vencimentosParcelas && vencimentosParcelas[i]) ? vencimentosParcelas[i] : null;
      const valorParcela = (valoresParcelas && valoresParcelas[i] && valoresParcelas[i] > 0)
        ? valoresParcelas[i]
        : valorParcelaDefault;
      entriesToCreate.push({
        bia: biaId,
        tipo: "saida",
        valor: String(valorParcela),
        data: today,
        descricao: `${MARCA_BASE} - Parcela ${i + 1}/${numeroParcelas}`,
        data_vencimento: dataVencimento,
        status: dataVencimento ? "agendado" : "pendente",
        Categoria: [{ categorias_id: catId }],
        tipo_de_cpp: [],
        Favorecido: [],
        Anexos: [],
      });

      if (contributors && contributors.length > 0) {
        for (const contrib of contributors) {
          if (contrib.percentual <= 0) continue;
          if (!contrib.alwaysCreate && !contrib.memberId) continue;
          const valorCpp = parseFloat(((contrib.percentual / 100) * valorParcela).toFixed(2));
          if (valorCpp <= 0) continue;
          const cppCatName = CPP_CONTRIBUTOR_CATEGORY[contrib.label];
          const cppCatId = cppCatName ? (contribCatIds[cppCatName] ?? null) : null;
          entriesToCreate.push({
            bia: biaId,
            tipo: "saida",
            valor: String(valorCpp),
            data: today,
            descricao: `Divisor Multiplicador - Parcela ${i + 1}/${numeroParcelas}`,
            data_vencimento: dataVencimento,
            status: dataVencimento ? "agendado" : "pendente",
            Categoria: cppCatId ? [{ categorias_id: cppCatId }] : [],
            tipo_de_cpp: [],
            favorecido_id: contrib.memberId || null,
            Anexos: [],
          });
          summary.cppCount++;
          activeContributorLabels.add(contrib.label);

          if (contrib.isAporte && contrib.memberId) {
            entriesToCreate.push({
              bia: biaId,
              tipo: "entrada",
              valor: String(valorCpp),
              data: today,
              descricao: `${APORTE_MARCA} - Parcela ${i + 1}/${numeroParcelas}`,
              data_vencimento: dataVencimento,
              status: dataVencimento ? "agendado" : "pendente",
              Categoria: aporteCatId ? [{ categorias_id: aporteCatId }] : [],
              tipo_de_cpp: aporteTipoCppId ? [{ tipos_cpp_id: aporteTipoCppId }] : [],
              favorecido_id: contrib.memberId,
              Anexos: [],
            });
          }
        }
      }
    }
  } else {
    const dataVencimento = vencimento || null;
    const statusEntry = dataVencimento ? "agendado" : "pendente";
    entriesToCreate.push({
      bia: biaId,
      tipo: "saida",
      valor: String(valorOrigem),
      data: today,
      descricao: MARCA_BASE,
      data_vencimento: dataVencimento,
      status: statusEntry,
      Categoria: [{ categorias_id: catId }],
      tipo_de_cpp: [],
      Favorecido: [],
      Anexos: [],
    });

    if (contributors && contributors.length > 0) {
      for (const contrib of contributors) {
        if (contrib.percentual <= 0) continue;
        if (!contrib.alwaysCreate && !contrib.memberId) continue;
        const valorCpp = parseFloat(((contrib.percentual / 100) * valorOrigem).toFixed(2));
        if (valorCpp <= 0) continue;
        const cppCatName = CPP_CONTRIBUTOR_CATEGORY[contrib.label];
        const cppCatId = cppCatName ? (contribCatIds[cppCatName] ?? null) : null;
        entriesToCreate.push({
          bia: biaId,
          tipo: "saida",
          valor: String(valorCpp),
          data: today,
          descricao: `Divisor Multiplicador - Parcela 1/1`,
          data_vencimento: dataVencimento,
          status: statusEntry,
          Categoria: cppCatId ? [{ categorias_id: cppCatId }] : [],
          tipo_de_cpp: [],
          favorecido_id: contrib.memberId || null,
          Anexos: [],
        });
        summary.cppCount++;
        activeContributorLabels.add(contrib.label);

        if (contrib.isAporte && contrib.memberId) {
          entriesToCreate.push({
            bia: biaId,
            tipo: "entrada",
            valor: String(valorCpp),
            data: today,
            descricao: `${APORTE_MARCA} - Parcela 1/1`,
            data_vencimento: dataVencimento,
            status: statusEntry,
            Categoria: aporteCatId ? [{ categorias_id: aporteCatId }] : [],
            tipo_de_cpp: aporteTipoCppId ? [{ tipos_cpp_id: aporteTipoCppId }] : [],
            favorecido_id: contrib.memberId,
            Anexos: [],
          });
        }
      }
    }
  }

  // Single bulk create call for all entries
  await directusBulkCreate("fluxo_caixa", entriesToCreate);

  summary.contributorLabels = Array.from(activeContributorLabels);
  return summary;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif",
      ".doc", ".docx", ".xls", ".xlsx", ".heic", ".heif",
      ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v",
      ".zip", ".rar", ".7z",
      ".ppt", ".pptx",
    ];
    const allowedMime = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm", "video/x-m4v",
      "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
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

function abbrevTerritoryServer(nome: string): string {
  const words = nome.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w: string) => w[0]).join("").slice(0, 4).toUpperCase();
  }
  return nome.replace(/[aeiouAEIOU\s]/g, "").slice(0, 3).toUpperCase() ||
    nome.slice(0, 3).toUpperCase();
}

function uniqueSiglaTerritorio(territorio: string, pais: string, allCommunities: any[]): string {
  const paisLower = pais.trim().toLowerCase();
  const territorioLower = territorio.trim().toLowerCase();

  const usedByOthers = new Set(
    allCommunities
      .filter((c: any) =>
        c.pais?.trim().toLowerCase() === paisLower &&
        c.territorio?.trim().toLowerCase() !== territorioLower
      )
      .map((c: any) => c.sigla_territorio?.toUpperCase())
      .filter(Boolean)
  );

  const words = territorio.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);

  const candidates: string[] = [];

  // 1) initials
  if (words.length >= 2) {
    candidates.push(words.map((w: string) => w[0]).join("").slice(0, 4).toUpperCase());
  } else {
    candidates.push(
      territorio.replace(/[aeiouAEIOU\s]/g, "").slice(0, 3).toUpperCase() ||
      territorio.slice(0, 3).toUpperCase()
    );
  }

  // 2) first 2 chars of each word
  if (words.length >= 2) {
    candidates.push(words.map((w: string) => w.slice(0, 2)).join("").slice(0, 4).toUpperCase());
  }

  // 3) first 3 chars of each word
  if (words.length >= 2) {
    candidates.push(words.map((w: string) => w.slice(0, 3)).join("").slice(0, 6).toUpperCase());
  }

  // 4) consonants of first word
  const consonants = words[0]?.replace(/[aeiouAEIOU]/g, "").slice(0, 4).toUpperCase() || "";
  if (consonants.length >= 2) candidates.push(consonants);

  // 5) first 4 chars of first word
  if (words[0]) candidates.push(words[0].slice(0, 4).toUpperCase());

  for (const c of candidates) {
    if (!usedByOthers.has(c)) return c;
  }

  // fallback: numeric suffix on base
  const base = candidates[0] || abbrevTerritoryServer(territorio);
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`;
    if (!usedByOthers.has(candidate)) return candidate;
  }

  return base;
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
  ensureCadastroGeralFields().catch(console.error);
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
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
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

  // Single vitrine member — accessible to all authenticated users
  app.get("/api/vitrine/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const fields = "id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.id,Especialidades.especialidades_id.nome_especialidade";
      const m = await directusFetchOne("cadastro_geral", req.params.id, `fields=${fields}`);
      if (!m) return res.status(404).json({ error: "Membro não encontrado" });
      const espArr = Array.isArray(m.Especialidades) ? m.Especialidades : [];
      const firstEsp = espArr[0]?.especialidades_id;
      res.json({
        ...m,
        cargo: m.cargo || m.responsavel_cargo || null,
        foto: m.foto_perfil || null,
        especialidade_id: (typeof firstEsp === "object" ? firstEsp?.id : null) ?? null,
        especialidade: (typeof firstEsp === "object" ? firstEsp?.nome_especialidade : null) ?? null,
        latitude: m.latitude ? parseFloat(m.latitude) : null,
        longitude: m.longitude ? parseFloat(m.longitude) : null,
      });
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
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
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

  // ========== PARCEIROS CAPITAL ==========
  app.get("/api/parceiros-capital", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,perfil_aliado,nucleo_alianca,ramo_atuacao,segmento,latitude,longitude,link_site,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade&filter[em_built_capital][_eq]=true`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!response.ok) throw new Error(`Directus error: ${response.status}`);
      const json = await response.json();
      const items = (json.data || []).map((m: any) => {
        const especialidades = (m.Especialidades || [])
          .map((e: any) => e?.especialidades_id?.nome_especialidade)
          .filter(Boolean);
        return {
          ...m,
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

  // ========== ASSETS PROXY (Directus images with auth) ==========
  app.get("/api/assets/:id", async (req, res) => {
    try {
      const assetUrl = `${DIRECTUS_URL}/assets/${req.params.id}`;
      const upstream = await fetch(assetUrl, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (!upstream.ok) return res.status(upstream.status).end();
      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== ANÚNCIOS ==========
  async function enrichAnuncio(a: any) {
    let membro: any = null;
    try {
      const r = await fetch(
        `${DIRECTUS_URL}/items/cadastro_geral/${a.membro_id}?fields=id,nome,empresa,foto_perfil,cargo`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } }
      );
      if (r.ok) {
        const j = await r.json();
        membro = j.data || null;
      }
    } catch {}
    return {
      ...a,
      membro_nome: membro?.nome || null,
      membro_empresa: membro?.empresa || null,
      membro_foto: membro?.foto_perfil ? `/api/assets/${membro.foto_perfil}` : null,
      imagem_url: a.imagem_directus_id ? `/api/assets/${a.imagem_directus_id}` : null,
    };
  }

  app.get("/api/anuncios", async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ativos = await storage.getAnunciosAtivos(today);
      const enriched = await Promise.all(ativos.map(enrichAnuncio));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/anuncios/disponibilidade", async (req, res) => {
    try {
      const meses = Math.min(6, Math.max(1, parseInt(String(req.query.meses || "3"))));
      const data = await storage.getAnunciosDisponibilidade(meses);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/anuncios/mine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      if (!membroId) return res.json([]);
      const lista = await storage.getAnunciosByMembro(membroId);
      const enriched = await Promise.all(lista.map(enrichAnuncio));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/anuncios", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      if (!membroId) return res.status(400).json({ error: "Perfil de membro não vinculado" });

      const { titulo, descricao, link, imagem_directus_id, data_inicio, data_fim } = req.body;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: "data_inicio e data_fim são obrigatórios" });

      if (!isValidQuinzena(data_inicio, data_fim)) {
        return res.status(400).json({ error: "O período deve ser uma quinzena válida: dias 1–15 ou 16–último dia do mês" });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (data_fim < today) {
        return res.status(400).json({ error: "O período selecionado já passou. Escolha uma quinzena futura." });
      }

      const hasConflito = await storage.hasAnuncioByMembroInPeriod(membroId, data_inicio, data_fim);
      if (hasConflito) return res.status(409).json({ error: "Você já tem um anúncio neste período. Escolha outra quinzena." });

      const count = await storage.countAnunciosByPeriod(data_inicio, data_fim);
      if (count >= 6) return res.status(409).json({ error: "Período lotado — escolha outro período" });

      const anuncio = await storage.createAnuncio({
        membro_id: membroId,
        titulo: titulo || "",
        descricao: descricao || null,
        link: link || null,
        imagem_directus_id: imagem_directus_id || null,
        data_inicio,
        data_fim,
        ativo: true,
      });
      res.json(await enrichAnuncio(anuncio));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/anuncios/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      const role = (req.session as any).role;
      const anuncio = await storage.getAnuncioById(req.params.id);
      if (!anuncio) return res.status(404).json({ error: "Anúncio não encontrado" });
      if (anuncio.membro_id !== membroId && role !== "admin") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      const { titulo, descricao, link, imagem_directus_id } = req.body;
      const updated = await storage.updateAnuncio(req.params.id, {
        ...(titulo !== undefined && { titulo }),
        ...(descricao !== undefined && { descricao }),
        ...(link !== undefined && { link }),
        ...(imagem_directus_id !== undefined && { imagem_directus_id }),
      });
      res.json(await enrichAnuncio(updated));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/anuncios/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      const role = (req.session as any).role;
      const anuncio = await storage.getAnuncioById(req.params.id);
      if (!anuncio) return res.status(404).json({ error: "Anúncio não encontrado" });
      if (anuncio.membro_id !== membroId && role !== "admin") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      await storage.deleteAnuncio(req.params.id);
      res.json({ success: true });
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
  // Helper: resolve effective role by checking session + local users DB
  async function getEffectiveRole(req: any): Promise<string> {
    const sessionRole = (req.session as any).role || "user";
    if (sessionRole === "admin" || sessionRole === "manager") return sessionRole;
    const email = (req.session as any).email || "";
    if (email) {
      try {
        const localUser = await storage.getUserByEmail(email);
        if (localUser && localUser.ativo) return localUser.role || sessionRole;
      } catch (_) {}
    }
    return sessionRole;
  }

  // Helper: check if the session role allows full Cadastro Geral access (Super Admin only)
  async function requireCadastroAccess(req: any, res: any): Promise<boolean> {
    const role = await getEffectiveRole(req);
    if (role === "admin") return true;
    res.status(403).json({ error: "Acesso restrito a Super Administradores." });
    return false;
  }

  // Helper: allow if Super Admin OR if user is accessing their own membro record
  async function requireCadastroOrOwn(req: any, res: any): Promise<boolean> {
    const role = await getEffectiveRole(req);
    if (role === "admin") return true;
    const sessionMembroId = (req.session as any).membroId as string | null;
    if (sessionMembroId && req.params.id === sessionMembroId) return true;
    res.status(403).json({ error: "Acesso restrito a Super Administradores." });
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
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
    if (!await requireCadastroAccess(req, res)) return;
    try {
      // Check for duplicate email before creating
      const emailInput: string = (req.body.email || "").trim().toLowerCase();
      if (emailInput) {
        const existing = await directusFetch(
          "cadastro_geral",
          `filter[email][_eq]=${encodeURIComponent(emailInput)}&limit=1&fields=id,email`
        );
        if (existing && existing.length > 0) {
          return res.status(409).json({ error: "Já existe um membro cadastrado com este e-mail." });
        }
      }
      const item = await directusCreate("cadastro_geral", req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/membros/:id", async (req, res) => {
    if (!await requireCadastroOrOwn(req, res)) return;
    try {
      // Strip client-side computed and relational fields that must not be sent to Directus as plain PATCH
      // Especialidades is a M2M junction — sending the full junction object array breaks the update silently
      const STRIP_FIELDS = ["Especialidades", "especialidades", "especialidade", "foto", "_nome", "cargo_computed"];
      const payload = Object.fromEntries(
        Object.entries(req.body).filter(([key]) => !STRIP_FIELDS.includes(key))
      );

      // Non-superadmins cannot modify BUILT_ seals
      const sessionRole = (req.session as any).role || "user";
      if (sessionRole !== "admin" && payload.Outras_redes_as_quais_pertenco !== undefined) {
        // Fetch current BUILT_ seals and preserve them
        const current = await directusFetchOne("cadastro_geral", req.params.id, "fields=Outras_redes_as_quais_pertenco");
        const currentRedes: string[] = Array.isArray(current?.Outras_redes_as_quais_pertenco) ? current.Outras_redes_as_quais_pertenco : [];
        const currentBuilt = currentRedes.filter((r: string) => r.startsWith("BUILT_"));
        const incomingNonBuilt = (Array.isArray(payload.Outras_redes_as_quais_pertenco) ? payload.Outras_redes_as_quais_pertenco as string[] : [])
          .filter((r: string) => !r.startsWith("BUILT_"));
        payload.Outras_redes_as_quais_pertenco = [...currentBuilt, ...incomingNonBuilt];
      }

      // Sanitize numeric fields: convert empty strings to null so Directus doesn't reject them
      const NUMERIC_FIELDS = ["latitude", "longitude"];
      for (const f of NUMERIC_FIELDS) {
        if (f in payload) {
          const v = payload[f];
          if (v === "" || v === null || v === undefined) {
            payload[f] = null;
          } else {
            const n = parseFloat(v);
            payload[f] = isNaN(n) ? null : n;
          }
        }
      }

      console.log(`[membros PATCH ${req.params.id}] fields:`, Object.keys(payload));
      const item = await directusUpdate("cadastro_geral", req.params.id, payload);
      res.json(item);
    } catch (error: any) {
      console.error(`[membros PATCH ${req.params.id}] error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      await directusDelete("cadastro_geral", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/membros/:id/comunidade — find which community this member belongs to
  app.get("/api/membros/:id/comunidade", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const col = await getComunidadeCol();
      const memberId = req.params.id;
      // Fetch all communities with their members (uses the working M2M alias)
      const allUrl = `${DIRECTUS_URL}/items/${col}?fields=id,nome,sigla,membros.cadastro_geral_id&limit=200`;
      const ar = await fetch(allUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!ar.ok) return res.json(null);
      const aData = await ar.json();
      const comunidades: any[] = aData.data || [];
      const found = comunidades.find((c: any) => {
        const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
        return membros.some((m: any) => {
          const cgId = typeof m.cadastro_geral_id === "object" ? m.cadastro_geral_id?.id : m.cadastro_geral_id;
          return cgId === memberId;
        });
      });
      res.json(found ? { id: found.id, nome: found.nome, sigla: found.sigla } : null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/membros/:id/convidador — who invited this member (via vitrine invite link)
  app.get("/api/membros/:id/convidador", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const candidatoId = req.params.id;
      const convites = await storage.getConvitesByCandidato(candidatoId);
      const vitrineConvite = convites.find((c: any) => c.tipo === "vitrine" && c.invitador_membro_id);
      if (!vitrineConvite?.invitador_membro_id) return res.json(null);
      const invitador = await getDirectusMembro(vitrineConvite.invitador_membro_id).catch(() => null);
      if (!invitador) return res.json(null);
      res.json({ id: invitador.id, nome: invitador.nome || invitador.Nome_de_usuario || "Membro BUILT" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/membros/:id/comunidade — assign member to a community (and remove from old one)
  app.post("/api/membros/:id/comunidade", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const membroId = req.params.id;
      const { comunidade_id, old_comunidade_id } = req.body;
      const col = await getComunidadeCol();

      // Remove from old community if different
      if (old_comunidade_id && old_comunidade_id !== comunidade_id) {
        const oldUrl = `${DIRECTUS_URL}/items/${col}/${old_comunidade_id}?fields=id,membros.cadastro_geral_id`;
        const oldR = await fetch(oldUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        if (oldR.ok) {
          const oldData = await oldR.json();
          const filtered = (oldData.data?.membros || [])
            .map((m: any) => typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id)
            .filter((id: any) => id && id !== membroId)
            .map((id: string) => ({ cadastro_geral_id: id }));
          await fetch(`${DIRECTUS_URL}/items/${col}/${old_comunidade_id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ membros: filtered }),
          });
        }
      }

      // Add to new community
      if (comunidade_id) {
        const newUrl = `${DIRECTUS_URL}/items/${col}/${comunidade_id}?fields=id,membros.cadastro_geral_id`;
        const newR = await fetch(newUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        const newData = newR.ok ? await newR.json() : { data: { membros: [] } };
        const currentIds: { cadastro_geral_id: string }[] = (newData.data?.membros || [])
          .map((m: any) => typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id)
          .filter(Boolean)
          .map((id: string) => ({ cadastro_geral_id: id }));
        if (!currentIds.some((m) => m.cadastro_geral_id === membroId)) {
          currentIds.push({ cadastro_geral_id: membroId });
        }
        await fetch(`${DIRECTUS_URL}/items/${col}/${comunidade_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ membros: currentIds }),
        });
      }

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

  app.get("/api/dashboard", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const membroId = (req.session as any).membroId as string | null;

      // Security: if the user has no linked Directus member profile, return empty scoped data
      if (!membroId) {
        return res.json({
          bias: [],
          comunidades: [],
          opas: [],
          totals: { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 },
          opas_abertas: 0,
        });
      }

      const BIA_ROLE_FIELDS = [
        "autor_bia", "aliado_built", "diretor_alianca", "diretor_nucleo_tecnico",
        "diretor_execucao", "diretor_comercial", "diretor_capital",
      ];

      const [allBias, allOpas, comunidades] = await Promise.all([
        directusFetchScoped("bias_projetos",
          "fields=id,nome_bia,situacao,localizacao,valor_origem,custo_final_previsto,resultado_liquido,moeda," +
          "autor_bia,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital"
        ),
        directusFetchScoped("tipos_oportunidades",
          "fields=id,nome_oportunidade,tipo,bia_id,valor_origem_opa,status"
        ).catch(() => []),
        directusFetch(await getComunidadeCol(), COMUNIDADE_FIELDS).catch(() => []),
      ]);

      const userBias = (allBias as any[]).filter(b =>
        BIA_ROLE_FIELDS.some(role => b[role] === membroId)
      );

      const userBiaIds = new Set(userBias.map((b: any) => b.id));
      const biaNameMap: Record<string, string> = {};
      for (const b of userBias) biaNameMap[b.id] = b.nome_bia || b.id;

      const userOpas = (allOpas as any[])
        .filter((o: any) => userBiaIds.has(o.bia_id))
        .map((o: any) => ({
          ...o,
          nome_bia_vinculada: biaNameMap[o.bia_id] || null,
        }));

      const CLOSED_STATUSES = new Set(["concluida", "desistencia"]);
      const opasAbertas = userOpas.filter((o: any) => !CLOSED_STATUSES.has(o.status)).length;

      const userComunidades = (comunidades as any[]).filter((c: any) => {
        const aId = typeof c.aliado === "string" ? c.aliado : c.aliado?.id;
        if (aId === membroId) return true;
        const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
        return membros.some((m: any) => {
          const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
          return id === membroId;
        });
      });

      function n(v: any) { return parseFloat(String(v ?? "")) || 0; }

      const totals = userBias.reduce(
        (acc: any, b: any) => ({
          valor_origem: acc.valor_origem + n(b.valor_origem),
          custo_final_previsto: acc.custo_final_previsto + n(b.custo_final_previsto),
          resultado_liquido: acc.resultado_liquido + n(b.resultado_liquido),
        }),
        { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 }
      );

      const biaRoleMap: Record<string, string> = {
        aliado_built: "Aliado BUILT",
        autor_bia: "Autor da BIA",
        diretor_alianca: "Dir. de Aliança",
        diretor_nucleo_tecnico: "Dir. Núcleo Técnico",
        diretor_execucao: "Dir. de Execução",
        diretor_comercial: "Dir. Comercial",
        diretor_capital: "Dir. de Capital",
      };

      const biasWithRole = userBias.map((b: any) => {
        const papel = BIA_ROLE_FIELDS.find(role => b[role] === membroId);
        return { ...b, papel_usuario: papel ? biaRoleMap[papel] : "Membro" };
      });

      res.json({
        bias: biasWithRole,
        comunidades: userComunidades,
        opas: userOpas,
        totals,
        opas_abertas: opasAbertas,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
    // Strip private side-channel fields (prefixed with _) before sending to Directus
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => !k.startsWith("_")));
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
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const sessionNome = (req.session as any).nome as string || "";
      const sessionEmail = (req.session as any).email as string || "";

      let isAliadoBuilt = sessionRole === "admin" || sessionRole === "manager";
      let isDiretorAlianca = false;
      let canCreate = isAliadoBuilt;

      if (!canCreate && sessionMembroId) {
        try {
          const membro = await directusFetchOne("cadastro_geral", sessionMembroId, "fields=tipos_alianca,Outras_redes_as_quais_pertenco");
          if (membro) {
            const redes: string[] = Array.isArray(membro.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : [];
            const tiposAlianca: string[] = Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : [];
            if (redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER")) {
              isAliadoBuilt = true;
              canCreate = true;
            }
            if (tiposAlianca.includes("Liderança")) {
              isDiretorAlianca = true;
              canCreate = true;
            }
          }
        } catch (_) {}
        if (!canCreate) {
          try {
            const biaCheck = await directusFetch("bias_projetos", `filter[aliado_built][_eq]=${sessionMembroId}&limit=1&fields=id`);
            if (biaCheck.length > 0) { isAliadoBuilt = true; canCreate = true; }
          } catch (_) {}
        }
        if (!canCreate) {
          try {
            const col = await getComunidadeCol();
            const comunidadeCheck = await directusFetch(col, `filter[aliado][_eq]=${sessionMembroId}&limit=1&fields=id`);
            if (comunidadeCheck.length > 0) { isAliadoBuilt = true; canCreate = true; }
          } catch (_) {}
        }
      }

      if (!canCreate) {
        return res.status(403).json({ error: "Apenas membros com Selo Aliado BUILT, Área de Contribuição Liderança ou administradores podem criar BIAs." });
      }

      // Create the BIA in Directus
      const item = await directusCreate("bias_projetos", prepareBiaPayload(req.body));
      const valorOrigem = parseFloat(req.body.valor_origem) || 0;
      if (valorOrigem > 0) {
        syncValorOrigemLancamento(item.id, valorOrigem).catch(console.error);
      }

      // If Diretor de Aliança (not Aliado BUILT), create pending approval record
      if (isDiretorAlianca && !isAliadoBuilt && sessionMembroId) {
        try {
          const col = await getComunidadeCol();

          // Find the director's community and its Aliado BUILT
          let comunidadeId: string | null = null;
          let comunidadeNome: string | null = null;
          let aliadoBuiltId: string | null = null;
          let aliadoBuiltEmail: string | null = null;
          let aliadoBuiltNome: string | null = null;

          try {
            const comunidades = await directusFetch(col, `filter[membros][cadastro_geral_id][_eq]=${sessionMembroId}&fields=id,nome,aliado.id,aliado.nome,aliado.email&limit=1`);
            if (comunidades[0]) {
              comunidadeId = String(comunidades[0].id);
              comunidadeNome = comunidades[0].nome || null;
              const aliado = comunidades[0].aliado;
              if (aliado && typeof aliado === "object") {
                aliadoBuiltId = aliado.id || null;
                aliadoBuiltEmail = aliado.email || null;
                aliadoBuiltNome = aliado.nome || null;
              }
            }
          } catch (_) {}

          const aprovacao = await storage.createBiaAprovacao({
            bia_id: item.id,
            bia_nome: item.nome_bia || req.body.nome_bia || null,
            status: "pendente",
            solicitante_membro_id: sessionMembroId,
            solicitante_nome: sessionNome || null,
            solicitante_email: sessionEmail || null,
            aliado_built_membro_id: aliadoBuiltId,
            aliado_built_email: aliadoBuiltEmail,
            aliado_built_nome: aliadoBuiltNome,
            comunidade_id: comunidadeId,
            comunidade_nome: comunidadeNome,
            motivo_rejeicao: null,
          });

          // Notify Aliado BUILT by email (fire and forget)
          if (aliadoBuiltEmail) {
            const { enviarSolicitacaoBiaParaAliado } = await import("./mailer");
            enviarSolicitacaoBiaParaAliado({
              aliadoEmail: aliadoBuiltEmail,
              aliadoNome: aliadoBuiltNome || "Aliado BUILT",
              diretorNome: sessionNome,
              biaNome: aprovacao.bia_nome || item.id,
              comunidadeNome: comunidadeNome || "sua comunidade",
              aprovacaoId: aprovacao.id,
            }).catch((e: any) => console.error("[bia-aprovacao] email error:", e.message));
          }

          console.log(`[bia-aprovacao] Pending approval created for BIA ${item.id}, aliado: ${aliadoBuiltEmail || "not found"}`);
          return res.json({ ...item, _aprovacao_pendente: true, _aprovacao_id: aprovacao.id });
        } catch (aprovErr: any) {
          console.error("[bia-aprovacao] Failed to create approval record:", aprovErr.message);
          // BIA was created — return it even if approval record failed
        }
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
            const vencimentoOrigem = req.body._vencimento_origem || null;
            const numeroParcelas = req.body._numero_parcelas ? parseInt(req.body._numero_parcelas) : null;
            const vencimentosParcelas: string[] = Array.isArray(req.body._vencimentos_parcelas) ? req.body._vencimentos_parcelas : [];
            const valoresParcelas: number[] = Array.isArray(req.body._valores_parcelas) ? req.body._valores_parcelas.map(Number) : [];
            // Build contributors list for CPP entries
            const contributors: CppContributor[] = [
              { label: "Aliado BUILT", memberId: req.body.aliado_built || null, percentual: parseFloat(req.body.perc_aliado_built) || 0 },
              { label: "BUILT", memberId: req.body.aliado_built || null, percentual: parseFloat(req.body.perc_built) || 0, alwaysCreate: true },
              { label: "Dir. de Aliança", memberId: req.body.diretor_alianca || null, percentual: parseFloat(req.body.perc_dir_alianca) || 0, isAporte: true },
              { label: "Dir. Núcleo Técnico", memberId: req.body.diretor_nucleo_tecnico || null, percentual: parseFloat(req.body.perc_dir_tecnico) || 0, isAporte: true },
              { label: "Dir. Núcleo de Obra", memberId: req.body.diretor_execucao || null, percentual: parseFloat(req.body.perc_dir_obras) || 0, isAporte: true },
              { label: "Dir. Núcleo Comercial", memberId: req.body.diretor_comercial || null, percentual: parseFloat(req.body.perc_dir_comercial) || 0, isAporte: true },
              { label: "Dir. Núcleo de Capital", memberId: req.body.diretor_capital || null, percentual: parseFloat(req.body.perc_dir_capital) || 0, isAporte: true },
            ];
            try {
              const cppSummary = await syncValorOrigemLancamento(req.params.id, valorOrigem, vencimentoOrigem, numeroParcelas, vencimentosParcelas, valoresParcelas, contributors);
              return res.json({ ...item, _cppSummary: cppSummary });
            } catch (syncErr: any) {
              console.error("[sync fluxo_caixa] error:", syncErr.message);
              return res.json({ ...item, _cppSummary: null, _cppError: syncErr.message });
            }
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

  // GET /api/bias/:id/aportes — returns "Aporte do Fator de Multiplicação" fluxo_caixa entries for a BIA
  app.get("/api/bias/:id/aportes", async (req, res) => {
    try {
      const biaId = req.params.id;
      // Filter by BIA server-side to avoid loading all fluxo_caixa entries;
      // description prefix filter applied in-memory (Directus bracket filters are BIA-scoped here)
      const entries = await directusFetch(
        "fluxo_caixa",
        `filter[bia][_eq]=${encodeURIComponent(biaId)}&fields=id,bia,descricao,valor,data_vencimento,status,favorecido_id.id,favorecido_id.nome,favorecido_id.Nome_de_usuario`
      );
      const aportes = entries.filter(
        (e: any) => (e.descricao || "").startsWith("Aporte do Fator de Multiplicação")
      );
      res.json(aportes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIA APROVAÇÕES ==========

  // GET /api/bia-aprovacoes — list pending approvals visible to the current user
  app.get("/api/bia-aprovacoes", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      let items;
      if (sessionRole === "admin" || sessionRole === "manager") {
        items = await storage.getBiaAprovacoesPendentes();
      } else if (sessionMembroId) {
        items = await storage.getBiaAprovacoesParaAliado(sessionMembroId);
      } else {
        items = [];
      }
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/bia-aprovacoes/minha — approvals created BY the current user (Diretor)
  app.get("/api/bia-aprovacoes/minha", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      if (!sessionMembroId) return res.json([]);
      const all = await storage.getAllBiaAprovacoes();
      const mine = all.filter(a => a.solicitante_membro_id === sessionMembroId);
      res.json(mine);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/bia-aprovacoes/:id/aprovar — Aliado BUILT approves the BIA
  app.patch("/api/bia-aprovacoes/:id/aprovar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const aprovacao = await storage.getBiaAprovacaoById(req.params.id);
      if (!aprovacao) return res.status(404).json({ error: "Aprovação não encontrada" });
      if (aprovacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitação já foi processada" });

      // Only admin, manager, or the designated Aliado BUILT can approve
      const isAdmin = sessionRole === "admin" || sessionRole === "manager";
      const isAliado = sessionMembroId && aprovacao.aliado_built_membro_id === sessionMembroId;
      if (!isAdmin && !isAliado) return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade ou admin pode aprovar" });

      await storage.updateBiaAprovacao(aprovacao.id, { status: "aprovado" });

      // Notify the director by email (fire and forget)
      if (aprovacao.solicitante_email) {
        const { enviarResultadoAprovacaoBia } = await import("./mailer");
        enviarResultadoAprovacaoBia({
          diretorEmail: aprovacao.solicitante_email,
          diretorNome: aprovacao.solicitante_nome || "Diretor",
          biaNome: aprovacao.bia_nome || aprovacao.bia_id,
          aprovado: true,
        }).catch((e: any) => console.error("[bia-aprovacao] email error:", e.message));
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/bia-aprovacoes/:id/rejeitar — Aliado BUILT rejects the BIA
  app.patch("/api/bia-aprovacoes/:id/rejeitar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const aprovacao = await storage.getBiaAprovacaoById(req.params.id);
      if (!aprovacao) return res.status(404).json({ error: "Aprovação não encontrada" });
      if (aprovacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitação já foi processada" });

      const isAdmin = sessionRole === "admin" || sessionRole === "manager";
      const isAliado = sessionMembroId && aprovacao.aliado_built_membro_id === sessionMembroId;
      if (!isAdmin && !isAliado) return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade ou admin pode rejeitar" });

      const motivo = req.body?.motivo || null;
      await storage.updateBiaAprovacao(aprovacao.id, { status: "rejeitado", motivo_rejeicao: motivo });

      // Notify the director
      if (aprovacao.solicitante_email) {
        const { enviarResultadoAprovacaoBia } = await import("./mailer");
        enviarResultadoAprovacaoBia({
          diretorEmail: aprovacao.solicitante_email,
          diretorNome: aprovacao.solicitante_nome || "Diretor",
          biaNome: aprovacao.bia_nome || aprovacao.bia_id,
          aprovado: false,
          motivo: motivo || undefined,
        }).catch((e: any) => console.error("[bia-aprovacao] email error:", e.message));
      }

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
      const multiplicador = req.body.multiplicador != null ? String(req.body.multiplicador) : null;
      const item = await storage.createOpaInteresse({
        opa_id: id,
        user_id: directusUserId,
        membro_id: membroId || null,
        membro_nome: nome || directusUserId,
        mensagem: req.body.mensagem || null,
        multiplicador,
      });
      res.json(item);

      // Fire-and-forget: notify Diretor de Aliança and Aliado BUILT of linked BIA
      (async () => {
        try {
          const { notificarInteresseOpa } = await import("./mailer");
          // Fetch the OPA to get bia_id and name
          const opa = await directusFetchOne("tipos_oportunidades", id, "fields=nome_oportunidade,bia_id");
          const biaId = opa?.bia_id as string | null | undefined;
          const opaNome = (opa?.nome_oportunidade as string) || "OPA";
          if (!biaId) return;
          // Fetch the BIA to get roles and name
          const bia = await directusFetchOne("bias_projetos", biaId, "fields=nome_bia,diretor_alianca,aliado_built");
          const biaNome = (bia?.nome_bia as string) || "BIA";
          const diretorId = bia?.diretor_alianca as string | null | undefined;
          const aliadoId = bia?.aliado_built as string | null | undefined;

          async function fetchMemberEmail(mid: string): Promise<{ email: string; nome: string } | null> {
            try {
              const m = await directusFetchOne("cadastro_geral", mid, "fields=email,nome");
              if (m?.email) return { email: m.email as string, nome: (m.nome as string) || mid };
            } catch {}
            return null;
          }

          const membroNome = nome || "Membro";
          const msgBody = req.body.mensagem || null;

          if (diretorId) {
            const m = await fetchMemberEmail(diretorId);
            if (m) {
              await notificarInteresseOpa({
                destinatarioEmail: m.email,
                destinatarioNome: m.nome,
                papel: "Diretor de Aliança",
                membroNome,
                membroId: membroId || null,
                opaNome,
                biaNome,
                mensagem: msgBody,
                multiplicador,
              });
            }
          }

          if (aliadoId && aliadoId !== diretorId) {
            const m = await fetchMemberEmail(aliadoId);
            if (m) {
              await notificarInteresseOpa({
                destinatarioEmail: m.email,
                destinatarioNome: m.nome,
                papel: "Aliado BUILT",
                membroNome,
                membroId: membroId || null,
                opaNome,
                biaNome,
                mensagem: msgBody,
                multiplicador,
              });
            }
          }
        } catch (notifErr: any) {
          console.error("[interesse-opa] Notification error:", notifErr?.message || notifErr);
        }
      })();
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

  // ========== AI PARSE PAYMENT SCHEDULE ==========
  app.post("/api/parse-pagamento-file", upload.single("file"), async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      let textContent = "";
      const mime = file.mimetype;
      const ext = (file.originalname || "").toLowerCase().split(".").pop() || "";

      if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet") || mime.includes("excel")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(file.buffer, { type: "buffer" });
        const lines: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          lines.push(`[Planilha: ${sheetName}]\n${csv}`);
        }
        textContent = lines.join("\n\n");
      } else if (ext === "csv" || mime.includes("csv") || mime.includes("text/plain")) {
        textContent = file.buffer.toString("utf-8");
      } else if (ext === "pdf" || mime.includes("pdf")) {
        try {
          // pdf-parse v2 API: PDFParse class with { data: Buffer }
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: file.buffer });
          const result = await parser.getText();
          textContent = result.text;
        } catch (pdfErr: any) {
          console.error("[parse-pagamento-file] pdf error:", pdfErr?.message || pdfErr);
          return res.status(422).json({ error: "Não foi possível ler o PDF. Tente um Excel ou CSV." });
        }
      } else {
        textContent = file.buffer.toString("utf-8");
      }

      if (!textContent.trim()) {
        return res.status(422).json({ error: "Não foi possível extrair texto do arquivo." });
      }

      // Truncate to avoid token limits
      if (textContent.length > 15000) textContent = textContent.slice(0, 15000) + "\n[... truncado ...]";

      const prompt = `Analise o documento abaixo e extraia o cronograma de pagamentos/parcelas.
Retorne SOMENTE um JSON minificado (sem espaços extras, sem quebras de linha) com este formato:
{"numeroParcelas":<int>,"vencimentos":["YYYY-MM-DD",...],"valores":[<float>,...],"observacao":"<texto breve>"}
Regras:
- Valores: máximo 2 casas decimais (ex: 1500.50). Use 0 se não houver valor para a parcela.
- Datas: formato YYYY-MM-DD. Array vazio se não houver datas.
- Limite de parcelas: máximo 360. Se houver mais, inclua apenas as primeiras 360.
- observacao: máximo 80 caracteres resumindo o tipo de cronograma.
- Sem markdown, sem texto fora do JSON.

DOCUMENTO:
${textContent}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 4000,
      });

      const raw = (response.choices[0].message.content || "").trim();
      let jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

      // Robust JSON parse: if truncated, try to close arrays/objects and re-parse
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Attempt to salvage truncated JSON by closing unclosed structures
        const open = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
        const squareDiff = open(jsonStr, "[") - open(jsonStr, "]");
        const curlyDiff = open(jsonStr, "{") - open(jsonStr, "}");
        // Remove trailing incomplete token (partial number/string)
        let fixed = jsonStr.replace(/,?\s*[\d.]*$/, "").replace(/,?\s*"[^"]*$/, "");
        for (let i = 0; i < squareDiff; i++) fixed += "]";
        for (let i = 0; i < curlyDiff; i++) fixed += "}";
        try {
          parsed = JSON.parse(fixed);
          console.log("[parse-pagamento-file] recovered truncated JSON");
        } catch {
          throw new Error("Não foi possível interpretar a resposta da IA. Tente com um arquivo menor ou em formato Excel.");
        }
      }
      res.json({ success: true, ...parsed });
    } catch (error: any) {
      console.error("[parse-pagamento-file]", error.message);
      res.status(500).json({ error: "Erro ao processar arquivo: " + error.message });
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

  // ── Self-registration ──────────────────────────────────────────────
  app.post("/api/register", async (req, res) => {
    try {
      const { nome, email, username, password, telefone, empresa, cidade, estado, convite_token, interesses } = req.body;
      if (!nome || !email || !password)
        return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
      if (password.length < 4)
        return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });

      // Require a convite_token to register
      if (!convite_token) {
        return res.status(403).json({ error: "É necessário um código de convite para se cadastrar. Solicite um convite a um membro da rede BUILT." });
      }
      const conviteLink = await storage.getConviteLinkByToken(convite_token);
      if (!conviteLink || conviteLink.status !== "ativo") {
        return res.status(403).json({ error: "Código de convite inválido ou já utilizado." });
      }
      if (conviteLink.expires_at && new Date() > new Date(conviteLink.expires_at)) {
        return res.status(403).json({ error: "Este código de convite expirou. Solicite um novo convite ao membro da rede." });
      }

      const finalUsername = username || email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();

      const existingByUsername = await storage.getUserByUsername(finalUsername);
      if (existingByUsername) return res.status(409).json({ error: "Nome de usuário já em uso" });
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) return res.status(409).json({ error: "E-mail já cadastrado" });

      // Parse and validate interesses
      const INTERESSES_VALIDOS = ["vitrine", "capital", "membros"];
      const interessesArr: string[] = Array.isArray(interesses)
        ? interesses.filter((v: any) => typeof v === "string" && INTERESSES_VALIDOS.includes(v))
        : [];
      if (interessesArr.length === 0) {
        return res.status(400).json({ error: "Selecione pelo menos uma área de interesse para continuar." });
      }
      const naVitrine = interessesArr.includes("vitrine");
      const emBuiltCapital = interessesArr.includes("capital");
      const emMembrosBuilt = interessesArr.includes("membros");

      // 1. Create entry in Directus cadastro_geral (mandatory — registration fails if this fails)
      const directusPayload: Record<string, any> = {
        Nome_de_usuario: nome,
        nome,
        email,
        na_vitrine: naVitrine,
        em_built_capital: emBuiltCapital,
        em_membros_built: emMembrosBuilt,
      };
      if (telefone) directusPayload.telefone = telefone;
      if (empresa) directusPayload.empresa = empresa;
      if (cidade) directusPayload.cidade = cidade;
      if (estado) directusPayload.estado = estado;

      const directusRes = await fetch(`${DIRECTUS_URL}/items/cadastro_geral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        },
        body: JSON.stringify(directusPayload),
      });
      if (!directusRes.ok) {
        const errText = await directusRes.text();
        console.error("[register] Directus cadastro_geral creation failed:", directusRes.status, errText.slice(0, 200));
        return res.status(500).json({ error: "Erro ao criar perfil de membro. Tente novamente." });
      }
      const directusData = await directusRes.json();
      const membroDirectusId: string = directusData.data?.id;
      if (!membroDirectusId) {
        return res.status(500).json({ error: "Erro ao criar perfil de membro (id ausente). Tente novamente." });
      }
      console.log("[register] Directus cadastro_geral created:", membroDirectusId);

      // 2. Associate member with the inviter's community in Directus immediately (as candidato)
      if (conviteLink.comunidade_id) {
        const col = await getComunidadeCol();
        const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${conviteLink.comunidade_id}?fields=id,membros.cadastro_geral_id`;
        const comunidadeRes = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        if (comunidadeRes.ok) {
          const comunidadeData = await comunidadeRes.json();
          const currentMembros: any[] = Array.isArray(comunidadeData.data?.membros) ? comunidadeData.data.membros : [];
          const currentIds = currentMembros
            .map((m: any) => typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id)
            .filter(Boolean)
            .map((id: string) => ({ cadastro_geral_id: id }));
          if (!currentIds.some((m: any) => m.cadastro_geral_id === membroDirectusId)) {
            currentIds.push({ cadastro_geral_id: membroDirectusId });
          }
          const patchRes = await fetch(`${DIRECTUS_URL}/items/${col}/${conviteLink.comunidade_id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ membros: currentIds }),
          });
          if (!patchRes.ok) {
            const err = await patchRes.text().catch(() => "");
            console.warn("[register] Community M2M association failed (non-fatal):", patchRes.status, err.slice(0, 200));
          } else {
            console.log("[register] Member associated to community:", conviteLink.comunidade_id);
          }
        } else {
          console.warn("[register] Could not fetch community for M2M association:", comunidadeRes.status);
        }
      }

      // 3. Create local platform user
      const user = await storage.createUser({
        username: finalUsername,
        password,
        nome,
        email,
        membro_directus_id: membroDirectusId,
        role: "user",
        permissions: {},
        ativo: true,
      });

      // 4. Mark convite_link as used, create vitrine candidatura, and optionally associacao_completa.
      // These steps are mandatory — if they fail we roll back both the user creation
      // AND the token consumption so the invite can still be used on retry.
      let tokenConsumed = false;
      let pagamentoToken: string | null = null;
      try {
        await storage.updateConviteLink(conviteLink.id, {
          status: "usado",
          usado_por_user_id: user.id,
          usado_em: new Date(),
        });
        tokenConsumed = true;

        await storage.createConvite({
          comunidade_id: conviteLink.comunidade_id!,
          candidato_membro_id: membroDirectusId,
          candidato_nome: nome,
          candidato_email: email,
          invitador_membro_id: conviteLink.gerador_membro_id || null,
          status: "candidato",
          tipo: "vitrine",
          dados_contratuais: null,
          expires_at: null,
        });

        // If user chose Área de Alianças, create an associacao_completa convite for payment
        if (emMembrosBuilt && conviteLink.comunidade_id) {
          const assocConvite = await storage.createConvite({
            comunidade_id: conviteLink.comunidade_id,
            candidato_membro_id: membroDirectusId,
            candidato_nome: nome,
            candidato_email: email,
            invitador_membro_id: conviteLink.gerador_membro_id || null,
            status: "convidado",
            tipo: "associacao_completa",
            dados_contratuais: null,
            expires_at: null,
          });
          pagamentoToken = assocConvite.token;
          console.log("[register] associacao_completa convite created:", assocConvite.id, "token:", pagamentoToken);
        }
      } catch (postUserErr: any) {
        // Roll back: delete the newly created user so they cannot log in
        // in an unapproved state, and restore the token to "ativo" if it was already consumed.
        console.error("[register] Post-user creation steps failed, rolling back:", postUserErr.message);
        await storage.deleteUser(user.id).catch((e) => console.error("[register] Rollback deleteUser failed:", e.message));
        if (tokenConsumed) {
          await storage.updateConviteLink(conviteLink.id, { status: "ativo", usado_por_user_id: null, usado_em: null })
            .catch((e) => console.error("[register] Rollback updateConviteLink failed:", e.message));
        }
        throw postUserErr;
      }

      const { password: _pw, ...safe } = user;
      res.json({ success: true, user: safe, ...(pagamentoToken ? { pagamento_token: pagamentoToken } : {}) });

      // Notify community admin (aliado BUILT) about the new candidate — fire and forget
      if (conviteLink.comunidade_id) {
        (async () => {
          try {
            const { notificarAliadoCandidatura: notifyAliado } = await import("./mailer");
            const col = await getComunidadeCol();
            const cr = await fetch(`${DIRECTUS_URL}/items/${col}/${conviteLink.comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email`, {
              headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            });
            if (cr.ok) {
              const comunidade = (await cr.json()).data;
              const aliado = comunidade?.aliado;
              if (aliado?.email) {
                await notifyAliado({
                  aliadoEmail: aliado.email,
                  aliadoNome: aliado.nome || "Aliado",
                  candidatoNome: nome,
                  candidatoEmail: email,
                  comunidadeNome: comunidade?.nome || "Comunidade BUILT",
                  comunidadeId: conviteLink.comunidade_id,
                  interesses: interessesArr,
                });
                console.log("[register] Admin notified:", aliado.email);
              } else {
                console.warn("[register] No aliado email found for community:", conviteLink.comunidade_id);
              }
            } else {
              console.warn("[register] Could not fetch community for admin notification:", cr.status, conviteLink.comunidade_id);
            }
          } catch (notifyErr: any) {
            console.error("[register] Failed to notify aliado:", notifyErr.message);
          }
        })();
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/forgot-password — send a password reset email
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "E-mail obrigatório" });
      const trimmed = email.trim();
      // Always return 200 to avoid user enumeration — but log internally
      const user = await storage.getUserByEmail(trimmed);
      if (user) {
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const resetToken = await storage.createPasswordResetToken(user.id, expires);
        const { enviarResetSenha } = await import("./mailer");
        try {
          await enviarResetSenha({ email: user.email || trimmed, nome: user.nome || user.username || "", token: resetToken.token });
          console.log("[forgot-password] Reset email sent to:", user.email || trimmed);
        } catch (mailErr: any) {
          console.error("[forgot-password] Failed to send email:", mailErr.message);
          // Still return success to avoid user enumeration, but log the failure
        }
      } else {
        console.log("[forgot-password] No local account found for email:", trimmed);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[forgot-password] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/reset-password — verify token and set new password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: "Token e senha são obrigatórios" });
      if (password.length < 4) return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ error: "Token inválido ou expirado" });
      if (resetToken.used) return res.status(400).json({ error: "Este link já foi utilizado" });
      if (new Date() > new Date(resetToken.expires_at)) return res.status(400).json({ error: "Link expirado. Solicite um novo." });
      // Pass plain password — updateUser handles hashing internally
      await storage.updateUser(resetToken.user_id, { password });
      await storage.markPasswordResetTokenUsed(resetToken.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
        // Directus auth failed — try local-only user auth (for admin-created users)
        try {
          const { comparePasswords } = await import("./storage");
          // Try all users with this email (newest first) — handles edge case of duplicate emails
          const localUsers = await storage.getUsersByEmail(email);
          for (const localUser of localUsers) {
            if (!localUser.ativo) continue;
            const valid = await comparePasswords(password, localUser.password);
            if (valid) {
              const role = localUser.role || "user";
              const permissions = (Object.keys(localUser.permissions as any || {}).length > 0
                ? localUser.permissions
                : (role === "admin" || role === "manager")
                  ? { aura: "edit", bias: "edit", admin: "edit", painel: "edit", membros: "edit", calculadora: "edit", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" }
                  : {}) as Record<string, string>;
              (req.session as any).directusUserId = localUser.id;
              (req.session as any).membroId = localUser.membro_directus_id || null;
              (req.session as any).nome = localUser.nome;
              (req.session as any).email = localUser.email;
              (req.session as any).role = role;
              (req.session as any).permissions = permissions;
              return res.json({
                id: localUser.id,
                nome: localUser.nome,
                email: localUser.email,
                membro_directus_id: localUser.membro_directus_id,
                role,
                permissions,
              });
            }
          }
        } catch (e: any) {
          console.error("[login] local auth error:", e.message);
        }
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

      // Check local users table for admin role + permissions by email
      let role = "user";
      let permissions: Record<string, string> = {};
      try {
        const localUser = await storage.getUserByEmail(email);
        if (localUser && localUser.ativo) {
          role = localUser.role || "user";
          permissions = (localUser.permissions as Record<string, string>) || {};
        }
      } catch (e: any) {
        console.warn("[login] local user lookup error:", e.message);
      }
      // Admins always get full permissions regardless of stored value
      if (role === "admin" || role === "manager") {
        permissions = { aura: "edit", bias: "edit", admin: "edit", painel: "edit", membros: "edit", calculadora: "edit", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" };
      }

      // Store session
      (req.session as any).directusUserId = directusUser.id;
      (req.session as any).membroId = membroId;
      (req.session as any).nome = nome;
      (req.session as any).email = email;
      (req.session as any).role = role;
      (req.session as any).permissions = permissions;

      res.json({
        id: directusUser.id,
        nome,
        email,
        membro_directus_id: membroId,
        role,
        permissions,
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

  app.get("/api/me", async (req, res) => {
    const directusUserId = (req.session as any).directusUserId;
    if (!directusUserId) return res.status(401).json({ error: "Não autenticado" });
    let role = (req.session as any).role || "user";
    let permissions = (req.session as any).permissions || {};
    const email = (req.session as any).email || "";
    // Always re-check local users table to ensure correct role
    try {
      if (email) {
        const localUser = await storage.getUserByEmail(email);
        if (localUser && localUser.ativo) {
          role = localUser.role || role;
          if ((localUser.permissions as any) && Object.keys(localUser.permissions as any).length > 0) {
            permissions = localUser.permissions as Record<string, string>;
          }
        }
      }
    } catch (_) {}
    if ((role === "admin" || role === "manager") && Object.keys(permissions).length === 0) {
      permissions = { aura: "edit", bias: "edit", admin: "edit", painel: "edit", membros: "edit", calculadora: "edit", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" };
    }
    const membroId = (req.session as any).membroId as string | null;
    let tipos_alianca: string[] = [];
    let Outras_redes_as_quais_pertenco: string[] = [];
    let fotoPerfil: string | null = null;
    if (membroId) {
      try {
        const membro = await directusFetchOne("cadastro_geral", membroId, "fields=tipos_alianca,Outras_redes_as_quais_pertenco,foto_perfil");
        if (membro) {
          tipos_alianca = Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : [];
          Outras_redes_as_quais_pertenco = Array.isArray(membro.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : [];
          fotoPerfil = membro.foto_perfil || null;
        }
      } catch (_) {}
    }
    // Check for pending or rejected vitrine approval (only for "user" role)
    let pending_vitrine = false;
    if (role === "user" && email) {
      try {
        const localUser = await storage.getUserByEmail(email);
        if (localUser?.membro_directus_id) {
          const vitrineConvites = await storage.getConvitesByCandidatoMembro(localUser.membro_directus_id, "vitrine");
          // Block if awaiting approval OR if rejected — platform access is not granted until approved
          pending_vitrine = vitrineConvites.some(c => c.status === "candidato" || c.status === "rejeitado");
        }
      } catch (_) {}
    }

    res.json({
      id: directusUserId,
      nome: (req.session as any).nome || "",
      email,
      membro_directus_id: membroId || null,
      role,
      permissions,
      tipos_alianca,
      Outras_redes_as_quais_pertenco,
      foto_perfil: fotoPerfil ? `/api/assets/${fotoPerfil}` : null,
      pending_vitrine,
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

  app.get("/api/users/by-membro/:membroId", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const user = allUsers.find(u => u.membro_directus_id === req.params.membroId);
      if (!user) return res.json(null);
      const { password, ...safe } = user;
      res.json(safe);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/users/by-email?email=xxx — find unlinked user by email (admin only, for linking)
  app.get("/api/users/by-email", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.json(null);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json(null);
      const { password, ...safe } = user;
      res.json(safe);
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

      if (parsed.email) {
        const existingEmail = await storage.getUserByEmail(parsed.email);
        if (existingEmail) return res.status(409).json({ error: "E-mail já cadastrado em outra conta. Use um e-mail diferente ou edite a conta existente." });
      }

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
      // Strip undefined values — only include explicitly provided fields
      const updateData: any = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v !== undefined)
      );
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
    "aliado.id,aliado.nome,aliado.email,aliado.foto_perfil,aliado.cargo,aliado.empresa," +
    "membros.cadastro_geral_id.id,membros.cadastro_geral_id.nome,membros.cadastro_geral_id.email,membros.cadastro_geral_id.foto_perfil,membros.cadastro_geral_id.cargo,membros.cadastro_geral_id.empresa," +
    "bias.bias_projetos_id.id,bias.bias_projetos_id.nome_bia";

  // Convert frontend payload (aliado_id, membros_ids[], bias_ids[]) to Directus M2O/M2M format
  function toComunidadePayload(body: any) {
    const { aliado_id, membros_ids, bias_ids, ...rest } = body;
    const trimmed: any = {};
    for (const [k, v] of Object.entries(rest)) {
      trimmed[k] = typeof v === "string" ? v.trim() : v;
    }
    return {
      ...trimmed,
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
      const all: any[] = await directusFetch(col, "fields=pais,territorio,sigla_territorio,codigo_sequencial");
      const same = all.filter((c: any) =>
        c.pais?.trim().toLowerCase() === pais?.trim().toLowerCase() &&
        c.territorio?.trim().toLowerCase() === territorio?.trim().toLowerCase()
      );
      const codes = same.map((c: any) => c.codigo_sequencial).filter(Boolean);
      const sigla_territorio = pais && territorio
        ? uniqueSiglaTerritorio(territorio, pais, all)
        : undefined;
      res.json({ codigo: nextComunidadeCode(codes), sigla_territorio });
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

      // Server-side uniqueness: recalculate codigo_sequencial and sigla_territorio to avoid race conditions
      if (payload.pais && payload.territorio) {
        const all: any[] = await directusFetch(col, "fields=pais,territorio,sigla_territorio,codigo_sequencial");
        const same = all.filter((c: any) =>
          c.pais?.trim().toLowerCase() === payload.pais?.trim().toLowerCase() &&
          c.territorio?.trim().toLowerCase() === payload.territorio?.trim().toLowerCase()
        );
        const codes = same.map((c: any) => c.codigo_sequencial).filter(Boolean);
        payload.codigo_sequencial = nextComunidadeCode(codes);
        // Deduplicate sigla_territorio across all communities in the same country
        payload.sigla_territorio = uniqueSiglaTerritorio(payload.territorio, payload.pais, all);
        const { sigla_pais } = payload;
        if (sigla_pais && payload.sigla_territorio) {
          payload.sigla = `${sigla_pais.toUpperCase()}-${payload.sigla_territorio.toUpperCase()}-COM-${payload.codigo_sequencial}`;
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

  // ========== CONVITES COMUNIDADE ==========
  const {
    enviarConvite,
    notificarAliadoCandidatura,
    enviarAprovacao,
    enviarRejeicao,
    enviarTermos,
    enviarPagamento,
    enviarNovoMembro,
    enviarAprovacaoVitrine,
  } = await import("./mailer");

  // Helper: get Directus member info by membro_id
  async function getDirectusMembro(membroId: string) {
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral/${membroId}?fields=id,nome,email,Outras_redes_as_quais_pertenco`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!r.ok) return null;
      const d = await r.json();
      return d.data || null;
    } catch { return null; }
  }

  // Helper: verify that the session user is the aliado of a community (or admin/manager)
  function isCommunityManager(req: any, comunidade: any): boolean {
    const sessionRole = (req.session as any).role || "user";
    if (sessionRole === "admin" || sessionRole === "manager") return true;
    const sessionMembroId = (req.session as any).membroId as string | null;
    if (!sessionMembroId || !comunidade) return false;
    const aliadoId = typeof comunidade.aliado === "object" && comunidade.aliado !== null
      ? comunidade.aliado.id
      : comunidade.aliado;
    return aliadoId === sessionMembroId;
  }

  /** Returns true if the current session user is the aliado OR an active member of this community */
  function isCommunityMember(req: any, comunidade: any): boolean {
    if (isCommunityManager(req, comunidade)) return true;
    const sessionMembroId = (req.session as any).membroId as string | null;
    if (!sessionMembroId || !comunidade) return false;
    const membros: any[] = Array.isArray(comunidade.membros) ? comunidade.membros : [];
    return membros.some((m: any) => {
      const id = typeof m.cadastro_geral_id === "object" && m.cadastro_geral_id !== null
        ? m.cadastro_geral_id.id
        : m.cadastro_geral_id;
      return id === sessionMembroId;
    });
  }

  // POST /api/convites — create invite (authenticated, community aliado or admin)
  app.post("/api/convites", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const { comunidade_id, candidato_membro_id } = req.body;
      if (!comunidade_id || !candidato_membro_id) return res.status(400).json({ error: "Campos obrigatórios: comunidade_id, candidato_membro_id" });

      const invitadorId = (req.session as any).membroId;

      // Get candidato info from Directus
      const candidato = await getDirectusMembro(candidato_membro_id);
      if (!candidato) return res.status(404).json({ error: "Membro candidato não encontrado" });

      // Get comunidade info (including membros so isCommunityMember can check membership)
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email,membros.cadastro_geral_id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!cr.ok) return res.status(404).json({ error: "Comunidade não encontrada" });
      const comunidade = (await cr.json()).data;

      // Authorization: aliado, current community members, or admin can create invites
      if (!isCommunityMember(req, comunidade)) {
        return res.status(403).json({ error: "Apenas membros ou o Aliado BUILT da comunidade podem enviar convites" });
      }

      const invitadorMembro = invitadorId ? await getDirectusMembro(invitadorId) : null;

      // Convite expires in 7 days if candidate doesn't apply
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const convite = await storage.createConvite({
        comunidade_id,
        candidato_membro_id,
        candidato_nome: candidato.nome || null,
        candidato_email: candidato.email || null,
        invitador_membro_id: invitadorId || null,
        status: "convidado",
        dados_contratuais: null,
        expires_at: expiresAt,
      });

      if (candidato.email) {
        await enviarConvite({
          candidatoEmail: candidato.email,
          candidatoNome: candidato.nome || "Candidato",
          comunidadeNome: comunidade.nome || "Comunidade BUILT",
          invitadorNome: invitadorMembro?.nome || "Membro BUILT",
          token: convite.token,
        });
      }

      res.json(convite);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convites — list (by comunidade_id or candidato) (authenticated)
  app.get("/api/convites", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const { comunidade_id, candidato_membro_id, tipo } = req.query as any;
      let items;
      if (comunidade_id) {
        // Authorization: only community aliado or admin can list candidates
        const sessionRole = (req.session as any).role || "user";
        const isAdminRoute = sessionRole === "admin" || sessionRole === "manager";
        const col = await getComunidadeCol();
        const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${comunidade_id}?fields=id,aliado.id`;
        const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        const comunidade = cr.ok ? (await cr.json()).data : null;
        if (!isAdminRoute && !isCommunityManager(req, comunidade)) {
          return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade pode ver candidatos" });
        }
        items = await storage.getConvitesByComunidade(comunidade_id);
        // Filter by tipo if specified
        if (tipo) {
          items = items.filter((c: any) => c.tipo === tipo);
        }
      } else if (candidato_membro_id) {
        // Authorization: only the candidato themselves or admin can see their own invites
        const sessionRole = (req.session as any).role || "user";
        const sessionMembroId = (req.session as any).membroId as string | null;
        if (sessionRole !== "admin" && sessionRole !== "manager" && sessionMembroId !== candidato_membro_id) {
          return res.status(403).json({ error: "Não autorizado a ver convites de outro membro" });
        }
        // Return invites without dados_contratuais (PII) when querying own invites
        const raw = await storage.getConvitesByCandidato(candidato_membro_id);
        items = raw.map(({ dados_contratuais: _dc, ...rest }) => rest);
      } else {
        return res.status(400).json({ error: "Informe comunidade_id ou candidato_membro_id" });
      }
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convites/:token — get convite (public)
  app.get("/api/convites/:token", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });

      // Get comunidade info
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,sigla,pais,territorio,aliado.id,aliado.nome,aliado.foto_perfil`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      res.json({ ...convite, comunidade });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/convites/:token/candidatura — submit form (public)
  app.post("/api/convites/:token/candidatura", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (!["convidado"].includes(convite.status)) return res.status(400).json({ error: "Este convite não está mais disponível para candidatura" });
      // Check expiration
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "Este convite expirou. Solicite um novo convite ao Aliado da comunidade." });
      }

      const updated = await storage.updateConvite(convite.id, {
        status: "candidato",
        dados_contratuais: req.body as any,
      });

      // Get comunidade + aliado info to notify
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;
      const aliado = comunidade?.aliado;

      if (aliado?.email) {
        await notificarAliadoCandidatura({
          aliadoEmail: aliado.email,
          aliadoNome: aliado.nome || "Aliado",
          candidatoNome: convite.candidato_nome || req.body.nome_completo || "Candidato",
          comunidadeNome: comunidade?.nome || "Comunidade BUILT",
          comunidadeId: convite.comunidade_id,
        });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/decisao — approve/reject (authenticated, aliado/admin)
  app.patch("/api/convites/:token/decisao", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura não está em análise" });

      const { decisao } = req.body; // "aprovado" | "rejeitado"
      if (!["aprovado", "rejeitado"].includes(decisao)) return res.status(400).json({ error: "decisao deve ser 'aprovado' ou 'rejeitado'" });

      // Get comunidade info for auth + emails
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      // Authorization: only aliado or admin can approve/reject
      if (!isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade pode aprovar ou rejeitar candidatos" });
      }

      // When approving, give 12h for terms acceptance
      const newExpiresAt = decisao === "aprovado" ? (() => { const d = new Date(); d.setHours(d.getHours() + 12); return d; })() : undefined;
      const updated = await storage.updateConvite(convite.id, { status: decisao, ...(newExpiresAt ? { expires_at: newExpiresAt } : {}) });

      const comunidadeNome = comunidade?.nome || "Comunidade BUILT";

      if (decisao === "aprovado" && convite.candidato_email) {
        await enviarAprovacao({
          candidatoEmail: convite.candidato_email,
          candidatoNome: convite.candidato_nome || "Candidato",
          comunidadeNome,
          token: convite.token,
        });
      } else if (decisao === "rejeitado") {
        if (convite.candidato_email) {
          const invitador = convite.invitador_membro_id ? await getDirectusMembro(convite.invitador_membro_id) : null;
          await enviarRejeicao({
            candidatoEmail: convite.candidato_email,
            candidatoNome: convite.candidato_nome || "Candidato",
            comunidadeNome,
            invitadorEmail: invitador?.email,
            invitadorNome: invitador?.nome,
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/adesao — accept terms (public)
  app.patch("/api/convites/:token/adesao", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (!["aprovado", "termos_enviados"].includes(convite.status)) return res.status(400).json({ error: "Termos não disponíveis para aceite neste momento" });
      // Check expiration
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo para aceitar os termos expirou. Entre em contato com o Aliado da comunidade." });
      }

      // Give 24h for payment after accepting terms; move to explicit pagamento_pendente state
      const paymentExpiry = new Date();
      paymentExpiry.setHours(paymentExpiry.getHours() + 24);
      const updated = await storage.updateConvite(convite.id, { status: "pagamento_pendente", expires_at: paymentExpiry });

      // Notify about payment
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      if (convite.candidato_email) {
        await enviarPagamento({
          candidatoEmail: convite.candidato_email,
          candidatoNome: convite.candidato_nome || "Candidato",
          comunidadeNome: comunidade?.nome || "Comunidade BUILT",
          token: convite.token,
          valor: "R$ 500,00",
        });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/pagamento — confirm payment & activate member (authenticated, aliado/admin)
  app.patch("/api/convites/:token/pagamento", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (!["termos_aceitos", "pagamento_pendente"].includes(convite.status)) return res.status(400).json({ error: "Termos ainda não foram aceitos" });

      // Enforce payment window expiry
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo de 24h para confirmação de pagamento expirou. Reenvie o lembrete para reabrir o prazo." });
      }

      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?${COMUNIDADE_FIELDS}`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      // Authorization: only aliado or admin can confirm payment
      if (!isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade pode confirmar pagamentos" });
      }

      const comunidadeNome = comunidade?.nome || "Comunidade BUILT";

      // 1. Add BUILT_PROUD_MEMBER to Directus member field (must succeed before marking membro)
      const candidatoData = await getDirectusMembro(convite.candidato_membro_id);
      if (!candidatoData) {
        // Cannot activate without verifying/updating badge — fail atomically
        console.error("[pagamento] candidato not found in Directus:", convite.candidato_membro_id);
        return res.status(502).json({ error: "Dados do candidato não encontrados no Directus. Verifique o cadastro e tente novamente." });
      }
      const redesAtuais: string[] = Array.isArray(candidatoData.Outras_redes_as_quais_pertenco)
        ? candidatoData.Outras_redes_as_quais_pertenco
        : [];
      if (!redesAtuais.includes("BUILT_PROUD_MEMBER")) {
        const patchUrl = `${DIRECTUS_URL}/items/cadastro_geral/${convite.candidato_membro_id}`;
        const badgePatch = await fetch(patchUrl, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ Outras_redes_as_quais_pertenco: [...redesAtuais, "BUILT_PROUD_MEMBER"] }),
        });
        if (!badgePatch.ok) {
          const err = await badgePatch.text().catch(() => "");
          console.error("[pagamento] BUILT_PROUD_MEMBER badge update failed:", badgePatch.status, err);
          return res.status(502).json({ error: "Falha ao atualizar badge no Directus. Tente novamente." });
        }
      }

      // 2. Add member to community M2M in Directus (must succeed before marking membro)
      const membrosPatch = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}`;
      const currentMembros = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
      const currentIds = currentMembros.map((m: any) => {
        const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
        return id ? { cadastro_geral_id: id } : null;
      }).filter(Boolean);
      if (!currentIds.some((m: any) => m.cadastro_geral_id === convite.candidato_membro_id)) {
        currentIds.push({ cadastro_geral_id: convite.candidato_membro_id });
      }
      const m2mPatch = await fetch(membrosPatch, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ membros: currentIds }),
      });
      if (!m2mPatch.ok) {
        const err = await m2mPatch.text().catch(() => "");
        console.error("[pagamento] M2M membership update failed:", m2mPatch.status, err);
        return res.status(502).json({ error: "Falha ao adicionar membro à comunidade no Directus. Tente novamente." });
      }

      // Only mark membro after both Directus updates succeed
      await storage.updateConvite(convite.id, { status: "membro" });

      // 3. Send emails to all community members + aliado + BUILT admin
      const notifyEmails: string[] = [];
      if (candidatoData?.email) notifyEmails.push(candidatoData.email);
      const aliado = typeof comunidade?.aliado === "object" ? comunidade.aliado : null;
      if (aliado?.email) notifyEmails.push(aliado.email);
      const allMembrosComunidade: any[] = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
      for (const m of allMembrosComunidade) {
        const mInfo = typeof m.cadastro_geral_id === "object" ? m.cadastro_geral_id : null;
        if (mInfo?.email) notifyEmails.push(mInfo.email);
      }
      // Include BUILT admin (SMTP_FROM address or ADMIN_EMAIL env var)
      const adminEmail = process.env.ADMIN_EMAIL || (process.env.SMTP_FROM ? process.env.SMTP_FROM.replace(/.*<(.+)>/, "$1") : null);
      if (adminEmail) notifyEmails.push(adminEmail);
      const uniqueEmails = [...new Set(notifyEmails)].filter(Boolean);
      if (uniqueEmails.length > 0) {
        await enviarNovoMembro({
          emails: uniqueEmails,
          novoMembroNome: convite.candidato_nome || "Novo Membro",
          comunidadeNome,
          novoMembroId: convite.candidato_membro_id || undefined,
        });
      }

      res.json({ success: true, comunidadeNome, candidatoNome: convite.candidato_nome });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/convites/:token/lembrete — send reminder email (authenticated, aliado/admin)
  app.post("/api/convites/:token/lembrete", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });

      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      // Authorization: only aliado or admin can send reminders
      if (!isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade pode enviar lembretes" });
      }

      if (convite.candidato_email && ["aprovado", "termos_enviados"].includes(convite.status)) {
        // Renew 12h window for terms acceptance
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 12);
        await storage.updateConvite(convite.id, { status: "termos_enviados", expires_at: newExpiry });
        await enviarTermos({
          candidatoEmail: convite.candidato_email,
          candidatoNome: convite.candidato_nome || "Candidato",
          comunidadeNome: comunidade?.nome || "Comunidade BUILT",
          token: convite.token,
        });
      } else if (convite.candidato_email && ["termos_aceitos", "pagamento_pendente"].includes(convite.status)) {
        // Renew 24h window for payment confirmation
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 24);
        await storage.updateConvite(convite.id, { status: "pagamento_pendente", expires_at: newExpiry });
        await enviarPagamento({
          candidatoEmail: convite.candidato_email,
          candidatoNome: convite.candidato_nome || "Candidato",
          comunidadeNome: comunidade?.nome || "Comunidade BUILT",
          token: convite.token,
          valor: "R$ 500,00",
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== CONVITES LINK (vitrine invite links) ==========

  // POST /api/meu-convite — generate a vitrine invite link for the current authenticated member
  app.post("/api/meu-convite", async (req, res) => {
    const sessionUserId = (req.session as any).directusUserId;
    if (!sessionUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const email = (req.session as any).email;
      const localUser = email ? await storage.getUserByEmail(email) : null;
      const userId = localUser?.id || sessionUserId;
      const membroId = (req.session as any).membroId as string | null;
      const nome = (req.session as any).nome as string;

      // Any authenticated member may generate a personal invite link (requires community membership)

      const forceNew = req.body?.force === true;

      // Check if there's already an active invite (skip if force=true)
      if (!forceNew) {
        const existing = await storage.getActiveConviteLinkByUserId(userId);
        if (existing && new Date() < new Date(existing.expires_at)) {
          const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
          return res.json({ ...existing, link: `${rawDomain}/login?convite=${existing.token}` });
        }
      }

      // Find the member's community in Directus
      let comunidadeId: string | null = null;
      let comunidadeNome: string | null = null;
      if (membroId) {
        try {
          const col = await getComunidadeCol();
          const url = `${DIRECTUS_URL}/items/${col}?fields=id,nome&filter[membros][cadastro_geral_id][_eq]=${membroId}&limit=1`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
          if (r.ok) {
            const data = await r.json();
            if (data.data?.[0]) {
              comunidadeId = data.data[0].id;
              comunidadeNome = data.data[0].nome;
            }
          }
          // Also check if they're an aliado
          if (!comunidadeId) {
            const url2 = `${DIRECTUS_URL}/items/${col}?fields=id,nome&filter[aliado][_eq]=${membroId}&limit=1`;
            const r2 = await fetch(url2, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
            if (r2.ok) {
              const data2 = await r2.json();
              if (data2.data?.[0]) {
                comunidadeId = data2.data[0].id;
                comunidadeNome = data2.data[0].nome;
              }
            }
          }
        } catch (e) {
          console.warn("[meu-convite] community lookup failed:", e);
        }
      }

      // Block invite generation if the member has no community — the registration
      // flow requires a valid comunidade_id to create the vitrine candidatura record.
      if (!comunidadeId) {
        return res.status(400).json({
          error: "Você precisa estar associado a uma comunidade para gerar um convite. Entre em contato com seu Aliado BUILT."
        });
      }

      const expires = new Date();
      expires.setDate(expires.getDate() + 30); // Valid for 30 days

      const convite = await storage.createConviteLink({
        gerador_user_id: userId,
        gerador_membro_id: membroId || null,
        gerador_nome: nome || null,
        comunidade_id: comunidadeId || null,
        comunidade_nome: comunidadeNome || null,
        status: "ativo",
        usado_por_user_id: null,
        expires_at: expires,
      });

      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
      res.json({ ...convite, link: `${rawDomain}/login?convite=${convite.token}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/meu-convite — get the active, non-expired convite link for the current user
  app.get("/api/meu-convite", async (req, res) => {
    const sessionUserId = (req.session as any).directusUserId;
    if (!sessionUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const email = (req.session as any).email;
      const localUser = email ? await storage.getUserByEmail(email) : null;
      const userId = localUser?.id || sessionUserId;
      const convite = await storage.getActiveConviteLinkByUserId(userId);
      if (!convite) return res.json(null);
      // Validate expiry — mark as expirado if past expires_at
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        await storage.updateConviteLink(convite.id, { status: "expirado" }).catch(() => {});
        return res.json(null);
      }
      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
      res.json({ ...convite, link: `${rawDomain}/login?convite=${convite.token}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convite-publico/:token — public: validate token and return minimal info
  app.get("/api/convite-publico/:token", async (req, res) => {
    try {
      const convite = await storage.getConviteLinkByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (convite.status !== "ativo") return res.status(400).json({ error: "Este convite já foi utilizado ou expirou." });
      if (new Date() > new Date(convite.expires_at)) return res.status(400).json({ error: "Este convite expirou." });
      res.json({
        gerador_nome: convite.gerador_nome,
        comunidade_nome: convite.comunidade_nome,
        expires_at: convite.expires_at,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/aprovar-vitrine — approve vitrine access (aliado or admin only)
  app.patch("/api/convites/:token/aprovar-vitrine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (convite.tipo !== "vitrine") return res.status(400).json({ error: "Este endpoint é apenas para convites de vitrine" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura não está em análise" });

      // Get comunidade for authorization
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      const sessionRole = (req.session as any).role || "user";
      const isAdmin = sessionRole === "admin" || sessionRole === "manager";
      if (!isAdmin && !isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade ou admin pode aprovar acesso" });
      }

      // Update convite status
      await storage.updateConvite(convite.id, { status: "vitrine_ativo" });

      // Upgrade the user's role to "membro" so they can access the platform
      const allUsers = await storage.getAllUsers();
      const candidatoUser = allUsers.find(u => u.membro_directus_id === convite.candidato_membro_id);
      if (candidatoUser) {
        await storage.updateUser(candidatoUser.id, { role: "membro" });
      }

      // Send approval email
      if (convite.candidato_email) {
        try {
          const comunidadeNome = comunidade?.nome || "Comunidade BUILT";
          await enviarAprovacaoVitrine({
            candidatoEmail: convite.candidato_email,
            candidatoNome: convite.candidato_nome || "Candidato",
            comunidadeNome,
          });
        } catch (emailErr) {
          console.warn("[aprovar-vitrine] email failed (non-fatal):", emailErr);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/rejeitar-vitrine — reject vitrine access (aliado or admin only)
  app.patch("/api/convites/:token/rejeitar-vitrine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (convite.tipo !== "vitrine") return res.status(400).json({ error: "Este endpoint é apenas para convites de vitrine" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura não está em análise" });

      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      const sessionRole = (req.session as any).role || "user";
      const isAdmin = sessionRole === "admin" || sessionRole === "manager";
      if (!isAdmin && !isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade ou admin pode rejeitar acesso" });
      }

      await storage.updateConvite(convite.id, { status: "rejeitado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== STRIPE PAGAMENTO ==========

  // POST /api/convites/:token/checkout — create Stripe Checkout Session (public, token is the auth)
  app.post("/api/convites/:token/checkout", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });
      if (!["termos_aceitos", "pagamento_pendente"].includes(convite.status)) {
        return res.status(400).json({ error: "Aceite os termos de adesão antes de pagar" });
      }

      // Enforce payment window expiry (same rule as the manual confirmation endpoint)
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo de pagamento expirou. Solicite um novo lembrete ao seu Aliado BUILT para reabrir o prazo." });
      }

      const stripe = getStripeClient();
      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null);
      if (!rawDomain) {
        console.error("[stripe/checkout] APP_URL and REPLIT_DOMAINS are both unset — cannot build redirect URLs");
        return res.status(500).json({ error: "Configuração de URL ausente. Contate o suporte técnico." });
      }
      const baseUrl = rawDomain.replace(/\/$/, "");
      const successUrl = `${baseUrl}/pagamento/${convite.token}?payment_success=true`;
      const cancelUrl = `${baseUrl}/pagamento/${convite.token}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: 50000,
              product_data: {
                name: "Taxa de Adesão BUILT Alliances",
                description: `Adesão à comunidade ${convite.candidato_nome ? "- " + convite.candidato_nome : ""}`.trim(),
              },
            },
            quantity: 1,
          },
        ],
        customer_email: convite.candidato_email || undefined,
        metadata: {
          convite_token: convite.token,
          convite_id: String(convite.id),
          candidato_nome: convite.candidato_nome || "",
          comunidade_id: convite.comunidade_id || "",
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // Mark as pagamento_pendente if not already
      if (convite.status === "termos_aceitos") {
        await storage.updateConvite(convite.id, { status: "pagamento_pendente" });
      }

      if (!session.url) {
        console.error("[stripe/checkout] Stripe session created but no URL returned for token:", convite.token);
        return res.status(502).json({ error: "Erro ao obter link de pagamento. Tente novamente." });
      }

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[stripe/checkout] error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/stripe/webhook — handle Stripe webhook events
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error("[stripe/webhook] missing signature or webhook secret");
      return res.status(400).json({ error: "Missing stripe signature or webhook secret" });
    }

    let event: any;
    try {
      const stripe = getStripeClient();
      const rawBody = (req as any).rawBody as Buffer;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[stripe/webhook] signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // Support both dynamic checkout sessions (metadata) and Payment Links (client_reference_id)
      const token: string | undefined = session.metadata?.convite_token || session.client_reference_id || undefined;

      if (!token) {
        console.error("[stripe/webhook] missing convite_token in metadata and client_reference_id");
        return res.status(200).json({ received: true });
      }

      // Validate payment is actually settled — guard against async payment methods
      if (session.payment_status !== "paid") {
        console.log("[stripe/webhook] session not yet paid (payment_status=%s), skipping activation for token: %s", session.payment_status, token);
        return res.status(200).json({ received: true });
      }

      try {
        const convite = await storage.getConviteByToken(token);
        if (!convite) {
          console.error("[stripe/webhook] convite not found for token:", token);
          return res.status(200).json({ received: true });
        }

        // Idempotency: skip if already activated
        if (convite.status === "membro") {
          console.log("[stripe/webhook] convite already activated, skipping:", token);
          return res.status(200).json({ received: true });
        }

        const col = await getComunidadeCol();

        // 1. Add BUILT_PROUD_MEMBER badge in Directus (must succeed before marking membro)
        const candidatoData = await getDirectusMembro(convite.candidato_membro_id);
        if (!candidatoData) {
          console.error("[stripe/webhook] candidato not found in Directus:", convite.candidato_membro_id);
          return res.status(500).json({ error: "Candidato não encontrado no Directus — webhook será re-tentado" });
        }
        const redesAtuais: string[] = Array.isArray(candidatoData.Outras_redes_as_quais_pertenco)
          ? candidatoData.Outras_redes_as_quais_pertenco
          : [];
        if (!redesAtuais.includes("BUILT_PROUD_MEMBER")) {
          const patchUrl = `${DIRECTUS_URL}/items/cadastro_geral/${convite.candidato_membro_id}`;
          const badgePatch = await fetch(patchUrl, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ Outras_redes_as_quais_pertenco: [...redesAtuais, "BUILT_PROUD_MEMBER"] }),
          });
          if (!badgePatch.ok) {
            const err = await badgePatch.text().catch(() => "");
            console.error("[stripe/webhook] BUILT_PROUD_MEMBER badge update failed:", badgePatch.status, err);
            return res.status(502).json({ error: "Falha ao atualizar badge no Directus — webhook será re-tentado" });
          }
        }

        // 2. Add member to community M2M in Directus (must succeed before marking membro)
        const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?${COMUNIDADE_FIELDS}`;
        const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        if (!cr.ok) {
          console.error("[stripe/webhook] failed to fetch comunidade:", cr.status);
          return res.status(502).json({ error: "Falha ao buscar comunidade no Directus — webhook será re-tentado" });
        }
        const comunidade = (await cr.json()).data;
        const comunidadeNome = comunidade?.nome || "Comunidade BUILT";
        const membrosPatchUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}`;
        const currentMembros = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
        const currentIds = currentMembros.map((m: any) => {
          const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
          return id ? { cadastro_geral_id: id } : null;
        }).filter(Boolean);
        if (!currentIds.some((m: any) => m.cadastro_geral_id === convite.candidato_membro_id)) {
          currentIds.push({ cadastro_geral_id: convite.candidato_membro_id });
        }
        const m2mPatch = await fetch(membrosPatchUrl, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ membros: currentIds }),
        });
        if (!m2mPatch.ok) {
          const err = await m2mPatch.text().catch(() => "");
          console.error("[stripe/webhook] M2M membership update failed:", m2mPatch.status, err);
          return res.status(502).json({ error: "Falha ao adicionar membro à comunidade no Directus — webhook será re-tentado" });
        }

        // 3. Only mark as membro after both Directus updates succeed
        await storage.updateConvite(convite.id, { status: "membro" });
        console.log("[stripe/webhook] convite activated:", token);

        // 4. Send welcome emails (non-blocking — failure does not abort activation)
        const notifyEmails: string[] = [];
        if (candidatoData?.email) notifyEmails.push(candidatoData.email);
        const aliado = typeof comunidade?.aliado === "object" ? comunidade?.aliado : null;
        if (aliado?.email) notifyEmails.push(aliado.email);
        const allMembrosComunidade: any[] = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
        for (const m of allMembrosComunidade) {
          const mInfo = typeof m.cadastro_geral_id === "object" ? m.cadastro_geral_id : null;
          if (mInfo?.email) notifyEmails.push(mInfo.email);
        }
        const adminEmail = process.env.ADMIN_EMAIL || (process.env.SMTP_FROM ? process.env.SMTP_FROM.replace(/.*<(.+)>/, "$1") : null);
        if (adminEmail) notifyEmails.push(adminEmail);
        const uniqueEmails = [...new Set(notifyEmails)].filter(Boolean);
        if (uniqueEmails.length > 0) {
          enviarNovoMembro({
            emails: uniqueEmails,
            novoMembroNome: convite.candidato_nome || "Novo Membro",
            comunidadeNome,
            novoMembroId: convite.candidato_membro_id || undefined,
          }).catch((emailErr: any) => {
            console.error("[stripe/webhook] email send failed (non-fatal):", emailErr.message);
          });
        }
      } catch (err: any) {
        console.error("[stripe/webhook] processing error:", err.message);
        return res.status(500).json({ error: "Erro interno ao processar webhook — será re-tentado" });
      }
    }

    res.status(200).json({ received: true });
  });

  // ── Aura Percebida ───────────────────────────────────────────────────────────
  const { calcularAura, classificarPalavra, PALAVRAS_SUGERIDAS } = await import("./aura-lexico.js");

  // GET /api/aura/membros/busca — member search for evaluation form
  app.get("/api/aura/membros/busca", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const q = String(req.query.q || "").trim();
    try {
      const url = q.length >= 2
        ? `${DIRECTUS_URL}/items/cadastro_geral?limit=20&fields=id,nome,cargo,empresa,foto_perfil&filter%5Bnome%5D%5B_icontains%5D=${encodeURIComponent(q)}`
        : `${DIRECTUS_URL}/items/cadastro_geral?limit=50&fields=id,nome,cargo,empresa,foto_perfil&sort=nome`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!r.ok) return res.json([]);
      const json = await r.json();
      const items = (json.data || []).map((m: any) => ({ id: m.id, nome: m.nome, cargo: m.cargo, empresa: m.empresa, foto: m.foto_perfil || null }));
      return res.json(items);
    } catch {
      return res.json([]);
    }
  });

  // GET /api/aura/lexico — keyword list for autocomplete
  app.get("/api/aura/lexico", (_req, res) => {
    res.json(PALAVRAS_SUGERIDAS);
  });

  // GET /api/aura/score/:membroId — public score (always calculated if ≥1 evaluation)
  app.get("/api/aura/score/:membroId", async (req, res) => {
    try {
      const { membroId } = req.params;
      const avaliacoes = await storage.getAuraAvaliacoesByAvaliado(membroId);
      if (avaliacoes.length === 0) {
        return res.json({ score: null, T: null, R: null, C: null, n: 0, faixa: null, palavras_recebidas: [] });
      }
      const result = calcularAura(avaliacoes.map(a => ({ avaliador_membro_id: a.avaliador_membro_id, palavras: a.palavras })));
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/aura/minhas-avaliacoes — evaluations received and given by the logged-in member
  app.get("/api/aura/minhas-avaliacoes", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.json({ recebidas: [], dadas: [] });
    const [recebidas, dadas] = await Promise.all([
      storage.getAuraAvaliacoesByAvaliado(membroId),
      storage.getAuraAvaliacoesByAvaliador(membroId),
    ]);

    // Collect all member IDs to resolve names in one request
    const allIds = [
      ...new Set([
        ...dadas.map(a => a.avaliado_membro_id),
        ...recebidas.map(a => a.avaliador_membro_id),
      ]),
    ];
    let nomesMap: Record<string, string> = {};
    if (allIds.length > 0) {
      try {
        const idsFilter = allIds.map(id => `filter%5Bid%5D%5B_in%5D%5B%5D=${encodeURIComponent(id)}`).join("&");
        const r = await fetch(`${DIRECTUS_URL}/items/cadastro_geral?fields=id,nome&${idsFilter}`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        });
        if (r.ok) {
          const json = await r.json();
          for (const m of (json.data || [])) nomesMap[m.id] = m.nome || m.id;
        }
      } catch { /* fallback to id on error */ }
    }

    const dadasEnriquecidas = dadas.map(a => ({
      ...a,
      avaliado_nome: nomesMap[a.avaliado_membro_id] ?? null,
    }));
    const recebidasEnriquecidas = recebidas.map(a => ({
      ...a,
      avaliador_nome: nomesMap[a.avaliador_membro_id] ?? null,
    }));

    return res.json({ recebidas: recebidasEnriquecidas, dadas: dadasEnriquecidas });
  });

  // GET /api/aura/avaliacao/:avaliadoId — get my evaluation of a specific member
  app.get("/api/aura/avaliacao/:avaliadoId", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.json(null);
    const av = await storage.getAuraAvaliacaoByPair(membroId, req.params.avaliadoId);
    return res.json(av ?? null);
  });

  // POST /api/aura/analisar-texto — AI analysis: pick up to 3 lexicon words from free text
  app.post("/api/aura/analisar-texto", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const { texto, membro_nome } = req.body;
    if (!texto || typeof texto !== "string" || texto.trim().length < 10) {
      return res.status(400).json({ error: "Texto muito curto. Descreva o membro com pelo menos 10 caracteres." });
    }
    const { PALAVRAS_SUGERIDAS: lexico } = await import("./aura-lexico.js");
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de avaliação de perfil profissional. Dado um texto descritivo sobre uma pessoa, seu trabalho é selecionar as 1 a 3 palavras mais relevantes de um léxico fixo que melhor representem as características descritas no texto. Responda APENAS com um array JSON de strings, sem nenhum texto adicional. Exemplo de resposta válida: ["Liderança","Inovação","Colaboração"]. O léxico disponível é: ${lexico.join(", ")}.`,
          },
          {
            role: "user",
            content: `Pessoa avaliada: ${membro_nome || "membro"}\n\nDescrição: ${texto.trim()}\n\nEscolha de 1 a 3 palavras do léxico que melhor descrevem esta pessoa com base no texto acima.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 80,
      });
      const raw = completion.choices[0]?.message?.content?.trim() || "[]";
      let palavras: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          palavras = parsed
            .filter((p: unknown) => typeof p === "string" && lexico.includes(p))
            .slice(0, 3);
        }
      } catch {
        // try to extract words from malformed response
        palavras = lexico.filter(w => raw.includes(w)).slice(0, 3);
      }
      return res.json({ palavras });
    } catch (err: any) {
      console.error("[aura-ai]", err?.message);
      return res.status(500).json({ error: "Erro ao analisar texto com IA. Tente novamente." });
    }
  });

  // POST /api/aura/extrair-arquivo — extract text from uploaded file (TXT or PDF) for AI analysis
  app.post("/api/aura/extrair-arquivo", upload.single("arquivo"), async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const mime = file.mimetype;
    const name = (file.originalname || "").toLowerCase();

    try {
      let texto = "";
      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(file.buffer);
        texto = data.text || "";
      } else if (
        mime.startsWith("text/") ||
        name.endsWith(".txt") ||
        name.endsWith(".md") ||
        name.endsWith(".csv")
      ) {
        texto = file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Tipo de arquivo não suportado. Use PDF ou TXT." });
      }

      texto = texto.replace(/\s+/g, " ").trim();
      if (texto.length > 4000) texto = texto.slice(0, 4000) + "...";
      if (texto.length < 5) return res.status(400).json({ error: "Não foi possível extrair texto do arquivo." });

      return res.json({ texto });
    } catch (err: any) {
      console.error("[aura-arquivo]", err?.message);
      return res.status(500).json({ error: "Erro ao processar o arquivo." });
    }
  });

  // POST /api/aura/avaliar — submit an evaluation (one per pair, no updates)
  app.post("/api/aura/avaliar", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.status(400).json({ error: "Membro não encontrado" });

    const { avaliado_membro_id, palavras } = req.body;
    if (!avaliado_membro_id || !Array.isArray(palavras) || palavras.length < 1 || palavras.length > 3) {
      return res.status(400).json({ error: "Informe entre 1 e 3 palavras" });
    }
    if (!palavras.every((p: unknown) => typeof p === "string" && p.trim().length > 0)) {
      return res.status(400).json({ error: "Todas as palavras devem ser texto não vazio" });
    }
    if (avaliado_membro_id === membroId) {
      return res.status(400).json({ error: "Você não pode avaliar a si mesmo" });
    }
    // Block duplicate evaluations
    const existing = await storage.getAuraAvaliacaoByPair(membroId, avaliado_membro_id);
    if (existing) {
      return res.status(409).json({ error: "Você já avaliou este membro e não pode repetir a avaliação." });
    }
    // Validate all words are in the lexicon
    for (const p of palavras) {
      if (!classificarPalavra(p)) return res.status(400).json({ error: `Palavra não reconhecida: ${p}` });
    }
    const result = await storage.upsertAuraAvaliacao(membroId, avaliado_membro_id, palavras);
    return res.json(result);
  });

  return httpServer;
}
