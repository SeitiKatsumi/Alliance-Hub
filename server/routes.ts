import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createUserSchema, updateUserSchema, insertAgendaTarefaSchema, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS, permissionsForRole, nucleoTecnicoDocs, aliancaDocs, biaMouAceites, biaUserPermissions, membroComunidadeMae, userUsageEvents, users as usersTable, opaInteresses, agendaTarefas, convitesComunidade, biaDiretorSolicitacoes, biaSocioSolicitacoes, chamadasAlianca, auraAvaliacoes, anuncios } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { db } from "./db";
import { and, eq, desc, sql } from "drizzle-orm";
import { getStripeClient } from "./stripe";
import { PinbankClient, type PinbankChargePayload, type PinbankChargeQueryPayload, type PinbankCompanyOnboardingPayload, type PinbankDocumentPayload } from "./pinbank-client";
import { PNG } from "pngjs";
import { randomUUID } from "crypto";
import { deflateSync } from "zlib";
import { buildComparableMarketAnalysis, MARKET_AREA_TOLERANCE_M2 } from "./market-comparables";
import { normalizeBiaOriginPatch } from "./bia-origin-value";
import { resolveAuraAudioMetadata } from "./aura-audio";
import {
  buildCarteiraAlternativas,
  diagnosticarCarteira,
  hasCarteiraAccess,
  isCarteiraAccessLevel,
  type CarteiraAccessLevel,
} from "@shared/carteira";
import {
  BIA_ACCESS_KEYS,
  BIA_PARTICIPANT_ROLE_LABELS,
  EMPTY_BIA_ACCESS,
  FULL_BIA_ACCESS,
  canConfigureBiaParticipantAccess,
  canManageBiaAccess,
  collectBiaParticipantRoles,
  defaultBiaAccessForRoles,
  hasBiaAccess,
  isBiaAccessLevel,
  normalizeBiaAccessMatrix,
  resolveBiaParticipantPermissions,
  type BiaAccessKey,
  type BiaAccessLevel,
  type BiaAccessMatrix,
  type BiaParticipantRole,
} from "@shared/bia-access";
import {
  COMPANY_ACCESS_KEYS,
  companyAccessToLegacyPermissions,
  hasCompanyAccess,
  normalizeCompanyAccess,
  type CompanyAccessKey,
  type CompanyAccessLevel,
  type CompanyAccessMatrix,
} from "@shared/company-access";

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    const error: any = new Error("OPENAI_API_KEY nao configurada no servidor.");
    error.status = 503;
    throw error;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

function parsePtBrMoney(value: string): number {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(Number(amount.toFixed(2))) : 0;
}

function parsePtBrDate(value: string): string | null {
  const match = String(value || "").match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const rawYear = match[3];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : iso;
}

function inferFinancialStatus(rowText: string, dueDate: string | null, today: string): string {
  const text = rowText.toLowerCase();
  if (/\b(pago|paga|quitado|quitada|baixado|baixada|liquidado|liquidada|compensado|realizado|realizada)\b/.test(text)) return "pago";
  if (/\b(agendado|agendada|programado|programada)\b/.test(text)) return "agendado";
  if (/\b(cancelado|cancelada|estornado|estornada)\b/.test(text)) return "cancelado";
  if (/\b(parcial|parcialmente)\b/.test(text)) return "parcial";
  if (dueDate && dueDate < today) return "vencido";
  return dueDate ? "agendado" : "pendente";
}

function extractInstallmentLancamentos(textContent: string, today: string) {
  const rawLines = String(textContent || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const parsed = rawLines
    .map((line) => {
      const hasInstallmentSignal = /\bparcela\b/i.test(line) || /^\d{1,4}[\s,;|-]+/.test(line);
      if (!hasInstallmentSignal) return null;
      const date = parsePtBrDate(line);
      if (!date) return null;

      const beforeDate = line.slice(0, Math.max(0, line.search(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/)));
      const parcelaMatch = beforeDate.match(/(?:parcela\s*)?(\d{1,4})\D*$/i) || line.match(/\bparcela\s*(\d{1,4})\b/i);
      if (!parcelaMatch) return null;

      const moneyMatches = [...line.matchAll(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?-?\d+,\d{2}/gi)];
      if (moneyMatches.length === 0) return null;
      const amount = parsePtBrMoney(moneyMatches[moneyMatches.length - 1][0]);
      if (amount <= 0) return null;

      const parcela = Number(parcelaMatch[1]);
      return {
        parcela,
        line,
        tipo: "saida",
        valor: amount,
        data: date,
        data_vencimento: date,
        data_pagamento: /\b(pago|paga|quitado|quitada|baixado|baixada|liquidado|liquidada|compensado|realizado|realizada)\b/i.test(line) ? date : null,
        status: inferFinancialStatus(line, date, today),
        descricao: `Parcela ${parcela}`,
        categoria_id: null,
        categoria_nome: null,
        tipo_cpp_id: null,
        tipo_cpp_nome: null,
        observacao: line.slice(0, 180),
      };
    })
    .filter(Boolean) as any[];

  if (parsed.length === 0) return [];
  const totalParcelas = Math.max(...parsed.map((item) => item.parcela || 0));
  return parsed
    .sort((a, b) => (a.parcela || 0) - (b.parcela || 0))
    .map((item) => ({
      ...item,
      descricao: totalParcelas > 0 ? `Parcela ${item.parcela}/${totalParcelas}` : `Parcela ${item.parcela}`,
      observacao: `${item.observacao}${item.status === "pago" ? " | Pagamento identificado no arquivo" : " | Vencimento identificado no arquivo"}`.slice(0, 180),
    }));
}

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://databases.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";
const PRODUCTION_APP_API_URL = (process.env.PRODUCTION_APP_API_URL || "https://app.builtalliances.com").replace(/\/$/, "");
const ASSET_CACHE_VERSION = "directus-db-20260616";
const ROUTES_DIR = process.env.NODE_ENV === "production" ? path.join(process.cwd(), "dist") : process.cwd();
const nucleoTecnicoDocsFallback: any[] = [];
const documentsFallbackFile = path.join(process.cwd(), "data", "documentos-aliancas-fallback.json");
type DocumentsFallbackKind = "tecnico" | "alianca";

function readDocumentsFallback(): Record<DocumentsFallbackKind, any[]> {
  try {
    if (!fs.existsSync(documentsFallbackFile)) return { tecnico: [], alianca: [] };
    const parsed = JSON.parse(fs.readFileSync(documentsFallbackFile, "utf8"));
    return {
      tecnico: Array.isArray(parsed?.tecnico) ? parsed.tecnico : [],
      alianca: Array.isArray(parsed?.alianca) ? parsed.alianca : [],
    };
  } catch (error: any) {
    console.warn("[documentos-fallback] arquivo local invalido:", error?.message || error);
    return { tecnico: [], alianca: [] };
  }
}

function writeDocumentsFallback(store: Record<DocumentsFallbackKind, any[]>) {
  fs.mkdirSync(path.dirname(documentsFallbackFile), { recursive: true });
  fs.writeFileSync(documentsFallbackFile, JSON.stringify(store, null, 2), "utf8");
}

function listFallbackDocuments(kind: DocumentsFallbackKind) {
  return readDocumentsFallback()[kind];
}

function upsertFallbackDocument(kind: DocumentsFallbackKind, item: any) {
  const store = readDocumentsFallback();
  const index = store[kind].findIndex((current: any) => String(current.id) === String(item.id));
  if (index >= 0) store[kind][index] = item;
  else store[kind].unshift(item);
  writeDocumentsFallback(store);
  return item;
}

function deleteFallbackDocument(kind: DocumentsFallbackKind, id: string) {
  const store = readDocumentsFallback();
  const next = store[kind].filter((item: any) => String(item.id) !== String(id));
  if (next.length === store[kind].length) return false;
  store[kind] = next;
  writeDocumentsFallback(store);
  return true;
}

const BOOTSTRAP_SUPERADMIN_EMAILS = new Set(["seitikatsumi@gmail.com"]);
const FULL_ADMIN_PERMISSIONS: Record<string, string> = {
  aura: "edit",
  bias: "edit",
  admin: "edit",
  painel: "edit",
  membros: "edit",
  calculadora: "edit",
  fluxo_caixa: "edit",
  oportunidades: "edit",
  cadastro_geral: "edit",
};

function isBootstrapSuperAdmin(email?: string | null) {
  return !!email && BOOTSTRAP_SUPERADMIN_EMAILS.has(String(email).trim().toLowerCase());
}
const BIA_DM_PERCENT_FIELDS = new Set([
  "perc_autor_opa",
  "perc_aliado_built",
  "perc_built",
  "perc_dir_alianca",
  "perc_dir_tecnico",
  "perc_dir_obras",
  "perc_dir_comercial",
  "perc_dir_capital",
]);

// Resolved at startup: actual collection name for comunidade (default is "Comunidade" â€” confirmed always correct)
let COMUNIDADE_COL = "Comunidade";
// Promise that resolves once ensureComunidadeFields() has discovered the real collection name
let comunidadeColResolve: (() => void) | null = null;
const comunidadeColReady: Promise<void> = new Promise(res => { comunidadeColResolve = res; });
async function getComunidadeCol(): Promise<string> {
  await comunidadeColReady;
  return COMUNIDADE_COL;
}

const BIA_INFO_COMERCIAL_FIELDS = [
  "razao_social",
  "cnpj",
  "nome_fantasia",
  "inscricao_estadual",
  "banco",
  "agencia",
  "conta",
  "tipo_conta",
  "titular_conta",
  "chave_pix",
  "ativo_endereco",
  "ativo_bairro",
  "ativo_cidade",
  "ativo_estado",
  "ativo_pais",
  "ativo_qualificacao",
  "ativo_descricao_adicional",
  "ativo_area_m2",
  "ativo_numero",
  "ativo_complemento",
  "ativo_cep",
  "ativo_numero_matricula",
  "ativo_livro",
  "ativo_folha",
  "ativo_cartorio",
  "ativo_comarca",
] as const;

function pickBiaInfoComercialFields(source: Record<string, any> = {}) {
  return Object.fromEntries(
    BIA_INFO_COMERCIAL_FIELDS.map((field) => [field, source[field] ?? null])
  );
}

function pickFilledBiaInfoComercialFields(source: Record<string, any> = {}) {
  return Object.fromEntries(
    BIA_INFO_COMERCIAL_FIELDS
      .filter((field) => source[field] !== null && source[field] !== undefined && source[field] !== "")
      .map((field) => [field, source[field]])
  );
}

async function ensureBiasExtraFields() {
  const fields = [
    {
      field: "codigo_publico",
      type: "string",
      meta: { interface: "input", display: "raw", hidden: false, note: "Codigo publico curto usado na URL da BIA" },
      schema: { is_nullable: true, is_unique: true, max_length: 10 },
    },
    {
      field: "situacao",
      type: "string",
      meta: { interface: "select-dropdown", display: "raw", hidden: false, options: { choices: [{ text: "Ativa", value: "ativa" }, { text: "Em FormaÃ§Ã£o", value: "em_formacao" }] } },
      schema: { is_nullable: true, default_value: "ativa" },
    },
    {
      field: "destinacao",
      type: "string",
      meta: { interface: "input", display: "raw", hidden: false },
      schema: { is_nullable: true },
    },
    {
      field: "bia_publica",
      type: "boolean",
      meta: { interface: "boolean", display: "boolean", hidden: false, note: "Controla se a BIA aparece na listagem pÃºblica" },
      schema: { is_nullable: true, default_value: true },
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
      field: "imagem_directus_id",
      type: "uuid",
      meta: {
        interface: "file-image",
        display: "image",
        hidden: false,
        note: "Imagem de capa da BIA exibida nos cards",
      },
      schema: { is_nullable: true },
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
      meta: { interface: "input", display: "raw", hidden: false, note: "CÃ³digo ISO da moeda (ex: BRL, USD, EUR)" },
      schema: { is_nullable: true, default_value: "BRL" },
    },
    {
      field: "socios_multiplicadores",
      type: "text",
      meta: { interface: "input-code", display: "raw", hidden: false, note: "JSON com IDs dos SÃ³cios Multiplicadores" },
      schema: { is_nullable: true },
    },
    {
      field: "socios_guardioes",
      type: "text",
      meta: { interface: "input-code", display: "raw", hidden: false, note: "JSON com IDs dos SÃ³cios GuardiÃµes" },
      schema: { is_nullable: true },
    },
    {
      field: "terceiros",
      type: "text",
      meta: { interface: "input-code", display: "raw", hidden: false, note: "JSON com IDs de Terceiros vinculados Ã  BIA" },
      schema: { is_nullable: true },
    },
    ...BIA_INFO_COMERCIAL_FIELDS.map((field) => ({
      field,
      type: "text",
      meta: {
        interface: "input",
        display: "raw",
        hidden: false,
        note: "Campo da aba InformaÃ§Ãµes da BIA",
      },
      schema: { is_nullable: true },
    })),
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

async function ensureBiasFinancialFieldPrecision() {
  const field = "total_receita";
  const desiredPrecision = 18;
  const desiredScale = 2;

  try {
    const currentRes = await fetch(`${DIRECTUS_URL}/fields/bias_projetos/${field}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!currentRes.ok) {
      console.warn(`[bia-financeiro] Cannot inspect ${field}:`, currentRes.status);
      return;
    }

    const current = (await currentRes.json())?.data;
    const precision = Number(current?.schema?.numeric_precision || 0);
    const scale = Number(current?.schema?.numeric_scale || 0);
    const integerDigits = precision - scale;
    const desiredIntegerDigits = desiredPrecision - desiredScale;
    if (integerDigits >= desiredIntegerDigits && scale >= desiredScale) return;

    const patchRes = await fetch(`${DIRECTUS_URL}/fields/bias_projetos/${field}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "decimal",
        schema: {
          data_type: "numeric",
          numeric_precision: desiredPrecision,
          numeric_scale: desiredScale,
          is_nullable: true,
        },
      }),
    });
    if (!patchRes.ok) {
      const body = await patchRes.json().catch(() => ({}));
      console.warn(`[bia-financeiro] Could not expand ${field}:`, patchRes.status, JSON.stringify(body));
      return;
    }

    console.log(`[bia-financeiro] Expanded ${field} to numeric(${desiredPrecision},${desiredScale})`);
  } catch (error) {
    console.warn(`[bia-financeiro] Error while expanding ${field}:`, error);
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

    // Force ALTER TABLE to varchar(500) â€” fix MySQL column that may be too short or wrongly typed as text
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

async function ensureOpaMediaFields() {
  const fields = [
    {
      field: "imagem_directus_id",
      type: "uuid",
      meta: {
        interface: "file-image",
        display: "image",
        hidden: false,
        note: "Imagem de capa da OBA exibida nos cards da Vitrine",
      },
      schema: { is_nullable: true },
    },
    {
      field: "ramo_atuacao",
      type: "string",
      meta: {
        interface: "input",
        display: "raw",
        hidden: false,
        note: "Ramo de atuaÃ§Ã£o da OBA usado no Painel de ConvergÃªncia",
      },
      schema: { is_nullable: true },
    },
    {
      field: "criado_por_user_id",
      type: "string",
      meta: {
        interface: "input",
        display: "raw",
        hidden: true,
        note: "UsuÃ¡rio local que criou a OBA",
      },
      schema: { is_nullable: true },
    },
    {
      field: "criado_por_membro_id",
      type: "uuid",
      meta: {
        interface: "input",
        display: "raw",
        hidden: true,
        note: "Membro que criou a OBA",
      },
      schema: { is_nullable: true },
    },
  ];
  for (const fieldDef of fields) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/tipos_oportunidades`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(fieldDef),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.errors?.[0]?.extensions?.code;
        if (code !== "RECORD_NOT_UNIQUE" && code !== "FORBIDDEN") {
          console.warn(`[opa-media] Field ${fieldDef.field} response: ${res.status}`);
        }
      }
    } catch (e) {
      // Ignore startup network errors; API payloads still work if the field already exists.
    }
  }
}

async function ensureVitrineFields() {
  const fields = [
    { field: "na_vitrine", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "em_membros_built", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "em_built_capital", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: false } },
    { field: "link_site", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "latitude", type: "float", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "longitude", type: "float", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "foto_posicao_x", type: "float", meta: { interface: "input", hidden: false, note: "Posicao horizontal da foto de perfil (0 a 100)" }, schema: { is_nullable: true, default_value: 50 } },
    { field: "foto_posicao_y", type: "float", meta: { interface: "input", hidden: false, note: "Posicao vertical da foto de perfil (0 a 100)" }, schema: { is_nullable: true, default_value: 50 } },
    { field: "logo_empresa", type: "uuid", meta: { interface: "file-image", display: "image", hidden: false, note: "Logo ou marca da empresa" }, schema: { is_nullable: true } },
    { field: "especialidade_livre", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Especialidade em texto livre" }, schema: { is_nullable: true } },
    { field: "ramo_atuacao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Ramo de atuaÃ§Ã£o (cascata)" }, schema: { is_nullable: true } },
    { field: "segmento", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Segmento dentro do ramo de atuaÃ§Ã£o" }, schema: { is_nullable: true } },
    {
      field: "area_atuacao",
      type: "string",
      meta: {
        interface: "select-dropdown",
        display: "raw",
        hidden: false,
        note: "AbrangÃªncia de atuaÃ§Ã£o do membro",
        options: {
          choices: [
            { text: "Local", value: "Local" },
            { text: "Regional", value: "Regional" },
            { text: "Nacional", value: "Nacional" },
            { text: "Global", value: "Global" },
          ],
        },
      },
      schema: { is_nullable: true },
    },
    { field: "idiomas", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "Idiomas falados" }, schema: { is_nullable: true } },
    { field: "nucleos_alianca", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "MÃºltiplos nÃºcleos de alianÃ§a" }, schema: { is_nullable: true } },
    { field: "tipos_alianca", type: "json", meta: { interface: "tags", display: "raw", hidden: false, note: "MÃºltiplos tipos de alianÃ§a" }, schema: { is_nullable: true } },
    { field: "codigo_etica_aceito_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de aceite do Codigo de Etica BUILT" }, schema: { is_nullable: true } },
    { field: "codigo_etica_versao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Versao do Codigo de Etica aceito" }, schema: { is_nullable: true } },
    { field: "politicas_participacao_aceito_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de aceite das Politicas de Participacao e Protecao BUILT" }, schema: { is_nullable: true } },
    { field: "politicas_participacao_versao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Versao das Politicas de Participacao e Protecao aceitas" }, schema: { is_nullable: true } },
    { field: "vitrine_termo_aceito_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de aceite do Termo BUILT Vitrine" }, schema: { is_nullable: true } },
    { field: "vitrine_termo_versao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Versao do Termo BUILT Vitrine aceito" }, schema: { is_nullable: true } },
    { field: "built_capital_termo_aceito_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de aceite do Termo BUILT Capital" }, schema: { is_nullable: true } },
    { field: "built_capital_termo_versao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Versao do Termo BUILT Capital aceito" }, schema: { is_nullable: true } },
    { field: "area_aliancas_termo_aceito_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de aceite do Termo Area de Aliancas" }, schema: { is_nullable: true } },
    { field: "area_aliancas_termo_versao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Versao do Termo Area de Aliancas aceito" }, schema: { is_nullable: true } },
    { field: "nacionalidade", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Nacionalidade para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "nome_mae", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Nome da mae para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "nome_pai", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Nome do pai para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "data_nascimento", type: "date", meta: { interface: "datetime", display: "datetime", hidden: false, note: "Data de nascimento para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "profissao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Profissao para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "cpf", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "CPF para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "cnpj", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "CNPJ da empresa vinculada ao perfil" }, schema: { is_nullable: true } },
    { field: "rg", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "RG para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "estado_civil", type: "string", meta: { interface: "select-dropdown", display: "raw", hidden: false, note: "Estado civil para formalizacao de BIA", options: { choices: [
      { text: "Solteiro(a)", value: "solteiro" },
      { text: "Casado(a)", value: "casado" },
      { text: "Divorciado(a)", value: "divorciado" },
      { text: "Viuvo(a)", value: "viuvo" },
      { text: "Uniao estavel", value: "uniao_estavel" },
    ] } }, schema: { is_nullable: true } },
    { field: "regime_comunhao", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Regime de comunhao para formalizacao de BIA" }, schema: { is_nullable: true } },
    { field: "conjuge_nome_completo", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_nacionalidade", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_nome_mae", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_nome_pai", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_data_nascimento", type: "date", meta: { interface: "datetime", display: "datetime", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_profissao", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_email", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_telefone", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_cpf", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_rg", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "mesmo_endereco", type: "boolean", meta: { interface: "boolean", display: "boolean", hidden: false }, schema: { is_nullable: true, default_value: true } },
    { field: "cep", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "endereco", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "numero", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "complemento", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "bairro", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_cep", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_endereco", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_numero", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_complemento", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_bairro", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_cidade", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_estado", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "titular_pais", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_cep", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_endereco", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_numero", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_complemento", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_bairro", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_cidade", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_estado", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "conjuge_pais", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
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
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Directus error: ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Directus retornou ${contentType || "conteudo nao JSON"}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (error: any) {
    const fallback = await fetchProductionCollectionFallback(collection);
    if (fallback) return fallback;
    throw error;
  }
}

// Like directusFetch but does NOT prepend fields=* â€” for targeted queries with explicit fields + filters
async function directusFetchScoped(collection: string, params: string) {
  const hasLimit = /(^|&)limit=/.test(params);
  const url = `${DIRECTUS_URL}/items/${collection}?${hasLimit ? "" : "limit=-1&"}${params}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Directus error: ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Directus retornou ${contentType || "conteudo nao JSON"}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (error: any) {
    const fallback = await fetchProductionCollectionFallback(collection);
    if (fallback) return fallback;
    throw error;
  }
}

async function fetchProductionCollectionFallback(collection: string): Promise<any[] | null> {
  const normalizedCollection = String(collection || "").toLowerCase();
  if (normalizedCollection === "cadastro_geral") {
    const cached = readCachedApiArrayFromLogs("/api/membros") || readCachedApiArrayFromLogs("/api/vitrine");
    if (cached) {
      console.warn(`[directus-fallback] ${collection} carregado do ultimo snapshot local dos logs`);
      return cached;
    }
  }
  if (normalizedCollection === "comunidade" || normalizedCollection === "comunidades") {
    const cached = readCachedApiArrayFromLogs("/api/comunidades");
    if (cached) {
      console.warn(`[directus-fallback] ${collection} carregado do ultimo snapshot local dos logs`);
      return cached;
    }
  }
  const endpointByCollection: Record<string, string> = {
    bias_projetos: "/api/bias",
    tipos_oportunidades: "/api/oportunidades",
  };
  const endpoint = endpointByCollection[collection];
  if (!endpoint) return null;
  try {
    const res = await fetch(`${PRODUCTION_APP_API_URL}${endpoint}`);
    if (!res.ok) throw new Error(`Production API fallback error: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    console.warn(`[directus-fallback] ${collection} carregado via ${PRODUCTION_APP_API_URL}${endpoint}`);
    return data;
  } catch (fallbackError: any) {
    console.warn(`[directus-fallback] falha em ${collection}:`, fallbackError?.message || fallbackError);
    return null;
  }
}

async function fetchProductionItemFallback(collection: string, id: string): Promise<any | null> {
  const items = await fetchProductionCollectionFallback(collection);
  if (!items) return null;
  return items.find((item) => String(item?.id) === String(id)) || null;
}

function readCachedApiArrayFromLogs(endpoint: string): any[] | null {
  const candidates = fs.readdirSync(process.cwd())
    .filter((file) => file.endsWith(".log"))
    .map((file) => path.resolve(process.cwd(), file));
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).reverse();
      const line = lines.find((entry) => entry.includes(`GET ${endpoint} `) && entry.includes(":: ["));
      if (!line) continue;
      const jsonStart = line.indexOf(":: ");
      if (jsonStart < 0) continue;
      const data = JSON.parse(line.slice(jsonStart + 3));
      if (Array.isArray(data)) return data;
    } catch {
      continue;
    }
  }
  return null;
}

function sendAssetPlaceholder(res: any, id: string, width = 640, height = 360) {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = [
    ["#071523", "#123f6b", "#6de6ff"],
    ["#061722", "#174d3e", "#46d989"],
    ["#120f19", "#4d2f78", "#d7bb7d"],
    ["#101820", "#654321", "#f2b84b"],
  ][hash % 4];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset="0.65" stop-color="${palette[1]}"/>
      <stop offset="1" stop-color="${palette[2]}"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0v48" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.28)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="rgba(255,255,255,.08)"/>
  <path d="M${Math.round(width * 0.08)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.28)} ${Math.round(height * 0.46)}, ${Math.round(width * 0.46)} ${Math.round(height * 0.88)}, ${Math.round(width * 0.68)} ${Math.round(height * 0.58)} S ${Math.round(width * 0.92)} ${Math.round(height * 0.36)}, ${Math.round(width * 0.98)} ${Math.round(height * 0.44)}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>
  <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.18)}" fill="rgba(255,255,255,.92)" font-family="Arial, sans-serif" font-size="${Math.round(height * 0.14)}" font-weight="800" letter-spacing="4">BUILT</text>
  <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.3)}" fill="rgba(255,255,255,.7)" font-family="Arial, sans-serif" font-size="${Math.round(height * 0.045)}" letter-spacing="3">ALLIANCES</text>
</svg>`;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(svg);
}

async function proxyDirectusAsset(req: any, res: any) {
  const { id } = req.params;
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const width = Number(req.query.width) || 640;
  const height = Number(req.query.height) || 360;
  const assetUrls = [
    `${DIRECTUS_URL}/assets/${id}${qs ? `?${qs}` : ""}`,
    `${PRODUCTION_APP_API_URL}/api/assets/${id}${qs ? `?${qs}` : ""}`,
    `${PRODUCTION_APP_API_URL}/assets/${id}${qs ? `?${qs}` : ""}`,
  ];

  for (const url of assetUrls) {
    try {
      const headers: Record<string, string> = {};
      if (url.startsWith(DIRECTUS_URL) && DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
      const upstream = await fetch(url, { headers });
      if (!upstream.ok) continue;
      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = await upstream.arrayBuffer();
      return res.send(Buffer.from(buf));
    } catch {
      continue;
    }
  }

  return sendAssetPlaceholder(res, id, width, height);
}

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.id || value.uuid || value.directus_files_id || value.file || null;
  }
  return String(value);
}

function assetApiUrl(id: any) {
  const assetId = directusAssetId(id);
  if (!assetId) return null;
  return `/api/assets/${assetId}?v=${ASSET_CACHE_VERSION}`;
}

async function directusFetchOne(collection: string, id: string, params: string = "") {
  const url = `${DIRECTUS_URL}/items/${collection}/${id}?fields=*${params ? "&" + params : ""}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Directus error: ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Directus retornou ${contentType || "conteudo nao JSON"}`);
    }
    const json = await res.json();
    return json.data || null;
  } catch (error: any) {
    const fallback = await fetchProductionItemFallback(collection, id);
    if (fallback) return fallback;
    throw error;
  }
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

const BIA_PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BIA_PUBLIC_CODE_LENGTH = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIA_PUBLIC_CODE_RE = /^[A-Z2-9]{10}$/;

function generateBiaPublicCode(): string {
  let code = "";
  for (let i = 0; i < BIA_PUBLIC_CODE_LENGTH; i++) {
    code += BIA_PUBLIC_CODE_ALPHABET[Math.floor(Math.random() * BIA_PUBLIC_CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeBiaPublicCode(value: string): string {
  return String(value || "").trim().toUpperCase();
}

async function findBiaByPublicCode(code: string, fields = "id,codigo_publico") {
  const normalized = normalizeBiaPublicCode(code);
  if (!BIA_PUBLIC_CODE_RE.test(normalized)) return null;
  const items = await directusFetchScoped(
    "bias_projetos",
    `filter[codigo_publico][_eq]=${encodeURIComponent(normalized)}&limit=1&fields=${encodeURIComponent(fields)}`
  );
  return items[0] || null;
}

async function createUniqueBiaPublicCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateBiaPublicCode();
    const existing = await findBiaByPublicCode(code, "id").catch(() => null);
    if (!existing) return code;
  }
  throw new Error("Nao foi possivel gerar codigo publico unico para a BIA.");
}

async function ensureBiaPublicCode(item: any): Promise<any> {
  if (!item?.id || item.codigo_publico) return item;
  const codigo_publico = await createUniqueBiaPublicCode();
  try {
    const updated = await directusUpdate("bias_projetos", item.id, { codigo_publico });
    return updated && Object.keys(updated).length > 0 ? updated : { ...item, codigo_publico };
  } catch (error: any) {
    console.warn(`[bia] nao foi possivel salvar codigo_publico para ${item.id}:`, error?.message || error);
    return { ...item, codigo_publico };
  }
}

async function resolveBiaByIdOrPublicCode(idOrCode: string, fields = "*,Anexos.directus_files_id.*") {
  const ref = String(idOrCode || "").trim();
  if (!ref) return null;
  if (UUID_RE.test(ref)) {
    const item = await directusFetchOne("bias_projetos", ref, `fields=${fields}`);
    return item ? await ensureBiaPublicCode(item) : null;
  }
  const byCode = await findBiaByPublicCode(ref, fields);
  return byCode ? await ensureBiaPublicCode(byCode) : null;
}

type DirectusFieldInfo = { field: string; type?: string; special?: string[] | null };
const directusFieldInfoCache = new Map<string, DirectusFieldInfo[]>();

async function getDirectusFieldInfo(collection: string): Promise<DirectusFieldInfo[]> {
  const cached = directusFieldInfoCache.get(collection);
  if (cached) return cached;
  try {
    const res = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const fields = (json.data || []).map((item: any) => ({
      field: item.field,
      type: item.type,
      special: item.meta?.special || item.special || null,
    })).filter((item: DirectusFieldInfo) => !!item.field);
    directusFieldInfoCache.set(collection, fields);
    return fields;
  } catch {
    return [];
  }
}

function isEmailLikeValue(value: any): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function normalizeDirectusPatchPayload(collection: string, payload: Record<string, any>) {
  const fields = await getDirectusFieldInfo(collection);
  if (!fields.length) return payload;
  const fieldByName = new Map(fields.map((field) => [field.field, field]));
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    const field = fieldByName.get(key);
    if (!field) continue;

    if (collection === "cadastro_geral" && key === "link_site" && isEmailLikeValue(value)) {
      normalized[key] = null;
      continue;
    }

    if ((field.type === "string" || field.type === "text") && (Array.isArray(value) || (value && typeof value === "object"))) {
      normalized[key] = Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
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

async function ensureAnunciosPagamentoFields() {
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS ambiente text NOT NULL DEFAULT 'vitrine'`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS slot_tipo text NOT NULL DEFAULT 'padrao'`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_provider text`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_id text`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_url text`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_status text`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_pais text`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS pagamento_gerado_em timestamp`);
  await db.execute(sql`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS publicado_em timestamp`);
}

async function ensureFluxoCaixaHistoricoTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fluxo_caixa_historico (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      fluxo_caixa_id text NOT NULL,
      bia_id text,
      acao text NOT NULL,
      ator_user_id text,
      ator_membro_id text,
      ator_nome text,
      origem text,
      dados_antes jsonb,
      dados_depois jsonb,
      payload jsonb,
      anexos jsonb,
      criado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_historico_fluxo ON fluxo_caixa_historico (fluxo_caixa_id, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_historico_bia ON fluxo_caixa_historico (bia_id, criado_em DESC)`);
}

async function ensureBiaUserPermissionsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_user_permissions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      membro_id text NOT NULL,
      permissions jsonb NOT NULL,
      updated_by_user_id text,
      updated_by_membro_id text,
      updated_by_nome text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT bia_user_permissions_bia_membro_uniq UNIQUE (bia_id, membro_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_user_permissions_bia ON bia_user_permissions (bia_id)`);
}

async function ensureCompanyEmployeeAccountsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_employee_accounts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id text NOT NULL,
      owner_membro_id text,
      owner_nome text,
      owner_email text,
      employee_user_id text NOT NULL UNIQUE,
      cargo text,
      permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'ativo',
      updated_by_user_id text,
      last_login_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE company_employee_accounts ADD COLUMN IF NOT EXISTS owner_nome text`);
  await db.execute(sql`ALTER TABLE company_employee_accounts ADD COLUMN IF NOT EXISTS owner_email text`);
  await db.execute(sql`ALTER TABLE company_employee_accounts ADD COLUMN IF NOT EXISTS updated_by_user_id text`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_company_employee_accounts_owner ON company_employee_accounts (owner_user_id, created_at DESC)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_company_employee_accounts_employee ON company_employee_accounts (employee_user_id)`);
}

async function ensureBiaBancoTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_bank_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL UNIQUE,
      provider text NOT NULL DEFAULT 'pinbank',
      external_account_id text,
      status text NOT NULL DEFAULT 'not_started',
      terms_version text,
      terms_accepted_at timestamp,
      terms_accepted_by_user_id text,
      terms_accepted_by_membro_id text,
      terms_accepted_by_nome text,
      terms_acceptance_location jsonb,
      onboarding_requested_at timestamp,
      onboarding_payload jsonb,
      provider_payload jsonb,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE bia_bank_accounts ADD COLUMN IF NOT EXISTS terms_acceptance_location jsonb`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_bank_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      membro_id text,
      tipo text NOT NULL,
      file_id text NOT NULL,
      status text NOT NULL DEFAULT 'sent',
      provider_document_id text,
      provider_payload jsonb,
      permission_shared_at timestamp,
      permission_shared_by_user_id text,
      permission_shared_by_membro_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_bank_charges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      fluxo_caixa_id text,
      provider text NOT NULL DEFAULT 'pinbank',
      type text NOT NULL DEFAULT 'boleto',
      status text NOT NULL DEFAULT 'pending',
      descricao text,
      valor numeric,
      data_vencimento date,
      pagador_nome text,
      pagador_email text,
      pagador_documento text,
      nosso_numero text,
      payment_id text,
      payment_url text,
      linha_digitavel text,
      payload jsonb,
      provider_payload jsonb,
      created_by_user_id text,
      created_by_membro_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE bia_bank_documents ADD COLUMN IF NOT EXISTS provider_payload jsonb`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_bank_documents_bia ON bia_bank_documents (bia_id, tipo)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_bank_charges_bia ON bia_bank_charges (bia_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_bank_charges_fluxo ON bia_bank_charges (fluxo_caixa_id)`);
}

async function ensureLandBankAssetsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS land_bank_assets (
      id text PRIMARY KEY,
      category text NOT NULL,
      bia_id text,
      bia_nome text,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by text,
      created_by_membro text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_land_bank_assets_category ON land_bank_assets (category)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_land_bank_assets_bia ON land_bank_assets (bia_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_land_bank_assets_created_at ON land_bank_assets (created_at DESC)`);
}

async function ensureInventarioTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventario_imoveis (
      id text PRIMARY KEY,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      owner_user_id text,
      owner_membro_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventario_lancamentos (
      id text PRIMARY KEY,
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      owner_user_id text,
      owner_membro_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventario_imoveis_owner_user ON inventario_imoveis (owner_user_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventario_imoveis_owner_membro ON inventario_imoveis (owner_membro_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventario_lancamentos_imovel ON inventario_lancamentos (imovel_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventario_lancamentos_owner_user ON inventario_lancamentos (owner_user_id, created_at DESC)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_eventos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      tipo text NOT NULL,
      origem text NOT NULL DEFAULT 'declarada',
      titulo text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_documentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      file_id text NOT NULL,
      nome text NOT NULL,
      tipo text NOT NULL,
      versao integer NOT NULL DEFAULT 1,
      emissao date,
      validade date,
      origem text NOT NULL DEFAULT 'declarada',
      status_validacao text NOT NULL DEFAULT 'declarado',
      dados_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
      observacao text,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_analises (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      tipo text NOT NULL,
      versao_regra text NOT NULL DEFAULT 'carteira-v1',
      entrada jsonb NOT NULL DEFAULT '{}'::jsonb,
      resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_alertas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      tipo text NOT NULL,
      severidade text NOT NULL DEFAULT 'media',
      titulo text NOT NULL,
      descricao text,
      impacto text,
      acao_sugerida text,
      prazo date,
      status text NOT NULL DEFAULT 'aberto',
      delegado_para_user_id text,
      criado_por_user_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_demandas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      tipo_resolucao text NOT NULL DEFAULT 'solicitacao',
      alternativa text,
      titulo text NOT NULL,
      escopo text,
      urgencia text NOT NULL DEFAULT 'normal',
      especialidades jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'rascunho',
      responsavel_user_id text,
      propostas jsonb NOT NULL DEFAULT '[]'::jsonb,
      documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
      proximas_etapas jsonb NOT NULL DEFAULT '[]'::jsonb,
      opa_id text,
      resultado text,
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_acessos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      user_id text,
      membro_id text,
      nivel text NOT NULL DEFAULT 'leitura',
      concedido_por_user_id text,
      concedido_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL,
      CONSTRAINT carteira_acessos_destinatario_check CHECK (user_id IS NOT NULL OR membro_id IS NOT NULL)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_eventos_imovel ON carteira_eventos (imovel_id, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_documentos_imovel ON carteira_documentos (imovel_id, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_analises_imovel ON carteira_analises (imovel_id, tipo, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_alertas_imovel ON carteira_alertas (imovel_id, status, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_demandas_imovel ON carteira_demandas (imovel_id, criado_em DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_acessos_user ON carteira_acessos (user_id, imovel_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_carteira_acessos_membro ON carteira_acessos (membro_id, imovel_id)`);
  await db.execute(sql`ALTER TABLE carteira_demandas ADD COLUMN IF NOT EXISTS propostas jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE carteira_demandas ADD COLUMN IF NOT EXISTS documentos jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE carteira_demandas ADD COLUMN IF NOT EXISTS proximas_etapas jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_acessos_imovel_user_unique ON carteira_acessos (imovel_id, user_id) WHERE user_id IS NOT NULL`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_acessos_imovel_membro_unique ON carteira_acessos (imovel_id, membro_id) WHERE membro_id IS NOT NULL`);
}

async function ensureLandBankAssetsDirectusCollection() {
  const COL = "land_bank_assets";
  try {
    const check = await fetch(`${DIRECTUS_URL}/collections/${COL}`, {
      headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!check.ok) {
      const colRes = await fetch(`${DIRECTUS_URL}/collections`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: COL,
          meta: { singleton: false, icon: "map", note: "Ativos do Land Bank / Banco de Ativos BUILT" },
          fields: [
            { field: "id", type: "uuid", meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] }, schema: { is_primary_key: true, has_auto_increment: false } },
            { field: "local_id", type: "string", meta: { interface: "input", label: "ID local" }, schema: { is_nullable: false, is_unique: true } },
            { field: "category", type: "string", meta: { interface: "select-dropdown", label: "Categoria" }, schema: { is_nullable: false } },
            { field: "bia_id", type: "string", meta: { interface: "input", label: "BIA ID" }, schema: { is_nullable: true } },
            { field: "bia_nome", type: "string", meta: { interface: "input", label: "BIA vinculada" }, schema: { is_nullable: true } },
            { field: "data", type: "json", meta: { interface: "input-code", label: "Dados do ativo" }, schema: { is_nullable: true } },
            { field: "created_by_membro", type: "string", meta: { interface: "input", label: "Membro criador" }, schema: { is_nullable: true } },
            { field: "date_created", type: "timestamp", meta: { interface: "datetime", readonly: true, special: ["date-created"] }, schema: { is_nullable: true } },
            { field: "date_updated", type: "timestamp", meta: { interface: "datetime", readonly: true, special: ["date-updated"] }, schema: { is_nullable: true } },
          ],
        }),
      });
      if (!colRes.ok) {
        console.warn("[land-bank-directus] create collection failed:", await colRes.text());
        return;
      }
    } else {
      const fields = [
        { field: "local_id", type: "string", meta: { interface: "input", label: "ID local" }, schema: { is_nullable: false, is_unique: true } },
        { field: "category", type: "string", meta: { interface: "select-dropdown", label: "Categoria" }, schema: { is_nullable: false } },
        { field: "bia_id", type: "string", meta: { interface: "input", label: "BIA ID" }, schema: { is_nullable: true } },
        { field: "bia_nome", type: "string", meta: { interface: "input", label: "BIA vinculada" }, schema: { is_nullable: true } },
        { field: "data", type: "json", meta: { interface: "input-code", label: "Dados do ativo" }, schema: { is_nullable: true } },
        { field: "created_by_membro", type: "string", meta: { interface: "input", label: "Membro criador" }, schema: { is_nullable: true } },
      ];
      for (const field of fields) await directusFieldPost(COL, field).catch(() => ({ ok: false }));
    }
    await grantCollectionPermissions(COL).catch(() => {});
  } catch (err: any) {
    console.warn("[land-bank-directus] Collection not synced:", err?.message || err);
  }
}

async function ensureMembroComunidadeMaeTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS membro_comunidade_mae (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      membro_id text NOT NULL UNIQUE,
      comunidade_id text NOT NULL,
      source text NOT NULL DEFAULT 'manual_seed',
      locked_at timestamp DEFAULT now() NOT NULL,
      created_by_user_id varchar,
      created_by_membro_id text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_membro_comunidade_mae_comunidade ON membro_comunidade_mae (comunidade_id)`);
}

function getAuditActor(req: any) {
  return {
    userId: (req.session as any)?.directusUserId || (req.session as any)?.userId || null,
    membroId: (req.session as any)?.membroId || null,
    nome: (req.session as any)?.nome || (req.session as any)?.email || null,
  };
}

function extractFluxoAnexosSnapshot(snapshot: any) {
  const anexos = Array.isArray(snapshot?.Anexos) ? snapshot.Anexos : [];
  return anexos.map((rel: any) => {
    const file = rel?.directus_files_id;
    if (!file) return rel;
    if (typeof file === "string") return { id: file, url: `/api/files/${file}` };
    return {
      id: file.id,
      title: file.title || null,
      filename: file.filename_download || file.filename_disk || null,
      type: file.type || null,
      filesize: file.filesize || null,
      uploaded_on: file.uploaded_on || file.created_on || null,
      url: file.id ? `/api/files/${file.id}` : null,
    };
  });
}

async function fetchFluxoSnapshot(id: string) {
  const items = await directusFetchScoped(
    "fluxo_caixa",
    `fields=*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*,favorecido_id.*,membro_responsavel.*&filter[id][_eq]=${encodeURIComponent(id)}`
  );
  return items[0] || null;
}

async function registrarFluxoHistorico(params: {
  fluxoId: string;
  biaId?: string | null;
  acao: string;
  req?: any;
  origem?: string;
  antes?: any;
  depois?: any;
  payload?: any;
}) {
  const actor = params.req ? getAuditActor(params.req) : { userId: null, membroId: null, nome: null };
  const anexosSource = params.depois || params.antes || params.payload || null;
  await db.execute(sql`
    INSERT INTO fluxo_caixa_historico (
      fluxo_caixa_id, bia_id, acao, ator_user_id, ator_membro_id, ator_nome,
      origem, dados_antes, dados_depois, payload, anexos
    )
    VALUES (
      ${params.fluxoId},
      ${params.biaId || params.depois?.bia || params.antes?.bia || params.payload?.bia || params.payload?.bia_id || null},
      ${params.acao},
      ${actor.userId},
      ${actor.membroId},
      ${actor.nome},
      ${params.origem || "app"},
      ${params.antes ? JSON.stringify(params.antes) : null}::jsonb,
      ${params.depois ? JSON.stringify(params.depois) : null}::jsonb,
      ${params.payload ? JSON.stringify(params.payload) : null}::jsonb,
      ${anexosSource ? JSON.stringify(extractFluxoAnexosSnapshot(anexosSource)) : null}::jsonb
    )
  `);
}

async function findOrCreateValorOrigemCategoria(): Promise<number> {
  const cats = await directusFetchScoped("Categorias", "fields=id,Nome_da_categoria");
  const existing = cats.find((c: any) => {
    const name = String(c.Nome_da_categoria || "").trim();
    return name === "Valor de Origem" || name.endsWith(" Valor de Origem");
  });
  if (existing) return existing.id;
  const created = await directusCreate("Categorias", {
    Nome_da_categoria: "1.1 Valor de Origem",
    Tipo_de_categoria: "SaÃ­da",
    Descricao_das_categorias: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO",
  });
  return created.id;
}

// Cache of category name â†’ id to avoid repeated Directus calls within a sync
let _catCache: Record<string, number> | null = null;
async function findCppCategoriaId(categoryName: string): Promise<number | null> {
  if (!_catCache) {
    const cats = await directusFetchScoped("Categorias", "fields=id,Nome_da_categoria");
    _catCache = {};
    for (const c of cats) {
      if (c.Nome_da_categoria) {
        const name = c.Nome_da_categoria.trim();
        _catCache[name] = c.id;
        const withoutCode = name.replace(/^\d+(?:\.\d+)*\s+/, "");
        _catCache[withoutCode] = c.id;
      }
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
      console.warn(`[findTipoCppId] Could not fetch tipos_cpp: ${err.message} â€” tipo_de_cpp will be empty`);
      _tipoCppCache = {};
    }
  }
  return _tipoCppCache[nome.trim()] ?? null;
}

const CPP_CONTRIBUTOR_CATEGORY: Record<string, string> = {
  "BUILT":               "Direito EconÃ´mico Institucional BUILT (DEI-B)",
  "Autor da Oportunidade":"Direito EconÃ´mico por Autoria da Oportunidade (DE-AO)",
  "Aliado BUILT":        "Direito EconÃ´mico Institucional do Aliado (DEI-A)",
  "Dir. de AlianÃ§a":     "Direito EconÃ´mico por LideranÃ§a de AlianÃ§a (DE-LA)",
  "Dir. NÃºcleo TÃ©cnico": "Direito EconÃ´mico por LideranÃ§a TÃ©cnica (DE-LTec)",
  "Dir. NÃºcleo de Obra": "Direito EconÃ´mico por LideranÃ§a de Obra (DE-LObr)",
  "Dir. NÃºcleo Comercial":"Direito EconÃ´mico por LideranÃ§a Comercial (DE-LCom)",
  "Dir. NÃºcleo de Capital":"Direito EconÃ´mico por LideranÃ§a de Capital (DE-LCap)",
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
  const APORTE_MARCA = "Aporte do Fator de MultiplicaÃ§Ã£o";
  _catCache = null;
  _tipoCppCache = null; // reset per-sync so stale IDs are never used

  // Fetch only this BIA's fluxo_caixa entries â€” server-side filtered, minimal fields
  let existing: any[] = [];
  try {
    const biaEntries = await directusFetchScoped(
      "fluxo_caixa",
      `fields=*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*,favorecido_id.*,membro_responsavel.*&filter[bia][_eq]=${encodeURIComponent(biaId)}`
    );
    existing = biaEntries.filter((e: any) => {
      const desc = e.descricao || "";
      return desc.includes(MARCA_BASE) || (desc.includes(CPP_MARCA) && desc.includes(biaId)) || desc.startsWith(DIVISOR_MARCA) || desc.startsWith(APORTE_MARCA);
    });
  } catch (fetchErr: any) {
    console.error(`[sync fluxo_caixa] fetch failed: ${fetchErr.message} â€” skipping cleanup`);
  }

  // Bulk-clear M2M relations then bulk-delete all existing entries (2 API calls regardless of count)
  const existingIds = existing.map((e: any) => e.id);
  if (existingIds.length > 0) {
    for (const oldEntry of existing) {
      await registrarFluxoHistorico({
        fluxoId: String(oldEntry.id),
        biaId,
        acao: "excluido_por_sync",
        origem: "sync_valor_origem",
        antes: oldEntry,
        payload: { biaId, valorOrigem, numeroParcelas, vencimentosParcelas, valoresParcelas },
      }).catch((err: any) => console.error("[fluxo_historico] excluido_por_sync:", err.message));
    }
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
      aporteCatId = await findCppCategoriaId("EsforÃ§o multiplicador convertido em CPP");
      aporteTipoCppId = await findTipoCppId("CPP de LideranÃ§a");
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
  const createdEntries = await directusBulkCreate("fluxo_caixa", entriesToCreate);
  for (const created of createdEntries) {
    await registrarFluxoHistorico({
      fluxoId: String(created.id),
      biaId,
      acao: "criado_por_sync",
      origem: "sync_valor_origem",
      depois: created,
      payload: { biaId, valorOrigem, numeroParcelas, vencimentosParcelas, valoresParcelas },
    }).catch((err: any) => console.error("[fluxo_historico] criado_por_sync:", err.message));
  }

  summary.contributorLabels = Array.from(activeContributorLabels);
  return summary;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".csv", ".txt",
      ".doc", ".docx", ".xls", ".xlsx", ".heic", ".heif",
      ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v",
      ".zip", ".rar", ".7z",
      ".ppt", ".pptx",
    ];
    const allowedMime = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif",
      "application/pdf", "text/csv", "text/plain", "application/csv",
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
      cb(new Error(`Tipo de arquivo nÃ£o permitido: ${ext || file.mimetype}`));
    }
  },
});

const auraAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function auraAudioMime(originalName?: string, mimeType?: string, buffer?: Buffer) {
  return resolveAuraAudioMetadata(originalName, mimeType, buffer).mimeType;
}

function auraAudioFilename(originalName?: string, mimeType?: string, buffer?: Buffer) {
  return resolveAuraAudioMetadata(originalName, mimeType, buffer).filename;
}

async function transcribeAuraAudioFile(file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number }) {
  const { toFile } = await import("openai");
  const filename = auraAudioFilename(file.originalname, file.mimetype, file.buffer);
  const mimeType = auraAudioMime(file.originalname, file.mimetype, file.buffer);
  const models = ["gpt-4o-mini-transcribe", "whisper-1"] as const;
  let lastError: any;

  for (const model of models) {
    try {
      const audioFile = await toFile(file.buffer, filename, { type: mimeType });
      const transcription = await getOpenAI().audio.transcriptions.create({
        file: audioFile,
        model,
        language: "pt",
      });
      return (transcription.text || "").replace(/\s+/g, " ").trim();
    } catch (error: any) {
      lastError = error;
      console.warn("[aura-audio-attempt]", {
        model,
        error: error?.message,
        filename,
        mimeType,
        receivedMimeType: file.mimetype,
        bytes: file.size ?? file.buffer.length,
      });
    }
  }

  throw lastError;
}

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
          { field: "alianca_tipo", type: "string", meta: { interface: "select-dropdown", label: "Tipo de AlianÃ§a" }, schema: { is_nullable: true } },
          { field: "tipo_documento", type: "string", meta: { interface: "input", label: "Tipo de Documento" }, schema: { is_nullable: true } },
          { field: "descricao", type: "text", meta: { interface: "input-multiline", label: "DescriÃ§Ã£o" }, schema: { is_nullable: true } },
          { field: "membro_responsavel", type: "string", meta: { interface: "input", label: "Membro ResponsÃ¡vel" }, schema: { is_nullable: true } },
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
      { field: "descricao", type: "text", meta: { interface: "input-multiline", label: "DescriÃ§Ã£o" }, schema: { is_nullable: true } },
      { field: "membro_responsavel", type: "string", meta: { interface: "input", label: "Membro ResponsÃ¡vel" }, schema: { is_nullable: true } },
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

async function directusFieldPatch(collection: string, field: string, body: object): Promise<{ ok: boolean; code?: string }> {
  try {
    const r = await fetch(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
      method: "PATCH",
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

async function ensureFluxoPagamentoFields() {
  const fields = [
    { field: "pagamento_provider", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_id", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_url", type: "text", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_status", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_pais", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_pagador_nome", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_pagador_email", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_pagador_documento", type: "string", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "pagamento_gerado_em", type: "timestamp", meta: { interface: "datetime", display: "datetime", hidden: false }, schema: { is_nullable: true } },
  ];

  const silent = new Set(["RECORD_NOT_UNIQUE", "FORBIDDEN", "INVALID_PAYLOAD"]);
  for (const field of fields) {
    const result = await directusFieldPost("fluxo_caixa", field);
    if (!result.ok && !silent.has(result.code || "")) {
      console.warn(`[fluxo_pagamento] Field ${field.field} not ensured: ${result.code || "unknown"}`);
    }
  }
  await directusFieldPatch("fluxo_caixa", "pagamento_url", {
    type: "text",
    meta: { interface: "input", display: "raw", hidden: false },
    schema: { data_type: "text", is_nullable: true },
  });
}

async function ensureOpaInteressesCrmFields() {
  await db.execute(sql`
    ALTER TABLE opa_interesses
    ADD COLUMN IF NOT EXISTS status_crm text NOT NULL DEFAULT 'interesse_recebido'
  `);
  await db.execute(sql`
    ALTER TABLE opa_interesses
    ADD COLUMN IF NOT EXISTS observacao_crm text
  `);
  await db.execute(sql`
    ALTER TABLE opa_interesses
    ADD COLUMN IF NOT EXISTS atualizado_em timestamp DEFAULT now()
  `);
}

async function ensureAgendaTarefasTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agenda_tarefas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      membro_id text,
      titulo text NOT NULL,
      descricao text,
      data date NOT NULL,
      hora text,
      status text NOT NULL DEFAULT 'pendente',
      prioridade text NOT NULL DEFAULT 'media',
      contexto_tipo text,
      contexto_id text,
      origem_tarefa_id text,
      atribuido_por_user_id text,
      atribuido_por_membro_id text,
      atribuido_por_nome text,
      criado_em timestamp DEFAULT now(),
      atualizado_em timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE agenda_tarefas ADD COLUMN IF NOT EXISTS origem_tarefa_id text`);
  await db.execute(sql`ALTER TABLE agenda_tarefas ADD COLUMN IF NOT EXISTS atribuido_por_user_id text`);
  await db.execute(sql`ALTER TABLE agenda_tarefas ADD COLUMN IF NOT EXISTS atribuido_por_membro_id text`);
  await db.execute(sql`ALTER TABLE agenda_tarefas ADD COLUMN IF NOT EXISTS atribuido_por_nome text`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agenda_tarefas_user_data ON agenda_tarefas (user_id, data, hora)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agenda_tarefas_user_status ON agenda_tarefas (user_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agenda_tarefas_origem ON agenda_tarefas (origem_tarefa_id)`);
}

async function ensureConvitesLinkTipoField() {
  await db.execute(sql`ALTER TABLE convites_link ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'vitrine' NOT NULL`);
}

async function ensureBiaDiretorSolicitacoesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_diretor_solicitacoes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      bia_nome text,
      diretor_membro_id text NOT NULL,
      diretor_nome text,
      diretor_email text,
      papel text NOT NULL,
      campo_diretor text NOT NULL,
      campo_percentual text NOT NULL,
      percentual numeric,
      status text NOT NULL DEFAULT 'pendente',
      solicitante_membro_id text,
      solicitante_nome text,
      solicitante_email text,
      criado_em timestamp DEFAULT now(),
      respondido_em timestamp
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_diretor_solicitacoes_diretor_status ON bia_diretor_solicitacoes (diretor_membro_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_diretor_solicitacoes_bia_status ON bia_diretor_solicitacoes (bia_id, status)`);
}

async function ensureBiaSocioSolicitacoesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_socio_solicitacoes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      bia_nome text,
      socio_membro_id text NOT NULL,
      socio_nome text,
      socio_email text,
      papel text NOT NULL,
      campo_socios text NOT NULL,
      status text NOT NULL DEFAULT 'pendente',
      solicitante_membro_id text,
      solicitante_nome text,
      solicitante_email text,
      criado_em timestamp DEFAULT now(),
      respondido_em timestamp
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_socio_solicitacoes_socio_status ON bia_socio_solicitacoes (socio_membro_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_socio_solicitacoes_bia_status ON bia_socio_solicitacoes (bia_id, status)`);
}

async function ensureBiaMouAceitesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_mou_aceites (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      membro_id text NOT NULL,
      mou_versao text NOT NULL,
      mou_titulo text NOT NULL,
      dados_contratuais jsonb,
      aceite_localizacao jsonb,
      aceito_em timestamp DEFAULT now(),
      UNIQUE (bia_id, membro_id, mou_versao)
    )
  `);
  await db.execute(sql`ALTER TABLE bia_mou_aceites ADD COLUMN IF NOT EXISTS dados_contratuais jsonb`);
  await db.execute(sql`ALTER TABLE bia_mou_aceites ADD COLUMN IF NOT EXISTS aceite_localizacao jsonb`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_mou_aceites_bia_membro ON bia_mou_aceites (bia_id, membro_id, mou_versao)`);
}

async function ensureTermosAceiteAuditoriaTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS termos_aceite_auditoria (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      membro_id text NOT NULL,
      termo_chave text NOT NULL,
      termo_versao text,
      origem text,
      aceito_em timestamp DEFAULT now(),
      aceite_localizacao jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_termos_aceite_membro_chave ON termos_aceite_auditoria (membro_id, termo_chave, aceito_em DESC)`);
}

async function ensureChamadasAliancaTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chamadas_alianca (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      bia_nome text,
      diretor_campo text NOT NULL,
      diretor_membro_id text,
      diretor_nome text,
      nucleo_alianca text,
      ordem integer NOT NULL,
      escopo text NOT NULL,
      titulo text NOT NULL,
      data_hora timestamp NOT NULL,
      link_reuniao text NOT NULL,
      opa_id text,
      destinatarios jsonb DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'pendente',
      criado_por_user_id text,
      criado_por_membro_id text,
      criado_por_nome text,
      criado_em timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chamadas_alianca_bia ON chamadas_alianca (bia_id, diretor_campo, ordem)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chamadas_alianca_destinatarios ON chamadas_alianca USING GIN (destinatarios)`);
}

async function ensureBiaInfoComercialAtivoFields() {
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_endereco text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_bairro text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_cidade text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_estado text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_pais text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_qualificacao text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_descricao_adicional text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_area_m2 text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_numero text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_complemento text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_cep text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_numero_matricula text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_livro text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_folha text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_cartorio text`);
  await db.execute(sql`ALTER TABLE bia_info_comercial ADD COLUMN IF NOT EXISTS ativo_comarca text`);
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

  // 3. Relation: junction.fkParent â†’ parent (carries one_field alias)
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

  // 4. Relation: junction.fkRelated â†’ related collection
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
      console.warn("[comunidade] Collection not found in Directus â€” skipping field creation");
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
    { field: "nome", type: "string", meta: { interface: "input", hidden: false, note: "BUILT PaÃ­s | TerritÃ³rio | Comunidade A01" }, schema: { is_nullable: true } },
    { field: "sigla", type: "string", meta: { interface: "input", hidden: false, note: "CÃ³digo sistÃªmico: BR-BHZ-COM-A01" }, schema: { is_nullable: true } },
    { field: "pais", type: "string", meta: { interface: "input", hidden: false }, schema: { is_nullable: true } },
    { field: "sigla_pais", type: "string", meta: { interface: "input", hidden: false, note: "Ex: BR, PT, US" }, schema: { is_nullable: true } },
    { field: "territorio", type: "string", meta: { interface: "input", hidden: false, note: "Cidade ou regiÃ£o" }, schema: { is_nullable: true } },
    { field: "sigla_territorio", type: "string", meta: { interface: "input", hidden: false, note: "Ex: BHZ, SPO" }, schema: { is_nullable: true } },
    { field: "codigo_sequencial", type: "string", meta: { interface: "input", hidden: false, note: "A01, A02â€¦B01" }, schema: { is_nullable: true } },
    { field: "status", type: "string", meta: { interface: "select-dropdown", hidden: false, options: { choices: [{ text: "Ativa", value: "ativa" }, { text: "Inativa", value: "inativa" }] }, default_value: "ativa" }, schema: { is_nullable: true, default_value: "ativa" } },
    { field: "date_created", type: "timestamp", meta: { interface: "datetime", readonly: true, hidden: false, special: ["date-created"] }, schema: { is_nullable: true } },
  ];
  for (const f of scalarFields) {
    const r = await directusFieldPost(COL, f);
    if (!r.ok && !silent.has(r.code!)) console.warn(`[comunidade] Scalar field '${f.field}': ${r.code}`);
  }

  // M2O: aliado â†’ cadastro_geral
  await ensureComunidadeM2O(COL, "aliado", "cadastro_geral");

  // M2M: membros â†” cadastro_geral (junction: ${COL}_membros)
  await ensureComunidadeM2M(COL, "membros", "cadastro_geral");

  // M2M: bias â†” bias_projetos (junction: ${COL}_bias)
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
  ensureOpaMediaFields().catch(console.error);
  ensureBiasExtraFields().catch(console.error);
  ensureBiasFinancialFieldPrecision().catch(console.error);
  ensureComunidadeFields().catch(console.error);
  ensureNomeBiaLength().catch(console.error);
  ensureCadastroGeralFields().catch(console.error);
  ensureEstudosViabilidadeCollection().catch(console.error);
  ensureNucleoTecnicoCollection().catch(console.error);
  ensureOpaInteressesCrmFields().catch(console.error);
  ensureConvitesLinkTipoField().catch((err: any) => console.warn("[convites_link] Campo tipo nao sincronizado:", err?.message || err));
  ensureAgendaTarefasTable().catch((err: any) => console.warn("[agenda] Tabela nao sincronizada:", err?.message || err));
  ensureBiaDiretorSolicitacoesTable().catch((err: any) => console.warn("[bia-diretores] Tabela nao sincronizada:", err?.message || err));
  ensureBiaSocioSolicitacoesTable().catch((err: any) => console.warn("[bia-socios] Tabela nao sincronizada:", err?.message || err));
  ensureBiaMouAceitesTable().catch((err: any) => console.warn("[bia-mou] Tabela nao sincronizada:", err?.message || err));
  ensureBiaUserPermissionsTable().catch((err: any) => console.warn("[bia-access] Tabela nao sincronizada:", err?.message || err));
  ensureCompanyEmployeeAccountsTable().catch((err: any) => console.warn("[company-access] Tabela nao sincronizada:", err?.message || err));
  ensureTermosAceiteAuditoriaTable().catch((err: any) => console.warn("[termos-aceite] Tabela nao sincronizada:", err?.message || err));
  ensureChamadasAliancaTable().catch((err: any) => console.warn("[chamadas-alianca] Tabela nao sincronizada:", err?.message || err));
  ensureBiaInfoComercialAtivoFields().catch((err: any) => console.warn("[bia_info_comercial] Campos do ativo nao sincronizados:", err?.message || err));
  ensureBiaBancoTables().catch((err: any) => console.warn("[bia-banco] Tabelas nao sincronizadas:", err?.message || err));
  ensureLandBankAssetsTable().catch((err: any) => console.warn("[land-bank] Tabela nao sincronizada:", err?.message || err));
  ensureLandBankAssetsDirectusCollection().catch((err: any) => console.warn("[land-bank-directus] Colecao nao sincronizada:", err?.message || err));
  ensureInventarioTables().catch((err: any) => console.warn("[inventario] Tabelas nao sincronizadas:", err?.message || err));
  ensureMembroComunidadeMaeTable().catch((err: any) => console.warn("[membro-comunidade-mae] Tabela nao sincronizada:", err?.message || err));
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_usage_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar,
      membro_id text,
      nome text,
      email text,
      event_type text NOT NULL,
      path text,
      label text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `).catch((err: any) => console.warn("[usage] Tabela nao sincronizada:", err?.message || err));

  function isAdminRequest(req: any) {
    const role = req.session?.role || "user";
    return role === "admin" || role === "manager" || isBootstrapSuperAdmin(req.session?.email);
  }

  const memoryUsageEvents: any[] = [];
  const MAX_MEMORY_USAGE_EVENTS = 5000;

  function rememberUsageEvent(event: Record<string, any>) {
    memoryUsageEvents.push(event);
    if (memoryUsageEvents.length > MAX_MEMORY_USAGE_EVENTS) {
      memoryUsageEvents.splice(0, memoryUsageEvents.length - MAX_MEMORY_USAGE_EVENTS);
    }
  }

  async function recordUsageEvent(req: any, eventType: string, data: { path?: string | null; label?: string | null; metadata?: Record<string, unknown> } = {}) {
    const userId = req.session?.directusUserId || req.session?.userId || null;
    if (!userId) return;
    const event = {
      user_id: String(userId),
      membro_id: req.session?.membroId ? String(req.session.membroId) : null,
      nome: req.session?.nome || null,
      email: req.session?.email || null,
      event_type: eventType,
      path: data.path || null,
      label: data.label || null,
      metadata: data.metadata || {},
      created_at: new Date(),
    };
    await db.insert(userUsageEvents).values(event).catch((err: any) => {
      rememberUsageEvent(event);
      console.warn("[usage] evento registrado apenas em memoria:", err?.message || err);
    });
  }

  function resultRows(result: any): any[] {
    return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
  }

  async function getCompanyEmployeeByUserId(employeeUserId: string): Promise<any | null> {
    await ensureCompanyEmployeeAccountsTable();
    const result: any = await db.execute(sql`
      SELECT
        account.*,
        employee.nome AS employee_nome,
        employee.email AS employee_email,
        employee.username AS employee_username,
        employee.ativo AS employee_ativo
      FROM company_employee_accounts account
      LEFT JOIN users employee ON employee.id::text = account.employee_user_id
      WHERE account.employee_user_id = ${employeeUserId}
      LIMIT 1
    `);
    return resultRows(result)[0] || null;
  }

  async function getCompanyEmployeeForOwner(ownerUserId: string, accountId: string): Promise<any | null> {
    const result: any = await db.execute(sql`
      SELECT
        account.*,
        employee.nome AS employee_nome,
        employee.email AS employee_email,
        employee.username AS employee_username,
        employee.ativo AS employee_ativo
      FROM company_employee_accounts account
      LEFT JOIN users employee ON employee.id::text = account.employee_user_id
      WHERE account.owner_user_id = ${ownerUserId} AND account.id = ${accountId}
      LIMIT 1
    `);
    return resultRows(result)[0] || null;
  }

  function applyCompanyEmployeeSession(req: any, account: any, localUser?: any) {
    const permissions = normalizeCompanyAccess(account?.permissions);
    req.session.companyEmployeeId = String(account.id);
    req.session.companyOwnerUserId = String(account.owner_user_id);
    req.session.companyOwnerMembroId = account.owner_membro_id ? String(account.owner_membro_id) : null;
    req.session.companyEmployeePermissions = permissions;
    req.session.membroId = account.owner_membro_id ? String(account.owner_membro_id) : null;
    req.session.nome = localUser?.nome || account.employee_nome || req.session.nome;
    req.session.email = localUser?.email || account.employee_email || req.session.email;
    req.session.role = "employee";
    req.session.permissions = companyAccessToLegacyPermissions(permissions);
  }

  function companyModuleForApiPath(pathname: string): CompanyAccessKey | null {
    const path = pathname.toLowerCase();
    if (path.startsWith("/api/agenda")) return "agenda";
    if (path.startsWith("/api/carteira") || path.startsWith("/api/inventario")) return "carteira";
    if (path.startsWith("/api/vitrine") || path.startsWith("/api/anuncios")) return "vitrine";
    if (path.startsWith("/api/aura")) return "aura";
    if (
      path.startsWith("/api/built-capital")
      || path.startsWith("/api/land-bank")
      || path.startsWith("/api/fluxo-caixa")
      || path.startsWith("/api/bia-banco")
      || path.startsWith("/api/pinbank")
    ) return "capital";
    if (
      path.startsWith("/api/bias")
      || path.startsWith("/api/bia-")
      || path.startsWith("/api/opas")
      || path.startsWith("/api/opa/")
      || path.startsWith("/api/comunidade")
      || path.startsWith("/api/chamadas-alianca")
      || path.startsWith("/api/nucleo-tecnico")
      || path.startsWith("/api/alianca-docs")
      || path.startsWith("/api/movimentacao-cotas")
    ) return "alliances";
    return null;
  }

  app.use("/api", async (req: any, res, next) => {
    const employeeId = req.session?.companyEmployeeId;
    if (!employeeId) return next();
    const pathname = String(req.originalUrl || req.url || "").split("?")[0];
    if (pathname === "/api/logout") return next();

    try {
      const account = await getCompanyEmployeeByUserId(String(req.session.directusUserId || ""));
      if (!account || account.status !== "ativo" || account.employee_ativo === false) {
        return res.status(403).json({
          error: "Este acesso de funcionário está suspenso. Fale com o responsável da empresa.",
          code: "COMPANY_ACCOUNT_SUSPENDED",
        });
      }
      applyCompanyEmployeeSession(req, account);

      if (pathname.startsWith("/api/empresa/funcionarios")) return next();
      if (pathname.startsWith("/api/membros/") && !["GET", "HEAD"].includes(req.method)) {
        return res.status(403).json({
          error: "Funcionários não podem alterar o perfil principal da empresa.",
          code: "COMPANY_ACCESS_DENIED",
        });
      }

      const module = companyModuleForApiPath(pathname);
      const required: Exclude<CompanyAccessLevel, "none"> = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? "view" : "edit";
      if (module && !hasCompanyAccess(account.permissions, module, required)) {
        return res.status(403).json({
          error: required === "edit"
            ? "Seu acesso permite apenas visualizar esta área."
            : "O responsável da empresa não liberou esta área para você.",
          code: "COMPANY_ACCESS_DENIED",
          module,
          required,
        });
      }
      return next();
    } catch (error: any) {
      console.error("[company-access] falha ao validar acesso:", error?.message || error);
      return res.status(503).json({
        error: "Não foi possível confirmar seu acesso da empresa agora.",
        code: "COMPANY_ACCESS_UNAVAILABLE",
      });
    }
  });

  function requireCompanyOwner(req: any, res: any): string | null {
    const ownerUserId = req.session?.directusUserId ? String(req.session.directusUserId) : "";
    if (!ownerUserId) {
      res.status(401).json({ error: "Não autenticado" });
      return null;
    }
    if (req.session?.companyEmployeeId) {
      res.status(403).json({ error: "Somente o responsável da empresa pode gerenciar funcionários." });
      return null;
    }
    return ownerUserId;
  }

  app.get("/api/empresa/funcionarios", async (req: any, res) => {
    const ownerUserId = requireCompanyOwner(req, res);
    if (!ownerUserId) return;
    try {
      await ensureCompanyEmployeeAccountsTable();
      const result: any = await db.execute(sql`
        SELECT
          account.*,
          employee.nome,
          employee.email,
          employee.username,
          employee.ativo
        FROM company_employee_accounts account
        LEFT JOIN users employee ON employee.id::text = account.employee_user_id
        WHERE account.owner_user_id = ${ownerUserId}
        ORDER BY account.created_at DESC
      `);
      const items = resultRows(result).map((item) => ({
        ...item,
        permissions: normalizeCompanyAccess(item.permissions),
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao carregar funcionários" });
    }
  });

  app.post("/api/empresa/funcionarios", async (req: any, res) => {
    const ownerUserId = requireCompanyOwner(req, res);
    if (!ownerUserId) return;
    const nome = String(req.body?.nome || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const cargo = String(req.body?.cargo || "").trim();
    if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Informe nome e e-mail válidos." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "A senha inicial deve ter pelo menos 6 caracteres." });
    }

    let employeeUser: any | null = null;
    try {
      await ensureCompanyEmployeeAccountsTable();
      const existing = await storage.getUsersByEmail(email);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
      }
      const companyPermissions = normalizeCompanyAccess(req.body?.permissions);
      employeeUser = await storage.createUser({
        username: email,
        password,
        nome,
        email,
        membro_directus_id: req.session?.membroId || null,
        role: "user",
        permissions: companyAccessToLegacyPermissions(companyPermissions) as any,
        ativo: true,
      } as any);
      const result: any = await db.execute(sql`
        INSERT INTO company_employee_accounts (
          owner_user_id,
          owner_membro_id,
          owner_nome,
          owner_email,
          employee_user_id,
          cargo,
          permissions,
          status,
          updated_by_user_id
        )
        VALUES (
          ${ownerUserId},
          ${req.session?.membroId ? String(req.session.membroId) : null},
          ${req.session?.nome || null},
          ${req.session?.email || null},
          ${employeeUser.id},
          ${cargo || null},
          ${JSON.stringify(companyPermissions)}::jsonb,
          'ativo',
          ${ownerUserId}
        )
        RETURNING *
      `);
      const account = resultRows(result)[0];
      res.status(201).json({
        ...account,
        nome: employeeUser.nome,
        email: employeeUser.email,
        ativo: employeeUser.ativo,
        permissions: companyPermissions,
      });
    } catch (error: any) {
      if (employeeUser?.id) await storage.deleteUser(employeeUser.id).catch(() => false);
      res.status(500).json({ error: error.message || "Erro ao criar acesso de funcionário" });
    }
  });

  app.patch("/api/empresa/funcionarios/:id", async (req: any, res) => {
    const ownerUserId = requireCompanyOwner(req, res);
    if (!ownerUserId) return;
    try {
      const account = await getCompanyEmployeeForOwner(ownerUserId, req.params.id);
      if (!account) return res.status(404).json({ error: "Funcionário não encontrado." });

      const nextPermissions = req.body?.permissions === undefined
        ? normalizeCompanyAccess(account.permissions)
        : normalizeCompanyAccess(req.body.permissions);
      const nextStatus = req.body?.status === "suspenso" ? "suspenso" : "ativo";
      const nextCargo = req.body?.cargo === undefined ? account.cargo : String(req.body.cargo || "").trim() || null;
      const userUpdate: Record<string, any> = {
        ativo: nextStatus === "ativo",
        permissions: companyAccessToLegacyPermissions(nextPermissions),
      };
      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome || "").trim();
        if (!nome) return res.status(400).json({ error: "O nome não pode ficar vazio." });
        userUpdate.nome = nome;
      }
      if (req.body?.email !== undefined) {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
        const matches = await storage.getUsersByEmail(email);
        if (matches.some((item) => String(item.id) !== String(account.employee_user_id))) {
          return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
        }
        userUpdate.email = email;
        userUpdate.username = email;
      }
      if (req.body?.password) {
        const password = String(req.body.password);
        if (password.length < 6) return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
        userUpdate.password = password;
      }

      await storage.updateUser(String(account.employee_user_id), userUpdate as any);
      await db.execute(sql`
        UPDATE company_employee_accounts
        SET
          owner_membro_id = ${req.session?.membroId ? String(req.session.membroId) : null},
          owner_nome = ${req.session?.nome || null},
          owner_email = ${req.session?.email || null},
          cargo = ${nextCargo},
          permissions = ${JSON.stringify(nextPermissions)}::jsonb,
          status = ${nextStatus},
          updated_by_user_id = ${ownerUserId},
          updated_at = now()
        WHERE id = ${req.params.id} AND owner_user_id = ${ownerUserId}
      `);
      const updated = await getCompanyEmployeeForOwner(ownerUserId, req.params.id);
      res.json({ ...updated, permissions: normalizeCompanyAccess(updated?.permissions) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar acesso" });
    }
  });

  app.delete("/api/empresa/funcionarios/:id", async (req: any, res) => {
    const ownerUserId = requireCompanyOwner(req, res);
    if (!ownerUserId) return;
    try {
      const account = await getCompanyEmployeeForOwner(ownerUserId, req.params.id);
      if (!account) return res.status(404).json({ error: "Funcionário não encontrado." });
      await db.execute(sql`
        DELETE FROM company_employee_accounts
        WHERE id = ${req.params.id} AND owner_user_id = ${ownerUserId}
      `);
      await storage.deleteUser(String(account.employee_user_id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao remover acesso" });
    }
  });
  // Update observacoes field label in Directus admin
  fetch(`${DIRECTUS_URL}/fields/bias_projetos/observacoes`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { note: "DescriÃ§Ã£o da BIA" } }),
  }).catch(() => {});

  // Proxy para servir arquivos do Directus sem expor o token
  app.get("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const directusRes = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      });
      if (!directusRes.ok) {
        return res.status(directusRes.status).json({ error: "Arquivo nÃ£o encontrado" });
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
          if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ error: "MÃ¡ximo de 10 arquivos por vez" });
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
            throw new Error(`Erro ao enviar arquivo ao Directus: ${directusRes.status} â€” ${errText}`);
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
    // Require authenticated session â€” Vitrine is available to all logged-in users
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "NÃ£o autenticado" });
    }
    try {
      // Fetch all members with the na_vitrine field and filter server-side
      // (avoids URL bracket encoding issues with Directus filter API)
      // Note: "especialidade" and "foto" are not direct fields â€” use Especialidades relation and foto_perfil instead
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,foto_posicao_x,foto_posicao_y,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,area_atuacao,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
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
            especialidade: especialidades[0] || m.especialidade_livre || null,
            latitude: m.latitude ? parseFloat(m.latitude) : null,
            longitude: m.longitude ? parseFloat(m.longitude) : null,
          };
        });
      // Fire-and-forget: geocode members without coordinates (max 8 per call, 250ms apart)
      const needGeo = items.filter((m: any) => !m.latitude && !m.longitude && m.cidade);
      if (needGeo.length > 0) geocodeMembrosCadastro(needGeo).catch(() => {});
      res.json(items);
    } catch (error: any) {
      const cached = readCachedApiArrayFromLogs("/api/vitrine");
      if (cached) {
        console.warn("[vitrine] Directus indisponivel; usando ultimo snapshot local dos logs.");
        return res.json(cached);
      }
      console.error(`[vitrine] error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Single vitrine member â€” accessible to all authenticated users
  app.get("/api/vitrine/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "NÃ£o autenticado" });
    }
    try {
      const fields = "id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,foto_posicao_x,foto_posicao_y,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,area_atuacao,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.id,Especialidades.especialidades_id.nome_especialidade";
      const m = await directusFetchOne("cadastro_geral", req.params.id, `fields=${fields}`);
      if (!m) return res.status(404).json({ error: "Membro nÃ£o encontrado" });
      const espArr = Array.isArray(m.Especialidades) ? m.Especialidades : [];
      const firstEsp = espArr[0]?.especialidades_id;
      res.json({
        ...m,
        cargo: m.cargo || m.responsavel_cargo || null,
        foto: m.foto_perfil || null,
        especialidade_id: (typeof firstEsp === "object" ? firstEsp?.id : null) ?? null,
        especialidade: (typeof firstEsp === "object" ? firstEsp?.nome_especialidade : null) ?? m.especialidade_livre ?? null,
        latitude: m.latitude ? parseFloat(m.latitude) : null,
        longitude: m.longitude ? parseFloat(m.longitude) : null,
      });
    } catch (error: any) {
      const cached = readCachedApiArrayFromLogs("/api/vitrine");
      const item = cached?.find((m: any) => String(m.id) === String(req.params.id));
      if (item) {
        console.warn("[vitrine] Directus indisponivel; usando membro do ultimo snapshot local dos logs.");
        return res.json(item);
      }
      if (String(error?.message || "").includes("ECONNREFUSED")) {
        console.warn("[chamadas-alianca] Banco local indisponivel em /minhas:", error.message);
        return res.json([]);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MEMBROS BUILT / BUILT Alliances (robust fallback) ==========
  app.get("/api/membros-built", async (req, res, next) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "NÃƒÂ£o autenticado" });
    }
    const isBuiltAllianceMember = (m: any) => {
      const redes = Array.isArray(m?.Outras_redes_as_quais_pertenco) ? m.Outras_redes_as_quais_pertenco : [];
      return redes.includes("BUILT_PROUD_MEMBER");
    };
    const normalizeBuiltMember = (m: any) => {
      const especialidades = (m.Especialidades || [])
        .map((e: any) => e?.especialidades_id?.nome_especialidade)
        .filter(Boolean);
      return {
        ...m,
        cargo: m.cargo || m.responsavel_cargo || null,
        foto: m.foto_perfil || m.foto || null,
        especialidade: especialidades[0] || m.especialidade || m.especialidade_livre || null,
        latitude: m.latitude ? parseFloat(m.latitude) : null,
        longitude: m.longitude ? parseFloat(m.longitude) : null,
      };
    };
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,foto_posicao_x,foto_posicao_y,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,em_membros_built,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,area_atuacao,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!response.ok) throw new Error(`Directus error: ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`Directus retornou ${contentType || "conteudo nao-json"}`);
      const json = await response.json();
      return res.json((json.data || []).filter(isBuiltAllianceMember).map(normalizeBuiltMember));
    } catch (error: any) {
      const cached = readCachedApiArrayFromLogs("/api/membros-built")
        || readCachedApiArrayFromLogs("/api/membros")
        || readCachedApiArrayFromLogs("/api/vitrine");
      if (cached) {
        console.warn("[membros-built] Directus indisponivel; usando ultimo snapshot local dos logs.");
        return res.json(cached.filter(isBuiltAllianceMember).map(normalizeBuiltMember));
      }
      return next(error);
    }
  });

  // ========== MEMBROS BUILT (PROUD MEMBER only) ==========
  app.get("/api/membros-built", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "NÃ£o autenticado" });
    }
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,foto_posicao_x,foto_posicao_y,perfil_aliado,nucleo_alianca,tipo_alianca,tipo_de_cadastro,na_vitrine,link_site,latitude,longitude,logo_empresa,especialidade_livre,ramo_atuacao,segmento,area_atuacao,idiomas,nucleos_alianca,tipos_alianca,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade`;
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
      if (String(error?.message || "").includes("ECONNREFUSED")) {
        console.warn("[chamadas-alianca] Banco local indisponivel em /bia:", error.message);
        return res.json([]);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========== PARCEIROS CAPITAL ==========
  app.get("/api/parceiros-capital", async (req, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "NÃ£o autenticado" });
    }
    try {
      const url = `${DIRECTUS_URL}/items/cadastro_geral?limit=-1&fields=id,nome,cargo,empresa,cidade,estado,pais,whatsapp,email,foto_perfil,foto_posicao_x,foto_posicao_y,perfil_aliado,nucleo_alianca,ramo_atuacao,segmento,area_atuacao,latitude,longitude,link_site,Outras_redes_as_quais_pertenco,Especialidades.especialidades_id.nome_especialidade&filter[em_built_capital][_eq]=true`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!response.ok) throw new Error(`Directus error: ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`Directus retornou ${contentType || "conteudo nao-json"}`);
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
      const cached = readCachedApiArrayFromLogs("/api/parceiros-capital")
        || readCachedApiArrayFromLogs("/api/membros")
        || readCachedApiArrayFromLogs("/api/vitrine");
      if (cached) {
        const isCapital = (m: any) => {
          const redes = Array.isArray(m?.Outras_redes_as_quais_pertenco) ? m.Outras_redes_as_quais_pertenco : [];
          const text = [m?.perfil_aliado, m?.nucleo_alianca, m?.tipo_alianca, m?.ramo_atuacao, m?.empresa, ...redes]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return m?.em_built_capital === true || m?.em_built_capital === 1 || text.includes("capital");
        };
        console.warn("[parceiros-capital] Directus indisponivel; usando ultimo snapshot local dos logs.");
        return res.json(cached.filter(isCapital));
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ASSETS PROXY (Directus images with auth) ==========
  app.get("/api/assets/:id", async (req, res) => {
    return proxyDirectusAsset(req, res);
  });

  // ========== ANÃšNCIOS ==========
  await ensureAnunciosPagamentoFields().catch((err: any) => {
    console.warn(`[anuncios_pagamento] Campos de pagamento nao sincronizados: ${err.message}`);
  });

  async function enrichAnuncio(a: any) {
    if (a?.pagamento_status === "pendente" && !a.pagamento_url) {
      const pais = a.pagamento_pais === "exterior" ? "exterior" : "brasil";
      const pagamentoUrl = buildAnuncioPagamentoUrl(pais, a.id);
      const updated = await storage.updateAnuncio(a.id, {
        pagamento_url: pagamentoUrl,
        pagamento_id: a.pagamento_id || `payment_link:${a.id}`,
      } as any);
      a = updated || { ...a, pagamento_url: pagamentoUrl };
    }

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
      membro_foto: assetApiUrl(membro?.foto_perfil),
      imagem_url: assetApiUrl(a.imagem_directus_id),
    };
  }

  function buildAnuncioPagamentoUrl(pais: "brasil" | "exterior", anuncioId: string) {
    const baseUrl = pais === "brasil"
      ? "https://www.asaas.com/c/j3grfxxw456r9ucm"
      : "https://buy.stripe.com/7sYbJ00YJa9H0Sh8Mb04801";
    const url = new URL(baseUrl);
    const reference = `anuncio:${anuncioId}`;
    if (pais === "brasil") {
      url.searchParams.set("externalReference", reference);
    } else {
      url.searchParams.set("client_reference_id", reference);
    }
    return url.toString();
  }

  const ANUNCIO_DURACAO_DIAS = 15;

  function toDateOnly(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function addDaysToDateOnly(dateStr: string, days: number) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function getAnuncioFim(inicio: string) {
    return addDaysToDateOnly(inicio, ANUNCIO_DURACAO_DIAS - 1);
  }

  function normalizeAnuncioAmbiente(value: any) {
    return String(value || "").toLowerCase() === "capital" ? "capital" : "vitrine";
  }

  async function getProximaJanelaAnuncio(slotTipo: string, inicioPreferido = toDateOnly(), excludeId?: string, ambiente = "vitrine") {
    const maxSlots = slotTipo === "hero" ? 1 : 5;
    for (let offset = 0; offset < 370; offset++) {
      const inicio = addDaysToDateOnly(inicioPreferido, offset);
      const fim = getAnuncioFim(inicio);
      const count = await storage.countAnunciosByPeriod(inicio, fim, excludeId, slotTipo, ambiente);
      if (count < maxSlots) {
        return { inicio, fim, count, vagas: maxSlots - count, max: maxSlots };
      }
    }
    throw new Error("Nao ha vaga disponivel para os proximos 12 meses.");
  }

  async function markAnuncioPago(anuncioId: string, provider: "asaas" | "stripe", paymentId?: string | null) {
    const anuncio = await storage.getAnuncioById(anuncioId);
    if (!anuncio) throw new Error("Destaque não encontrado");
    if (anuncio.ativo && anuncio.pagamento_status === "pago") return anuncio;
    const slotTipo = anuncio.slot_tipo === "hero" ? "hero" : "padrao";
    const janela = await getProximaJanelaAnuncio(slotTipo, toDateOnly(), anuncio.id, (anuncio as any).ambiente || "vitrine");
    return storage.updateAnuncio(anuncioId, {
      ativo: true,
      pagamento_provider: provider,
      pagamento_status: "pago",
      data_inicio: janela.inicio,
      data_fim: janela.fim,
      ...(paymentId ? { pagamento_id: paymentId } : {}),
      publicado_em: new Date(),
    } as any);
  }

  app.get("/api/anuncios", async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ambiente = normalizeAnuncioAmbiente(req.query.ambiente);
      const ativos = await storage.getAnunciosAtivos(today, ambiente);
      const enriched = await Promise.all(ativos.map(enrichAnuncio));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/anuncios/disponibilidade", async (req, res) => {
    try {
      const meses = Math.min(6, Math.max(1, parseInt(String(req.query.meses || "3"))));
      const slotTipo = String(req.query.slot_tipo || "padrao") === "hero" ? "hero" : "padrao";
      const ambiente = normalizeAnuncioAmbiente(req.query.ambiente);
      const data = await storage.getAnunciosDisponibilidade(meses, slotTipo, ambiente);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/anuncios/mine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      if (!membroId) return res.json([]);
      const ambiente = normalizeAnuncioAmbiente(req.query.ambiente);
      const lista = await storage.getAnunciosByMembro(membroId, ambiente);
      const enriched = await Promise.all(lista.map(enrichAnuncio));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/anuncios", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      if (!membroId) return res.status(400).json({ error: "Perfil de membro nÃ£o vinculado" });

      const { titulo, descricao, link, imagem_directus_id } = req.body;
      const slotTipo = req.body?.slot_tipo === "hero" ? "hero" : "padrao";
      const ambiente = normalizeAnuncioAmbiente(req.body?.ambiente);
      const pagamentoPais = req.body?.pagamento_pais === "exterior" ? "exterior" : "brasil";
      const isSuperAdmin = (req.session as any).role === "admin";
      const janela = await getProximaJanelaAnuncio(slotTipo, toDateOnly(), undefined, ambiente);
      const hasConflito = !isSuperAdmin && await storage.hasAnuncioByMembroInPeriod(membroId, janela.inicio, janela.fim, undefined, slotTipo, ambiente);
      if (hasConflito) return res.status(409).json({ error: "VocÃª jÃ¡ tem um anÃºncio ativo, agendado ou pendente neste intervalo." });

      const anuncio = await storage.createAnuncio({
        membro_id: membroId,
        titulo: titulo || "",
        descricao: descricao || null,
        link: link || null,
        imagem_directus_id: imagem_directus_id || null,
        ambiente,
        slot_tipo: slotTipo,
        data_inicio: janela.inicio,
        data_fim: janela.fim,
        ativo: isSuperAdmin,
        pagamento_provider: isSuperAdmin ? null : (pagamentoPais === "brasil" ? "asaas" : "stripe"),
        pagamento_status: isSuperAdmin ? "dispensado" : "pendente",
        pagamento_pais: isSuperAdmin ? null : pagamentoPais,
        pagamento_gerado_em: isSuperAdmin ? null : new Date(),
        publicado_em: isSuperAdmin ? new Date() : null,
      } as any);
      if (isSuperAdmin) {
        return res.json(await enrichAnuncio(anuncio));
      }

      const pagamentoUrl = buildAnuncioPagamentoUrl(pagamentoPais, anuncio.id);
      const updated = await storage.updateAnuncio(anuncio.id, {
        pagamento_url: pagamentoUrl,
        pagamento_id: `payment_link:${anuncio.id}`,
      } as any);
      res.json({
        ...(await enrichAnuncio(updated || anuncio)),
        pagamento_url: pagamentoUrl,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/anuncios/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      const role = (req.session as any).role;
      const anuncio = await storage.getAnuncioById(req.params.id);
      if (!anuncio) return res.status(404).json({ error: "Destaque não encontrado" });
      if (anuncio.membro_id !== membroId && role !== "admin") {
        return res.status(403).json({ error: "Sem permissÃ£o" });
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId;
      const role = (req.session as any).role;
      const anuncio = await storage.getAnuncioById(req.params.id);
      if (!anuncio) return res.status(404).json({ error: "Destaque não encontrado" });
      if (anuncio.membro_id !== membroId && role !== "admin") {
        return res.status(403).json({ error: "Sem permissÃ£o" });
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
        return res.status(400).json({ error: "Nome da especialidade Ã© obrigatÃ³rio." });
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
    const email = (req.session as any).email || "";
    if (isBootstrapSuperAdmin(email)) return "admin";
    if (sessionRole === "admin" || sessionRole === "manager") return sessionRole;
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
      return res.status(401).json({ error: "NÃ£o autenticado" });
    }
    try {
      const items = await directusFetch("cadastro_geral", "fields=*,Especialidades.*.*");
      const nomePorMembroId = new Map<string, string>();
      for (const m of items) {
        if (m?.id) {
          nomePorMembroId.set(
            String(m.id),
            m.nome || m.nome_completo || m.Nome_de_usuario || m.email || "Membro BUILT"
          );
        }
      }
      const convitePorCandidato = new Map<string, any>();
      const convidadorFallbackPorMembro = new Map<string, string>();
      try {
        const convites = await storage.getAllConvites();
        for (const convite of convites) {
          if (!convite.candidato_membro_id || !convite.invitador_membro_id) continue;
          const candidatoId = String(convite.candidato_membro_id);
          if (!convitePorCandidato.has(candidatoId)) {
            convitePorCandidato.set(candidatoId, convite);
          }
        }
      } catch (conviteError: any) {
        console.warn("[membros] Nao foi possivel carregar convidadores:", conviteError?.message || conviteError);
      }
      try {
        const col = await getComunidadeCol();
        const comunidades = await directusFetch(
          col,
          "fields=id,aliado.id,aliado,membros.cadastro_geral_id&limit=-1"
        );
        for (const comunidade of comunidades) {
          const aliadoId = typeof comunidade?.aliado === "object" && comunidade.aliado !== null
            ? comunidade.aliado.id
            : comunidade?.aliado;
          if (!aliadoId) continue;
          const membros = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
          for (const membro of membros) {
            const membroId = typeof membro?.cadastro_geral_id === "object"
              ? membro.cadastro_geral_id?.id
              : membro?.cadastro_geral_id;
            if (membroId && !convidadorFallbackPorMembro.has(String(membroId))) {
              convidadorFallbackPorMembro.set(String(membroId), String(aliadoId));
            }
          }
        }
      } catch (comunidadeError: any) {
        console.warn("[membros] Nao foi possivel montar fallback de convidadores:", comunidadeError?.message || comunidadeError);
      }
      const mapped = items.map((m: any) => {
        // Parse relational Especialidades (M2M or O2M from Directus)
        let especialidades_arr: string[] = [];
        const esp = m.Especialidades;
        if (Array.isArray(esp)) {
          especialidades_arr = esp.map((e: any) => {
            if (typeof e === "string") return e;
            if (typeof e === "number") return String(e);
            // M2M junction: junction field is especialidades_id â†’ nome_especialidade
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
        const conviteOrigem = convitePorCandidato.get(String(m.id));
        const convidadorId = conviteOrigem?.invitador_membro_id
          ? String(conviteOrigem.invitador_membro_id)
          : (convidadorFallbackPorMembro.get(String(m.id)) || null);
        return {
          ...m,
          cargo: m.cargo || m.responsavel_cargo || null,
          especialidade: especialidades_arr[0] || m.especialidade || null,
          especialidades: especialidades_arr,
          foto: m.foto_perfil || m.foto || null,
          convidado_por_id: convidadorId,
          convidado_por_nome: convidadorId ? (nomePorMembroId.get(convidadorId) || "Membro BUILT") : null,
          convite_origem_status: conviteOrigem?.status || null,
          convite_origem_tipo: conviteOrigem?.tipo || null,
        };
      });
      res.json(mapped);
    } catch (error: any) {
      const cached = readCachedApiArrayFromLogs("/api/membros") || readCachedApiArrayFromLogs("/api/vitrine");
      if (cached) {
        console.warn("[membros] Directus indisponivel; usando ultimo snapshot local dos logs.");
        return res.json(cached);
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/membros/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const m = await directusFetchOne("cadastro_geral", req.params.id, "fields=*,Especialidades.especialidades_id.id,Especialidades.especialidades_id.nome_especialidade");
      if (!m) return res.status(404).json({ error: "Membro nÃ£o encontrado" });
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
      const cached = readCachedApiArrayFromLogs("/api/membros") || readCachedApiArrayFromLogs("/api/vitrine");
      const item = cached?.find((m: any) => String(m.id) === String(req.params.id));
      if (item) {
        console.warn("[membros] Directus indisponivel; usando membro do ultimo snapshot local dos logs.");
        return res.json(item);
      }
      const sessionMembroId = (req.session as any).membroId;
      if (sessionMembroId && String(sessionMembroId) === String(req.params.id)) {
        return res.json({
          id: sessionMembroId,
          nome: (req.session as any).nome || (req.session as any).email || "Membro BUILT",
          email: (req.session as any).email || null,
          foto: null,
          foto_perfil: null,
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros/criar-favorecido", async (req, res) => {
    if (!(req.session as any)?.membroId) return res.status(401).json({ error: "NÃ£o autenticado" });
    const { nome, empresa } = req.body;
    if (!nome || !String(nome).trim()) return res.status(400).json({ error: "Nome Ã© obrigatÃ³rio" });
    try {
      const item = await directusCreate("cadastro_geral", {
        nome: String(nome).trim(),
        empresa: empresa ? String(empresa).trim() : undefined,
        tipo_de_cadastro: "favorecido_externo",
      });
      res.json({ id: item.id, nome: item.nome, empresa: item.empresa });
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
          return res.status(409).json({ error: "JÃ¡ existe um membro cadastrado com este e-mail." });
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
      // Especialidades is a M2M junction â€” sending the full junction object array breaks the update silently
      const STRIP_FIELDS = ["Especialidades", "especialidades", "especialidade", "foto", "_nome", "cargo_computed"];
      const aceiteLocalizacao = (req.body as any)?.aceite_localizacao;
      const payload = Object.fromEntries(
        Object.entries(req.body).filter(([key]) => !STRIP_FIELDS.includes(key) && key !== "aceite_localizacao")
      );
      const acceptanceTimestampFields = [
        "codigo_etica_aceito_em",
        "politicas_participacao_aceito_em",
        "vitrine_termo_aceito_em",
        "area_aliancas_termo_aceito_em",
        "built_capital_termo_aceito_em",
      ];
      if (acceptanceTimestampFields.some((field) => Boolean((payload as any)[field])) && !getCapturedAcceptanceLocation(aceiteLocalizacao)) {
        return res.status(400).json({ error: ACCEPTANCE_LOCATION_REQUIRED_ERROR });
      }

      if ("tipo_pessoa" in payload) {
        const tipoPessoa = String(payload.tipo_pessoa || "").trim();
        const tipoPessoaLower = tipoPessoa.toLowerCase();
        if (tipoPessoa === "" || tipoPessoaLower === "null") {
          payload.tipo_pessoa = null;
        } else if (tipoPessoa === "PF" || tipoPessoaLower.includes("fÃ­sica") || tipoPessoaLower.includes("fisica")) {
          payload.tipo_pessoa = "PF";
        } else if (tipoPessoa === "PJ" || tipoPessoaLower.includes("jurÃ­dica") || tipoPessoaLower.includes("juridica")) {
          payload.tipo_pessoa = "PJ";
        } else if (tipoPessoa.length > 10) {
          delete payload.tipo_pessoa;
        }
      }

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
      const NUMERIC_FIELDS = ["latitude", "longitude", "foto_posicao_x", "foto_posicao_y"];
      for (const f of NUMERIC_FIELDS) {
        if (f in payload) {
          const v = payload[f];
          if (v === "" || v === null || v === undefined) {
            payload[f] = null;
          } else {
            const n = parseFloat(String(v));
            payload[f] = isNaN(n) ? null : n;
          }
        }
      }

      const termFields = [
        "codigo_etica_aceito_em",
        "codigo_etica_versao",
        "politicas_participacao_aceito_em",
        "politicas_participacao_versao",
        "vitrine_termo_aceito_em",
        "vitrine_termo_versao",
        "built_capital_termo_aceito_em",
        "built_capital_termo_versao",
        "area_aliancas_termo_aceito_em",
        "area_aliancas_termo_versao",
        "nacionalidade",
        "nome_mae",
        "nome_pai",
        "data_nascimento",
        "profissao",
        "cpf",
        "cnpj",
        "rg",
        "estado_civil",
        "regime_comunhao",
        "conjuge_nome_completo",
        "conjuge_nacionalidade",
        "conjuge_nome_mae",
        "conjuge_nome_pai",
        "conjuge_data_nascimento",
        "conjuge_profissao",
        "conjuge_email",
        "conjuge_telefone",
        "conjuge_cpf",
        "conjuge_rg",
        "mesmo_endereco",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "titular_cep",
        "titular_endereco",
        "titular_numero",
        "titular_complemento",
        "titular_bairro",
        "titular_cidade",
        "titular_estado",
        "titular_pais",
        "conjuge_cep",
        "conjuge_endereco",
        "conjuge_numero",
        "conjuge_complemento",
        "conjuge_bairro",
        "conjuge_cidade",
        "conjuge_estado",
        "conjuge_pais",
      ];
      if (Object.keys(payload).some(key => termFields.includes(key) || key === "foto_posicao_x" || key === "foto_posicao_y")) {
        await ensureVitrineFields();
      }

      const directusPayload = await normalizeDirectusPatchPayload("cadastro_geral", payload);
      console.log(`[membros PATCH ${req.params.id}] fields:`, Object.keys(directusPayload));
      const item = await directusUpdate("cadastro_geral", req.params.id, directusPayload);
      const termAuditConfig: Array<{ key: string; acceptedAt: string; version: string }> = [
        { key: "codigo_etica", acceptedAt: "codigo_etica_aceito_em", version: "codigo_etica_versao" },
        { key: "politicas_participacao_protecao", acceptedAt: "politicas_participacao_aceito_em", version: "politicas_participacao_versao" },
        { key: "vitrine", acceptedAt: "vitrine_termo_aceito_em", version: "vitrine_termo_versao" },
        { key: "area_aliancas", acceptedAt: "area_aliancas_termo_aceito_em", version: "area_aliancas_termo_versao" },
        { key: "built_capital", acceptedAt: "built_capital_termo_aceito_em", version: "built_capital_termo_versao" },
      ];
      for (const config of termAuditConfig) {
        if ((payload as any)[config.acceptedAt]) {
          await recordTermAcceptanceAudit({
            membroId: req.params.id,
            termoChave: config.key,
            termoVersao: String((payload as any)[config.version] || ""),
            origem: TERMOS_ACEITE_BUILT[config.key]?.origem || null,
            aceitoEm: String((payload as any)[config.acceptedAt]),
            aceiteLocalizacao,
          });
        }
      }
      res.json(item);
    } catch (error: any) {
      console.error(`[membros PATCH ${req.params.id}] error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const membroId = req.params.id;

      // Directus blocks deleting cadastro_geral rows while the member is still
      // referenced by the community M2M junction.
      const comunidadeLinks = await directusFetchScoped(
        "comunidade_membros",
        `fields=id&filter[cadastro_geral_id][_eq]=${encodeURIComponent(membroId)}`
      ).catch((cleanupError: any) => {
        console.warn(`[membros DELETE ${membroId}] Directus comunidade_membros lookup failed:`, cleanupError?.message || cleanupError);
        return [];
      });

      for (const link of comunidadeLinks) {
        if (!link?.id) continue;
        await directusDelete("comunidade_membros", String(link.id)).catch((cleanupError: any) => {
          console.warn(`[membros DELETE ${membroId}] Directus comunidade_membros link ${link.id} cleanup failed:`, cleanupError?.message || cleanupError);
        });
      }

      await db.execute(sql`
        DELETE FROM comunidade_membros
        WHERE cadastro_geral_id = ${membroId}
      `).catch((cleanupError: any) => {
        console.warn(`[membros DELETE ${membroId}] comunidade_membros cleanup failed:`, cleanupError?.message || cleanupError);
      });

      await db.execute(sql`
        DELETE FROM users
        WHERE membro_directus_id = ${membroId}
      `).catch((cleanupError: any) => {
        console.warn(`[membros DELETE ${membroId}] local user cleanup failed:`, cleanupError?.message || cleanupError);
      });

      await directusDelete("cadastro_geral", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[membros DELETE ${req.params.id}] error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  type ComunidadeMaeRecord = {
    membro_id: string;
    comunidade_id: string;
    source: string;
    locked_at?: Date | string | null;
  };

  async function persistMembroComunidadeMae(
    memberId: string,
    comunidadeId: string,
    source: "convite" | "legacy_first_link" | "manual_seed",
    metadata: Record<string, unknown> = {},
  ): Promise<ComunidadeMaeRecord> {
    try {
      const result = await db
        .insert(membroComunidadeMae)
        .values({
          membro_id: memberId,
          comunidade_id: comunidadeId,
          source,
          metadata,
        })
        .onConflictDoNothing({ target: membroComunidadeMae.membro_id })
        .returning();

      if (result[0]) return result[0] as ComunidadeMaeRecord;

      const existing = await db
        .select()
        .from(membroComunidadeMae)
        .where(eq(membroComunidadeMae.membro_id, memberId))
        .limit(1);
      return existing[0] as ComunidadeMaeRecord;
    } catch (error: any) {
      console.warn("[membro-comunidade-mae] Nao foi possivel persistir, usando fallback em memoria:", error?.message || error);
      return { membro_id: memberId, comunidade_id: comunidadeId, source };
    }
  }

  async function getStoredMembroComunidadeMae(memberId: string): Promise<ComunidadeMaeRecord | null> {
    try {
      const existing = await db
        .select()
        .from(membroComunidadeMae)
        .where(eq(membroComunidadeMae.membro_id, memberId))
        .limit(1);
      return (existing[0] as ComunidadeMaeRecord) || null;
    } catch (error: any) {
      console.warn("[membro-comunidade-mae] Nao foi possivel ler tabela local:", error?.message || error);
      return null;
    }
  }

  async function getMembroIdsDaComunidadeMae(comunidadeId?: string | null): Promise<string[]> {
    if (!comunidadeId) return [];
    try {
      const rows = await db
        .select({ membro_id: membroComunidadeMae.membro_id })
        .from(membroComunidadeMae)
        .where(eq(membroComunidadeMae.comunidade_id, String(comunidadeId)));
      return rows.map((row) => String(row.membro_id)).filter(Boolean);
    } catch (error: any) {
      console.warn("[membro-comunidade-mae] Nao foi possivel listar membros da comunidade:", error?.message || error);
      return [];
    }
  }

  async function resolveMembroComunidadeMae(memberId: string, links: Array<{ id: string; papel?: string | null }> = []) {
    const stored = await getStoredMembroComunidadeMae(memberId);
    if (stored) return stored;

    const convites = await storage.getConvitesByCandidato(memberId).catch((error: any) => {
      console.warn("[membro-comunidade-mae] Nao foi possivel carregar convites:", error?.message || error);
      return [];
    });
    const conviteOrigem = [...convites]
      .filter((convite: any) => convite.comunidade_id)
      .sort((a: any, b: any) => new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime())[0];
    if (conviteOrigem?.comunidade_id) {
      return persistMembroComunidadeMae(memberId, String(conviteOrigem.comunidade_id), "convite", {
        convite_id: conviteOrigem.id,
        convite_status: conviteOrigem.status || null,
        convite_tipo: conviteOrigem.tipo || null,
      });
    }

    const firstMembroLink = links.find((link) => link.papel === "membro" || link.papel === "ambos") || links[0];
    if (firstMembroLink?.id) {
      return persistMembroComunidadeMae(memberId, String(firstMembroLink.id), "legacy_first_link", {
        reason: "Primeira comunidade vinculada antes da regra de Comunidade Mae",
      });
    }

    return null;
  }

  async function getMembroComunidadesLinks(memberId: string) {
    const col = await getComunidadeCol();
    const fields = "fields=id,nome,sigla,aliado.id,aliado.nome,aliado.email,membros.cadastro_geral_id.id";
    const [allComunidades, aliadoComunidades] = await Promise.all([
      directusFetchScoped(col, `${fields}&limit=-1`).catch((error: any) => {
        console.warn("[membro-comunidades] Nao foi possivel listar comunidades:", error?.message || error);
        return [];
      }),
      directusFetchScoped(col, `${fields}&filter[aliado][_eq]=${encodeURIComponent(memberId)}&limit=-1`).catch((error: any) => {
        console.warn("[membro-comunidades] Nao foi possivel listar comunidades do aliado:", error?.message || error);
        return [];
      }),
    ]);
    const comunidadesById = new Map<string, any>();
    for (const comunidade of [...allComunidades, ...aliadoComunidades]) {
      if (comunidade?.id !== undefined && comunidade?.id !== null) {
        comunidadesById.set(String(comunidade.id), comunidade);
      }
    }
    const comunidades = Array.from(comunidadesById.values());
    const links = comunidades
      .map((c: any) => {
        const aliadoId = directusRelationId(c.aliado);
        const isAliado = String(aliadoId || "") === String(memberId);
        const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
        const isMembro = membros.some((m: any) => {
          const cgId = directusRelationId(m?.cadastro_geral_id);
          return String(cgId || "") === String(memberId);
        });
        if (!isAliado && !isMembro) return null;
        const papel = isAliado && isMembro ? "ambos" : isAliado ? "aliado" : "membro";
        return { id: c.id, nome: c.nome, sigla: c.sigla, aliado: c.aliado || null, papel };
      })
      .filter(Boolean);
    const mae = await resolveMembroComunidadeMae(memberId, links as any[]);
    return links.map((link: any) => {
      const isMae = !!mae?.comunidade_id && String(link.id) === String(mae.comunidade_id);
      return {
        ...link,
        is_mae: isMae,
        locked: isMae,
        origem_mae: isMae ? mae.source : null,
      };
    });
  }

  async function setMembroInComunidadeM2M(memberId: string, comunidadeId: string, shouldInclude: boolean) {
    const col = await getComunidadeCol();
    const url = `${DIRECTUS_URL}/items/${col}/${comunidadeId}?fields=id,aliado.id,membros.cadastro_geral_id`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
    if (!r.ok) throw new Error("Comunidade nÃ£o encontrada");
    const data = await r.json();
    const aliadoId = directusRelationId(data.data?.aliado);
    const currentIds: string[] = (data.data?.membros || [])
      .map((m: any) => directusRelationId(m?.cadastro_geral_id))
      .filter((id: any): id is string => Boolean(id));
    const nextIds = shouldInclude
      ? Array.from(new Set([...currentIds, memberId]))
      : currentIds.filter((id) => String(id) !== String(memberId));
    const patch = await fetch(`${DIRECTUS_URL}/items/${col}/${comunidadeId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ membros: nextIds.map((id) => ({ cadastro_geral_id: id })) }),
    });
    if (!patch.ok) {
      const err = await patch.text().catch(() => "");
      throw new Error(err || "Falha ao atualizar vÃ­nculo de comunidade");
    }
    return { success: true, comunidade_id: comunidadeId, membro_id: memberId, aliado: aliadoId };
  }

  // GET /api/membros/:id/comunidades â€” all communities where this member is membro and/or aliado
  app.get("/api/membros/:id/comunidades", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      res.json(await getMembroComunidadesLinks(req.params.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/membros/:id/comunidade â€” compatibility: first linked community
  app.get("/api/membros/:id/comunidade", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const links = await getMembroComunidadesLinks(req.params.id);
      res.json(links[0] || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/membros/:id/comunidade-mae", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const membroId = req.params.id;
      const comunidadeId = req.body?.comunidade_id ? String(req.body.comunidade_id) : "";
      if (!comunidadeId) return res.status(400).json({ error: "Selecione a nova Comunidade Mãe." });

      await setMembroInComunidadeM2M(membroId, comunidadeId, true);

      const actor = getAuditActor(req);
      const existing = await getStoredMembroComunidadeMae(membroId);
      const metadata = {
        updated_by_user_id: actor.userId,
        updated_by_membro_id: actor.membroId,
        updated_by_nome: actor.nome,
        previous_comunidade_id: existing?.comunidade_id || null,
      };

      const result = await db
        .insert(membroComunidadeMae)
        .values({
          membro_id: membroId,
          comunidade_id: comunidadeId,
          source: existing ? "manual_update" : "manual_seed",
          created_by_user_id: actor.userId,
          created_by_membro_id: actor.membroId,
          metadata,
        })
        .onConflictDoUpdate({
          target: membroComunidadeMae.membro_id,
          set: {
            comunidade_id: comunidadeId,
            source: "manual_update",
            locked_at: new Date(),
            metadata,
          },
        })
        .returning();

      res.json({ success: true, comunidade_mae: result[0] || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/membros/:id/convidador â€” who invited this member (via vitrine invite link)
  app.get("/api/membros/:id/convidador", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const candidatoId = req.params.id;
      const convites = await storage.getConvitesByCandidato(candidatoId).catch((conviteError: any) => {
        console.warn("[membros] Nao foi possivel carregar convidador individual:", conviteError?.message || conviteError);
        return [];
      });
      const vitrineConvite = convites.find((c: any) => c.invitador_membro_id);
      let invitadorId = vitrineConvite?.invitador_membro_id ? String(vitrineConvite.invitador_membro_id) : null;
      if (!invitadorId) {
        const col = await getComunidadeCol();
        const comunidades = await directusFetch(
          col,
          `filter[membros][cadastro_geral_id][_eq]=${encodeURIComponent(candidatoId)}&fields=id,aliado.id,aliado&limit=1`
        ).catch(() => []);
        const aliado = comunidades[0]?.aliado;
        invitadorId = typeof aliado === "object" && aliado !== null ? aliado.id : aliado || null;
      }
      if (!invitadorId) return res.json(null);
      const invitador = await getDirectusMembro(invitadorId).catch(() => null);
      if (!invitador) return res.json(null);
      res.json({ id: invitador.id, nome: invitador.nome || invitador.Nome_de_usuario || "Membro BUILT" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/membros/:id/comunidade â€” assign member to a community (and remove from old one)
  app.patch("/api/membros/:id/convidador", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const candidatoId = req.params.id;
      const convidadorId = req.body?.convidador_membro_id ? String(req.body.convidador_membro_id) : null;
      const convites = await storage.getConvitesByCandidato(candidatoId);

      if (!convidadorId) {
        await Promise.all(
          convites
            .filter((convite: any) => convite.invitador_membro_id)
            .map((convite: any) => storage.updateConvite(convite.id, { invitador_membro_id: null }))
        );
        return res.json({ success: true, convidador_membro_id: null });
      }

      const candidato = await getDirectusMembro(candidatoId).catch(() => null);
      const convidador = await getDirectusMembro(convidadorId).catch(() => null);
      if (!convidador) return res.status(404).json({ error: "Convidador nÃ£o encontrado" });

      let comunidadeId = req.body?.comunidade_id ? String(req.body.comunidade_id) : null;
      if (!comunidadeId) {
        comunidadeId = convites.find((convite: any) => convite.comunidade_id)?.comunidade_id || null;
      }
      if (!comunidadeId) {
        const col = await getComunidadeCol();
        const comunidades = await directusFetch(
          col,
          `filter[membros][cadastro_geral_id][_eq]=${encodeURIComponent(candidatoId)}&fields=id&limit=1`
        ).catch(() => []);
        comunidadeId = comunidades[0]?.id ? String(comunidades[0].id) : null;
      }
      if (!comunidadeId) {
        return res.status(400).json({ error: "Selecione uma comunidade antes de definir quem convidou este membro." });
      }

      const existing = convites[0];
      if (existing) {
        const updated = await storage.updateConvite(existing.id, {
          invitador_membro_id: convidadorId,
          comunidade_id: comunidadeId,
        } as any);
        return res.json({
          success: true,
          convidador_membro_id: convidadorId,
          convidador_nome: convidador.nome || convidador.Nome_de_usuario || "Membro BUILT",
          convite: updated,
        });
      }

      const created = await storage.createConvite({
        comunidade_id: comunidadeId,
        candidato_membro_id: candidatoId,
        candidato_nome: candidato?.nome || candidato?.Nome_de_usuario || null,
        candidato_email: candidato?.email || null,
        invitador_membro_id: convidadorId,
        status: "membro",
        tipo: "manual",
      });
      res.json({
        success: true,
        convidador_membro_id: convidadorId,
        convidador_nome: convidador.nome || convidador.Nome_de_usuario || "Membro BUILT",
        convite: created,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/membros/:id/convites-comunidade", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = req.params.id;
      const col = await getComunidadeCol();
      const allUrl = `${DIRECTUS_URL}/items/${col}?fields=id,nome,sigla,membros.cadastro_geral_id&limit=200`;
      const comunidadesRes = await fetch(allUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!comunidadesRes.ok) return res.json([]);
      const comunidadesData = await comunidadesRes.json();
      const comunidades: any[] = comunidadesData.data || [];
      const comunidade = comunidades.find((c: any) => {
        const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
        return membros.some((m: any) => {
          const cgId = typeof m.cadastro_geral_id === "object" ? m.cadastro_geral_id?.id : m.cadastro_geral_id;
          return String(cgId) === String(membroId);
        });
      });
      if (!comunidade) return res.json([]);

      const idsDaComunidade = new Set<string>(
        (Array.isArray(comunidade.membros) ? comunidade.membros : [])
          .map((m: any) => typeof m.cadastro_geral_id === "object" ? m.cadastro_geral_id?.id : m.cadastro_geral_id)
          .filter(Boolean)
          .map((memberId: any) => String(memberId))
      );

      const convites = await storage.getAllConvites();
      const porCandidato = new Map<string, any>();
      for (const convite of convites as any[]) {
        const candidatoId = convite.candidato_membro_id ? String(convite.candidato_membro_id) : "";
        const invitadorId = convite.invitador_membro_id ? String(convite.invitador_membro_id) : "";
        if (!candidatoId || invitadorId !== String(membroId)) continue;
        if (!idsDaComunidade.has(candidatoId)) continue;
        if (!porCandidato.has(candidatoId)) porCandidato.set(candidatoId, convite);
      }

      const convidados = await Promise.all(
        Array.from(porCandidato.entries()).map(async ([candidatoId, convite]) => {
          const candidato = await getDirectusMembro(candidatoId).catch(() => null);
          return {
            id: candidatoId,
            nome: candidato?.nome || candidato?.Nome_de_usuario || convite.candidato_nome || "Membro BUILT",
            email: candidato?.email || convite.candidato_email || null,
            empresa: candidato?.empresa || candidato?.nome_fantasia || null,
            foto_perfil: candidato?.foto_perfil || null,
            status: convite.status || null,
            tipo: convite.tipo || null,
            comunidade_id: comunidade.id,
            comunidade_nome: comunidade.nome || comunidade.sigla || null,
          };
        })
      );

      convidados.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
      res.json(convidados);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros/:id/comunidade", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const membroId = req.params.id;
      const comunidadeId = req.body?.comunidade_id ? String(req.body.comunidade_id) : "";
      if (!comunidadeId) return res.status(400).json({ error: "Selecione uma comunidade." });
      res.json(await setMembroInComunidadeM2M(membroId, comunidadeId, true));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros/:id/comunidade-aliado", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const membroId = req.params.id;
      const comunidadeId = req.body?.comunidade_id ? String(req.body.comunidade_id) : "";
      if (!comunidadeId) return res.status(400).json({ error: "Selecione uma comunidade." });

      const col = await getComunidadeCol();
      const patch = await fetch(`${DIRECTUS_URL}/items/${col}/${comunidadeId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aliado: membroId }),
      });
      if (!patch.ok) {
        const err = await patch.text().catch(() => "");
        throw new Error(err || "Falha ao vincular membro como aliado da comunidade");
      }
      res.json({ success: true, comunidade_id: comunidadeId, membro_id: membroId, papel: "aliado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id/comunidade/:comunidadeId", async (req, res) => {
    if (!await requireCadastroAccess(req, res)) return;
    try {
      const links = await getMembroComunidadesLinks(req.params.id);
      const comunidadeMae = await resolveMembroComunidadeMae(req.params.id, links as any[]);
      if (comunidadeMae && String(comunidadeMae.comunidade_id) === String(req.params.comunidadeId)) {
        return res.status(403).json({ error: "A Comunidade Mãe não pode ser removida." });
      }
      res.json(await setMembroInComunidadeM2M(req.params.id, req.params.comunidadeId, false));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIAS PROJETOS (from Directus) ==========
  function parseBiaMemberList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item: any) => {
          if (typeof item === "string") return item.trim();
          return directusRelationId(item?.cadastro_geral_id) || directusRelationId(item) || "";
        })
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    }
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseBiaMemberList(parsed);
    } catch {}
    return value.split(",").map((id) => id.trim()).filter(Boolean);
  }

  function resolveAnexosBia(items: any[]): any[] {
    return items.map((b: any) => ({
      ...b,
      bia_publica: b.bia_publica !== false,
      imagem_url: assetApiUrl(b.imagem_directus_id),
      socios_multiplicadores: parseBiaMemberList(b.socios_multiplicadores),
      socios_guardioes: parseBiaMemberList(b.socios_guardioes),
      terceiros: parseBiaMemberList(b.terceiros),
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

  function isUserLinkedToBia(bia: any, membroId?: string | null): boolean {
    if (!membroId) return false;
    const singleMemberFields = [
      "autor_bia", "aliado_built", "diretor_alianca", "diretor_nucleo_tecnico",
      "diretor_execucao", "diretor_comercial", "diretor_capital",
    ];
    if (singleMemberFields.some((field) => String(directusRelationId(bia[field]) || "") === String(membroId))) return true;
    return [
      ...parseBiaMemberList(bia.socios_guardioes),
      ...parseBiaMemberList(bia.socios_multiplicadores),
      ...parseBiaMemberList(bia.terceiros),
    ].includes(membroId);
  }

  function canViewBia(bia: any, req: any): boolean {
    if (bia.bia_publica !== false) return true;
    const role = req.session?.role || "user";
    if (role === "admin" || role === "manager") return true;
    return isUserLinkedToBia(bia, req.session?.membroId);
  }

  type ResolvedBiaAccess = {
    permissions: BiaAccessMatrix;
    defaultPermissions: BiaAccessMatrix;
    roles: BiaParticipantRole[];
    canManage: boolean;
    isParticipant: boolean;
    isBypass: boolean;
    customized: boolean;
    storageAvailable: boolean;
    override: any | null;
  };

  function hasBiaAdminBypass(req: any): boolean {
    const role = String(req.session?.role || "user").toLowerCase();
    return ["admin", "manager", "superadmin", "master"].includes(role)
      || isBootstrapSuperAdmin(req.session?.email);
  }

  async function readBiaPermissionOverride(biaId: string, membroId: string) {
    try {
      const [row] = await db.select()
        .from(biaUserPermissions)
        .where(and(eq(biaUserPermissions.bia_id, biaId), eq(biaUserPermissions.membro_id, membroId)))
        .limit(1);
      return { row: row || null, available: true };
    } catch (error: any) {
      console.warn("[bia-access] leitura indisponivel:", error?.message || error);
      ensureBiaUserPermissionsTable().catch(() => {});
      return { row: null, available: false };
    }
  }

  function effectiveParticipantPermissions(
    roles: BiaParticipantRole[],
    override: any | null,
    storageAvailable: boolean,
  ): BiaAccessMatrix {
    return resolveBiaParticipantPermissions(roles, override?.permissions, storageAvailable);
  }

  async function resolveBiaAccessForRequest(bia: any, req: any): Promise<ResolvedBiaAccess> {
    if (hasBiaAdminBypass(req)) {
      return {
        permissions: { ...FULL_BIA_ACCESS },
        defaultPermissions: { ...FULL_BIA_ACCESS },
        roles: [],
        canManage: true,
        isParticipant: true,
        isBypass: true,
        customized: false,
        storageAvailable: true,
        override: null,
      };
    }

    const membroId = req.session?.membroId ? String(req.session.membroId) : null;
    const participantRoles = collectBiaParticipantRoles(bia);
    const roles = membroId ? participantRoles.get(membroId) || [] : [];
    const defaultPermissions = defaultBiaAccessForRoles(roles);
    if (!membroId || roles.length === 0) {
      return {
        permissions: { ...EMPTY_BIA_ACCESS },
        defaultPermissions,
        roles,
        canManage: false,
        isParticipant: false,
        isBypass: false,
        customized: false,
        storageAvailable: true,
        override: null,
      };
    }

    const stored = await readBiaPermissionOverride(String(bia.id), membroId);
    return {
      permissions: effectiveParticipantPermissions(roles, stored.row, stored.available),
      defaultPermissions,
      roles,
      canManage: canManageBiaAccess(roles),
      isParticipant: true,
      isBypass: false,
      customized: Boolean(stored.row),
      storageAvailable: stored.available,
      override: stored.row,
    };
  }

  async function requireBiaModuleAccess(
    req: any,
    res: any,
    biaRef: string,
    key: BiaAccessKey,
    required: Exclude<BiaAccessLevel, "none"> = "view",
  ) {
    if (!(req.session as any).directusUserId) {
      res.status(401).json({ error: "Nao autenticado" });
      return null;
    }
    if (req.session?.companyEmployeeId) {
      const companyModule: CompanyAccessKey = key.startsWith("capital_") ? "capital" : "alliances";
      if (!hasCompanyAccess(req.session.companyEmployeePermissions, companyModule, required)) {
        res.status(403).json({
          error: required === "edit"
            ? "Seu acesso da empresa permite apenas visualizar esta área."
            : "O responsável da empresa não liberou esta área para você.",
          code: "COMPANY_ACCESS_DENIED",
          module: companyModule,
          required,
        });
        return null;
      }
    }
    const bia = await resolveBiaByIdOrPublicCode(biaRef, "*");
    if (!bia?.id) {
      res.status(404).json({ error: "BIA nao encontrada" });
      return null;
    }
    const access = await resolveBiaAccessForRequest(bia, req);
    if (!hasBiaAccess(access.permissions, key, required)) {
      res.status(403).json({
        error: access.storageAvailable
          ? "Seu acesso a esta area da BIA foi removido."
          : "Nao foi possivel confirmar seu acesso agora.",
        code: "BIA_ACCESS_DENIED",
        module: key,
        required,
      });
      return null;
    }
    return { bia, access };
  }

  function directusRelationId(value: any): string | null {
    if (!value) return null;
    if (typeof value === "object") return value.id ? String(value.id) : null;
    return String(value);
  }

  async function canDeleteBia(req: any, bia: any): Promise<boolean> {
    const role = req.session?.role || "user";
    const membroId = req.session?.membroId || null;
    if (role === "admin") return true;
    if (role === "aliado") return true;
    if (membroId && directusRelationId(bia?.aliado_built) === String(membroId)) return true;

    if (!membroId) return false;
    try {
      const membro = await directusFetchOne(
        "cadastro_geral",
        membroId,
        "fields=Outras_redes_as_quais_pertenco"
      );
      const redes = Array.isArray(membro?.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : [];
      return redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER");
    } catch (_) {
      return false;
    }
  }

  const DIRETOR_SOLICITACAO_CONFIG = [
    { campoDiretor: "diretor_alianca", campoPercentual: "perc_dir_alianca", papel: "Diretor de Aliança" },
    { campoDiretor: "diretor_nucleo_tecnico", campoPercentual: "perc_dir_tecnico", papel: "Dir. Núcleo Técnico" },
    { campoDiretor: "diretor_execucao", campoPercentual: "perc_dir_obras", papel: "Dir. Núcleo de Obra" },
    { campoDiretor: "diretor_comercial", campoPercentual: "perc_dir_comercial", papel: "Dir. Núcleo Comercial" },
    { campoDiretor: "diretor_capital", campoPercentual: "perc_dir_capital", papel: "Dir. Núcleo de Capital" },
  ];

  const SOCIO_SOLICITACAO_CONFIG = [
    { campoSocios: "socios_guardioes", papel: "Sócio Guardião" },
    { campoSocios: "socios_multiplicadores", papel: "Sócio Multiplicador" },
  ];

  const BIA_PENDING_BYPASS_CODES = new Set(["RHCF8KKLKC"]);

  function isBiaPendingBypassed(bia?: any | null, fallbackId?: string | null): boolean {
    const publicCode = String(bia?.codigo_publico || "").trim().toUpperCase();
    const routeId = String(fallbackId || "").trim().toUpperCase();
    return BIA_PENDING_BYPASS_CODES.has(publicCode) || BIA_PENDING_BYPASS_CODES.has(routeId);
  }

  const BIA_MOU_VERSAO = "BUILT-JUR-6-BIA-PATRIMONIAL-2026-23.06.26";
  const BIA_MOU_TITULO = "MOU Padrao BUILT - BIA Patrimonial";
  const BIA_MOU_FALLBACK_TEXTO = [
    "MEMORANDO DE ENTENDIMENTOS (MOU)",
    "",
    "ALIANCA PATRIMONIAL PADRAO BUILT",
    "",
    "Este MOU estabelece as diretrizes gerais de participacao, governanca, rastreabilidade, responsabilidades, confidencialidade, boa-fe e validacao das contribuicoes dos participantes de uma BIA.",
    "",
    "O aceite deste MOU e requisito para efetivacao do papel indicado na BIA. O documento completo deve ser consultado na plataforma BUILT e interpretado em conjunto com os registros, anexos e instrumentos especificos da respectiva alianca.",
  ].join("\n");
  const BIA_MOU_PATHS = [
    path.resolve(process.cwd(), "server", "assets", "bia-mou-padrao.txt"),
    path.resolve(process.cwd(), "dist", "server", "assets", "bia-mou-padrao.txt"),
    path.resolve(process.cwd(), "dist", "assets", "bia-mou-padrao.txt"),
    path.resolve(ROUTES_DIR, "server", "assets", "bia-mou-padrao.txt"),
    path.resolve(ROUTES_DIR, "assets", "bia-mou-padrao.txt"),
  ];
  let biaMouTextoCache: string | null = null;
  function getBiaMouTexto() {
    if (!biaMouTextoCache) {
      const mouPath = BIA_MOU_PATHS.find((candidate) => fs.existsSync(candidate));
      if (!mouPath) {
        console.warn("[bia-mou] Arquivo bia-mou-padrao.txt nao encontrado; usando texto fallback.");
        biaMouTextoCache = BIA_MOU_FALLBACK_TEXTO;
      } else {
        biaMouTextoCache = fs.readFileSync(mouPath, "utf8");
      }
    }
    return biaMouTextoCache;
  }

  function mouValue(value: any, fallback = "nÃ£o informado") {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text || fallback;
  }

  function formatMouGenerationDate(date = new Date()) {
    return date.toLocaleDateString("pt-BR");
  }

  function substituirLocalAssinaturaPorData(texto: string, date = new Date()) {
    return texto.replace(/^\s*Gramado\/RS,\s*$/gim, formatMouGenerationDate(date));
  }

  function buildBiaMouAtivoTexto(bia: any) {
    const campos = biaMouAtivoCampos(bia);
    const ativoPartes = [
      campos.qualificacao,
      campos.descricaoAdicional,
      campos.areaM2 ? `de área ${campos.areaM2}m²` : "",
    ].filter(Boolean).join(", ");
    const enderecoPartes = [campos.endereco, campos.numero ? `nº ${campos.numero}` : "", campos.complemento, campos.cep ? `CEP ${campos.cep}` : ""]
      .filter(Boolean)
      .join(", ");
    const registroPartes = [
      `Matrícula nº ${campos.matricula}`,
      campos.livro ? `Livro ${campos.livro}` : "",
      campos.folha ? `Folha ${campos.folha}` : "",
    ].filter(Boolean).join(", ");
    const cartorioPartes = [campos.cartorio, campos.comarca].filter(Boolean).join(", ");

    return [
      `1.2. O Ativo em questão é ${ativoPartes}, situado em ${campos.municipio}, ${campos.estado}, à ${enderecoPartes}, vinculado à ${registroPartes} do ${cartorioPartes}, com todas as suas acessões, frações ideais, características e ônus.`,
      "",
      "1.2.1. A descrição registral constante da matrícula integra este MOU por referência, sendo vedada qualquer interpretação extensiva a outros ativos.",
      "",
      `1.3. A exploração econômica será destinada ao objetivo da aliança: ${campos.objetivoAlianca}.`,
    ].join("\n\n");
  }

  function buildBiaMouEnderecoCompleto(bia: any) {
    return [
      bia?.ativo_endereco,
      bia?.ativo_numero ? `nº ${bia.ativo_numero}` : "",
      bia?.ativo_complemento,
      bia?.ativo_bairro,
      bia?.ativo_cidade,
      bia?.ativo_estado,
      bia?.ativo_pais,
      bia?.ativo_cep ? `CEP ${bia.ativo_cep}` : "",
    ].filter((item) => String(item || "").trim()).join(", ");
  }

  function biaMouAtivoCampos(bia: any) {
    const localizacaoPartes = String(bia?.localizacao || "")
      .split(",")
      .map((parte) => parte.trim())
      .filter(Boolean);
    const enderecoCompleto = buildBiaMouEnderecoCompleto(bia);
    return {
      qualificacao: mouValue(bia?.ativo_qualificacao || bia?.objetivo_alianca || bia?.nome_bia, "ativo não informado"),
      descricao: mouValue(bia?.ativo_qualificacao || bia?.objetivo_alianca || bia?.nome_bia, "ativo não informado"),
      descricaoAdicional: String(bia?.ativo_descricao_adicional || "").trim(),
      areaM2: String(bia?.ativo_area_m2 || "").trim(),
      endereco: mouValue(bia?.ativo_endereco || bia?.endereco || bia?.localizacao, "endereço não informado"),
      enderecoCompleto: mouValue(enderecoCompleto || bia?.ativo_endereco || bia?.endereco || bia?.localizacao, "endereço não informado"),
      numero: String(bia?.ativo_numero || "").trim(),
      complemento: String(bia?.ativo_complemento || "").trim(),
      cep: String(bia?.ativo_cep || "").trim(),
      bairro: String(bia?.ativo_bairro || "").trim(),
      municipio: mouValue(bia?.ativo_cidade || bia?.ativo_municipio || bia?.cidade || localizacaoPartes[0]),
      estado: mouValue(bia?.ativo_estado || bia?.estado || localizacaoPartes[1]),
      pais: String(bia?.ativo_pais || "").trim(),
      matricula: mouValue(bia?.ativo_numero_matricula),
      livro: String(bia?.ativo_livro || "").trim(),
      folha: String(bia?.ativo_folha || "").trim(),
      cartorio: mouValue(bia?.ativo_cartorio, "Cartório não informado"),
      comarca: mouValue(bia?.ativo_comarca, "Comarca não informada"),
      destinacao: mouValue(bia?.destinacao, "não informada"),
      objetivoAlianca: mouValue(bia?.objetivo_alianca || bia?.destinacao, "não informado"),
    };
  }

  function substituirBiaMouPlaceholders(texto: string, bia: any) {
    const campos = biaMouAtivoCampos(bia);
    const normalizePlaceholder = (value: string) => {
      const decoded = /[ÃƒÃ‚]/.test(value) ? Buffer.from(value, "latin1").toString("utf8") : value;
      return decoded
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Âº/g, "o")
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .toLowerCase();
    };
    const valuesByKey: Record<string, string> = {
      qualificacao: campos.qualificacao,
      "qualificacao casa galpao apartamento": campos.qualificacao,
      "descricao do ativo": campos.descricao,
      "descricao adicional": campos.descricaoAdicional,
      "area em m2": campos.areaM2,
      "area em m": campos.areaM2,
      area: campos.areaM2,
      endereco: campos.enderecoCompleto,
      "endereco completo": campos.enderecoCompleto,
      numero: campos.numero,
      "n": campos.numero,
      "no": campos.numero,
      complemento: campos.complemento,
      cep: campos.cep,
      bairro: campos.bairro,
      cidade: campos.municipio,
      municipio: campos.municipio,
      estado: campos.estado,
      pais: campos.pais,
      "no da matricula": campos.matricula,
      "n da matricula": campos.matricula,
      "numero da matricula": campos.matricula,
      livro: campos.livro,
      folha: campos.folha,
      cartorio: campos.cartorio,
      comarca: campos.comarca,
      objetivo: campos.objetivoAlianca,
      destinacao: campos.objetivoAlianca,
      "objetivo da alianca": campos.objetivoAlianca,
      "objetico da alianca": campos.objetivoAlianca,
    };
    return texto.replace(/\[([^\]]+)\]/g, (match, key) => valuesByKey[normalizePlaceholder(String(key))] ?? match);
  }

  function substituirBiaMouBlocoAtivo(texto: string, bia: any) {
    const blocoAtivo = buildBiaMouAtivoTexto(bia);
    const numberedBlockPattern = /1\.2\.[\s\S]*?(?=\n\s*1\.4\.)/i;
    if (numberedBlockPattern.test(texto)) {
      return texto.replace(numberedBlockPattern, `${blocoAtivo}\n\n`);
    }
    const inlineBlockPattern = /(?:1\.2\.\s*)?O Ativo em quest[\s\S]*?(?:1\.3\.\s*)?A explora[\s\S]*?mica ser[\s\S]*?destinada[\s\S]*?\./i;
    if (inlineBlockPattern.test(texto)) return texto.replace(inlineBlockPattern, blocoAtivo);
    return texto;
  }

  function personalizarBiaMouTexto(texto: string, biaId: string, bia: any) {
    const textoComAtivo = substituirBiaMouBlocoAtivo(substituirBiaMouPlaceholders(texto, bia), bia);
    return appendBiaMouRodape(substituirLocalAssinaturaPorData(textoComAtivo), biaId, bia);
  }

  function buildBiaMouRodapeTexto(bia: any, biaId: string) {
    const biaNome = String(bia?.nome_bia || "selecionada")
      .replace(/\s+/g, " ")
      .replace(/^BIA\s+/i, "")
      .trim();
    const codigoCurto = String(bia?.codigo_publico || biaId).trim();
    const biaLabel = [biaNome, codigoCurto].filter(Boolean).join(" / ");
    return `Esta página integra o MoU Padrão BUILT vinculado à BIA ${biaLabel} e deve ser interpretada em conjunto com o documento completo, seus anexos, registros formais, deliberações internas e instrumentos jurídicos específicos da respectiva Aliança.`;
  }

  function appendBiaMouRodape(texto: string, biaId: string, bia: any) {
    const rodape = buildBiaMouRodapeTexto(bia, biaId);
    return `${texto.trim()}\n\n${rodape}`;
  }

  async function getBiaMouTextoPersonalizado(biaId?: string | null) {
    const texto = getBiaMouTexto();
    if (!biaId) return texto;
    const bia = await directusFetchOne(
      "bias_projetos",
      String(biaId),
      "fields=id,codigo_publico,nome_bia,objetivo_alianca,destinacao,localizacao,ativo_endereco,ativo_bairro,ativo_cidade,ativo_estado,ativo_pais,ativo_qualificacao,ativo_descricao_adicional,ativo_area_m2,ativo_numero,ativo_complemento,ativo_cep,ativo_numero_matricula,ativo_livro,ativo_folha,ativo_cartorio,ativo_comarca"
    ).catch(() => null);
    if (!bia) return texto;
    const infoLocal = await storage.getBiaInfoComercial(String(biaId)).catch(() => null);
    const biaComInfo = {
      ...bia,
      ...pickFilledBiaInfoComercialFields(bia ?? {}),
      ...pickFilledBiaInfoComercialFields(infoLocal ?? {}),
    };
    return personalizarBiaMouTexto(texto, String(biaId), biaComInfo);
  }

  const CHAMADA_ALIANCA_TITULO_OPA = "Chamadas para alianÃ§a de LideranÃ§a";
  function validateBiaMouDadosContratuais(data: any) {
    const body = data && typeof data === "object" ? data : {};
    const missing: string[] = [];
    const required = [
      ["nome_completo", "Nome completo"],
      ["nacionalidade", "Nacionalidade"],
      ["nome_mae", "Nome da mÃ£e"],
      ["nome_pai", "Nome do pai"],
      ["data_nascimento", "Data de nascimento"],
      ["profissao", "ProfissÃ£o"],
      ["email", "E-mail"],
      ["telefone", "Telefone"],
      ["cpf", "CPF"],
      ["rg", "RG"],
      ["estado_civil", "Estado civil"],
    ];
    for (const [key, label] of required) {
      if (!String(body[key] || "").trim()) missing.push(label);
    }

    const estadoCivil = String(body.estado_civil || "").toLowerCase();
    const isCasado = estadoCivil === "casado" || estadoCivil === "casada";
    if (isCasado) {
      [
        ["regime_comunhao", "Regime de comunhÃ£o"],
        ["conjuge_nome_completo", "Nome do cÃ´njuge"],
        ["conjuge_nacionalidade", "Nacionalidade do cÃ´njuge"],
        ["conjuge_nome_mae", "Nome da mÃ£e do cÃ´njuge"],
        ["conjuge_nome_pai", "Nome do pai do cÃ´njuge"],
        ["conjuge_data_nascimento", "Data de nascimento do cÃ´njuge"],
        ["conjuge_profissao", "ProfissÃ£o do cÃ´njuge"],
        ["conjuge_email", "E-mail do cÃ´njuge"],
        ["conjuge_telefone", "Telefone do cÃ´njuge"],
        ["conjuge_cpf", "CPF do cÃ´njuge"],
        ["conjuge_rg", "RG do cÃ´njuge"],
      ].forEach(([key, label]) => {
        if (!String(body[key] || "").trim()) missing.push(label);
      });
    }

    const mesmoEndereco = body.mesmo_endereco === true || body.mesmo_endereco === "true";
    const addressFields = [
      ["endereco", "EndereÃ§o"],
      ["bairro", "Bairro"],
      ["cidade", "Cidade"],
      ["estado", "Estado"],
      ["pais", "PaÃ­s"],
    ];
    if (isCasado && !mesmoEndereco) {
      addressFields.forEach(([key, label]) => {
        if (!String(body[`titular_${key}`] || "").trim()) missing.push(`${label} do titular`);
        if (!String(body[`conjuge_${key}`] || "").trim()) missing.push(`${label} do cÃ´njuge`);
      });
    } else {
      addressFields.forEach(([key, label]) => {
        if (!String(body[key] || "").trim()) missing.push(label);
      });
    }

    return { ok: missing.length === 0, missing, data: body };
  }

  const BIA_DADOS_CONTRATUAIS_CADASTRO_FIELDS = [
    "nacionalidade",
    "nome_mae",
    "nome_pai",
    "data_nascimento",
    "profissao",
    "email",
    "telefone",
    "cpf",
    "rg",
    "estado_civil",
    "regime_comunhao",
    "conjuge_nome_completo",
    "conjuge_nacionalidade",
    "conjuge_nome_mae",
    "conjuge_nome_pai",
    "conjuge_data_nascimento",
    "conjuge_profissao",
    "conjuge_email",
    "conjuge_telefone",
    "conjuge_cpf",
    "conjuge_rg",
    "mesmo_endereco",
    "cep",
    "endereco",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "pais",
    "titular_cep",
    "titular_endereco",
    "titular_numero",
    "titular_complemento",
    "titular_bairro",
    "titular_cidade",
    "titular_estado",
    "titular_pais",
    "conjuge_cep",
    "conjuge_endereco",
    "conjuge_numero",
    "conjuge_complemento",
    "conjuge_bairro",
    "conjuge_cidade",
    "conjuge_estado",
    "conjuge_pais",
  ];

  function pickBiaDadosContratuaisCadastro(data: Record<string, any>) {
    const payload: Record<string, any> = {};
    if (String(data.nome_completo || "").trim()) payload.nome = String(data.nome_completo).trim();
    for (const field of BIA_DADOS_CONTRATUAIS_CADASTRO_FIELDS) {
      if (data[field] !== undefined) payload[field] = data[field];
    }
    return payload;
  }

  const CHAMADA_ALIANCA_SEQUENCE = [
    { ordem: 1, escopo: "comunidade", label: "RO para a comunidade" },
    { ordem: 2, escopo: "territorio", label: "RO para o territÃ³rio" },
    { ordem: 3, escopo: "nacional", label: "RO nacional" },
    { ordem: 4, escopo: "global", label: "RO global" },
  ];
  const CHAMADA_DIRETOR_CONFIG: Record<string, { nucleo: string; tipo: string }> = {
    diretor_alianca: { nucleo: "LideranÃ§a", tipo: "LideranÃ§a" },
    diretor_nucleo_tecnico: { nucleo: "NÃºcleo tÃ©cnico", tipo: "Projeto" },
    diretor_execucao: { nucleo: "NÃºcleo de Obra", tipo: "ExecuÃ§Ã£o" },
    diretor_comercial: { nucleo: "NÃºcleo Comercial", tipo: "Comercial" },
    diretor_capital: { nucleo: "NÃºcleo de Capital", tipo: "Aporte Financeiro" },
  };

  Object.keys(CHAMADA_DIRETOR_CONFIG).forEach((campo) => {
    CHAMADA_DIRETOR_CONFIG[campo].tipo = "LideranÃ§a";
  });

  const CHAMADA_DIRETOR_PERCENTUAL_FIELDS: Record<string, string> = {
    diretor_alianca: "perc_dir_alianca",
    diretor_nucleo_tecnico: "perc_dir_tecnico",
    diretor_execucao: "perc_dir_obras",
    diretor_comercial: "perc_dir_comercial",
    diretor_capital: "perc_dir_capital",
  };

  const CHAMADA_PATRIMONIAL_CONFIG: Record<string, { nucleo: string; tipo: string; label: string }> = {
    socios_guardioes: { nucleo: "Socios Guardioes", tipo: "Aporte Financeiro", label: "Socios Guardioes" },
    socios_multiplicadores: { nucleo: "Socios Multiplicadores", tipo: "Aporte Financeiro", label: "Socios Multiplicadores" },
  };

  function normalizePercent(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return null;
    return String(parsed);
  }

  async function getMembroResumo(membroId: string | null | undefined): Promise<{ id: string; nome: string | null; email: string | null } | null> {
    if (!membroId) return null;
    try {
      const membro = await directusFetchOne("cadastro_geral", String(membroId), "fields=id,nome,Nome_de_usuario,email");
      if (!membro) return null;
      return {
        id: String(membro.id),
        nome: membro.nome || membro.Nome_de_usuario || membro.email || null,
        email: membro.email || null,
      };
    } catch (_) {
      return { id: String(membroId), nome: null, email: null };
    }
  }

  async function getBiaIntegrantesParaNotificar(biaId: string, excludeMembroId?: string | null): Promise<Array<{ id: string; nome: string | null; email: string | null }>> {
    const bia = await directusFetchOne(
      "bias_projetos",
      biaId,
      "fields=id,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital,socios_guardioes,socios_multiplicadores"
    ).catch(() => null);
    const ids = new Set<string>();
    [
      bia?.aliado_built,
      bia?.diretor_alianca,
      bia?.diretor_nucleo_tecnico,
      bia?.diretor_execucao,
      bia?.diretor_comercial,
      bia?.diretor_capital,
      ...parseBiaMemberList(bia?.socios_guardioes),
      ...parseBiaMemberList(bia?.socios_multiplicadores),
    ].forEach((id) => {
      const value = directusRelationId(id);
      if (value && value !== excludeMembroId) ids.add(value);
    });
    const membros = await Promise.all(Array.from(ids).map((id) => getMembroResumo(id)));
    return membros.filter((m): m is { id: string; nome: string | null; email: string | null } => !!m?.email);
  }

  async function notificarRespostaSolicitacao(opts: {
    solicitanteEmail?: string | null;
    solicitanteNome?: string | null;
    convidadoNome?: string | null;
    biaNome: string;
    papel: string;
    aceito: boolean;
  }) {
    if (!opts.solicitanteEmail) return;
    const { enviarRespostaSolicitacaoBia } = await import("./mailer");
    enviarRespostaSolicitacaoBia({
      destinatarioEmail: opts.solicitanteEmail,
      destinatarioNome: opts.solicitanteNome,
      convidadoNome: opts.convidadoNome,
      biaNome: opts.biaNome,
      papel: opts.papel,
      aceito: opts.aceito,
    }).catch((e: any) => console.error("[bia-solicitacoes] resposta email error:", e.message));
  }

  async function notificarNovoIntegrante(opts: {
    biaId: string;
    biaNome: string;
    novoMembroId: string;
    novoNome?: string | null;
    papel: string;
  }) {
    const destinatarios = await getBiaIntegrantesParaNotificar(opts.biaId, opts.novoMembroId);
    if (destinatarios.length === 0) return;
    const { enviarNovoIntegranteBia } = await import("./mailer");
    await Promise.all(destinatarios.map((dest) =>
      enviarNovoIntegranteBia({
        destinatarioEmail: dest.email!,
        destinatarioNome: dest.nome,
        novoNome: opts.novoNome,
        biaNome: opts.biaNome,
        papel: opts.papel,
      }).catch((e: any) => console.error("[bia-solicitacoes] integrante email error:", e.message))
    ));
  }

  async function ensureMouAceitoOuRetornaPendencia(biaId: string, membroId: string, aceitarMou: boolean, dadosContratuais?: any, aceiteLocalizacao?: any) {
    const aceite = await storage.getBiaMouAceite(biaId, membroId, BIA_MOU_VERSAO);
    if (aceite) return { ok: true };
    if (!aceitarMou) {
      const biaResumo = await directusFetchOne(
        "bias_projetos",
        biaId,
        "fields=id,nome_bia"
      ).catch(() => null);
      return {
        ok: false,
        response: {
          status: "mou_pendente",
          mou: {
            titulo: BIA_MOU_TITULO,
            versao: BIA_MOU_VERSAO,
            bia_id: biaId,
            bia_nome: biaResumo?.nome_bia || null,
            texto: await getBiaMouTextoPersonalizado(biaId),
          },
        },
      };
    }
    const capturedLocation = getCapturedAcceptanceLocation(aceiteLocalizacao);
    if (!capturedLocation) {
      return {
        ok: false,
        statusCode: 400,
        response: { error: ACCEPTANCE_LOCATION_REQUIRED_ERROR },
      };
    }
    const dadosCheck = validateBiaMouDadosContratuais(dadosContratuais);
    if (!dadosCheck.ok) {
      return {
        ok: false,
        statusCode: 400,
        response: {
          error: `Preencha os dados obrigatÃ³rios antes de concluir: ${dadosCheck.missing.join(", ")}.`,
          campos: dadosCheck.missing,
        },
      };
    }
    await storage.createBiaMouAceite({
      bia_id: biaId,
      membro_id: membroId,
      mou_versao: BIA_MOU_VERSAO,
      mou_titulo: BIA_MOU_TITULO,
      dados_contratuais: dadosCheck.data,
      aceite_localizacao: capturedLocation as any,
    });
    await ensureVitrineFields();
    await directusUpdate("cadastro_geral", membroId, pickBiaDadosContratuaisCadastro(dadosCheck.data)).catch((error: any) => {
      console.error("[bia-mou] erro ao salvar dados contratuais no cadastro:", error?.message || error);
    });
    return { ok: true };
  }

  async function hasBiaMouAceito(biaId: string, membroId: string) {
    return !!(await storage.getBiaMouAceite(biaId, membroId, BIA_MOU_VERSAO));
  }

  async function createDiretorSolicitacao(params: {
    biaId: string;
    biaNome: string | null;
    diretorId: string;
    papel: string;
    campoDiretor: string;
    campoPercentual: string;
    percentual: string | null;
    req: any;
  }) {
    const diretor = await getMembroResumo(params.diretorId);
    const solicitacao = await storage.createBiaDiretorSolicitacao({
      bia_id: params.biaId,
      bia_nome: params.biaNome,
      diretor_membro_id: params.diretorId,
      diretor_nome: diretor?.nome || null,
      diretor_email: diretor?.email || null,
      papel: params.papel,
      campo_diretor: params.campoDiretor,
      campo_percentual: params.campoPercentual,
      percentual: params.percentual,
      status: "pendente",
      solicitante_membro_id: params.req.session?.membroId || null,
      solicitante_nome: params.req.session?.nome || null,
      solicitante_email: params.req.session?.email || null,
    });

    if (diretor?.email) {
      const { enviarSolicitacaoDiretoriaBia } = await import("./mailer");
      enviarSolicitacaoDiretoriaBia({
        diretorEmail: diretor.email,
        diretorNome: diretor.nome || "membro",
        biaNome: params.biaNome || params.biaId,
        papel: params.papel,
        percentual: params.percentual,
        solicitanteNome: params.req.session?.nome || null,
      }).catch((e: any) => console.error("[bia-diretores] email error:", e.message));
    }

    return solicitacao;
  }

  async function processDiretorSolicitacoes(opts: {
    biaId: string;
    biaNome: string | null;
    body: any;
    payload: any;
    req: any;
    currentBia?: any | null;
  }) {
    const criadas: any[] = [];
    for (const config of DIRETOR_SOLICITACAO_CONFIG) {
      const requestedDiretor = opts.body[config.campoDiretor] ? String(opts.body[config.campoDiretor]) : null;
      const requestedPercentual = normalizePercent(opts.body[config.campoPercentual]);
      const currentDiretor = opts.currentBia ? directusRelationId(opts.currentBia[config.campoDiretor]) : null;

      if (!requestedDiretor) {
        await storage.cancelBiaDiretorSolicitacoes(opts.biaId, config.campoDiretor);
        continue;
      }

      const pendentes = await storage.getBiaDiretorSolicitacoesPendentesByBia(opts.biaId);
      const jaExiste = pendentes.some((item) =>
        item.campo_diretor === config.campoDiretor && item.diretor_membro_id === requestedDiretor
      );

      if (currentDiretor && currentDiretor === requestedDiretor) {
        const mouAceito = await storage.getBiaMouAceite(opts.biaId, requestedDiretor, BIA_MOU_VERSAO);
        if (mouAceito) {
          if (opts.payload) {
            opts.payload[config.campoDiretor] = requestedDiretor;
            opts.payload[config.campoPercentual] = requestedPercentual;
          }
          continue;
        }
        if (jaExiste) continue;
        if (opts.payload) {
          opts.payload[config.campoDiretor] = null;
          opts.payload[config.campoPercentual] = null;
        }
      }

      await storage.cancelBiaDiretorSolicitacoes(opts.biaId, config.campoDiretor, requestedDiretor);

      if (jaExiste) continue;

      const solicitacao = await createDiretorSolicitacao({
        biaId: opts.biaId,
        biaNome: opts.biaNome,
        diretorId: requestedDiretor,
        papel: config.papel,
        campoDiretor: config.campoDiretor,
        campoPercentual: config.campoPercentual,
        percentual: requestedPercentual,
        req: opts.req,
      });
      criadas.push(solicitacao);
    }
    return criadas;
  }

  async function createSocioSolicitacao(params: {
    biaId: string;
    biaNome: string | null;
    socioId: string;
    papel: string;
    campoSocios: string;
    req: any;
  }) {
    const socio = await getMembroResumo(params.socioId);
    const solicitacao = await storage.createBiaSocioSolicitacao({
      bia_id: params.biaId,
      bia_nome: params.biaNome,
      socio_membro_id: params.socioId,
      socio_nome: socio?.nome || null,
      socio_email: socio?.email || null,
      papel: params.papel,
      campo_socios: params.campoSocios,
      status: "pendente",
      solicitante_membro_id: params.req.session?.membroId || null,
      solicitante_nome: params.req.session?.nome || null,
      solicitante_email: params.req.session?.email || null,
    });

    if (socio?.email) {
      const { enviarSolicitacaoSocioBia } = await import("./mailer");
      enviarSolicitacaoSocioBia({
        socioEmail: socio.email,
        socioNome: socio.nome || "membro",
        biaNome: params.biaNome || params.biaId,
        papel: params.papel,
        solicitanteNome: params.req.session?.nome || null,
      }).catch((e: any) => console.error("[bia-socios] email error:", e.message));
    }

    return solicitacao;
  }

  async function processSocioSolicitacoes(opts: {
    biaId: string;
    biaNome: string | null;
    body: any;
    req: any;
    payload?: any;
    currentBia?: any | null;
  }) {
    const criadas: any[] = [];
    for (const config of SOCIO_SOLICITACAO_CONFIG) {
      if (!Object.prototype.hasOwnProperty.call(opts.body, config.campoSocios)) continue;
      const requestedIds = parseBiaMemberList(opts.body[config.campoSocios]);
      const currentIds = opts.currentBia ? parseBiaMemberList(opts.currentBia[config.campoSocios]) : [];
      const requestedSet = new Set(requestedIds);
      const pendentes = await storage.getBiaSocioSolicitacoesPendentesByBia(opts.biaId);
      const efetivados: string[] = [];

      for (const currentId of currentIds) {
        if (!requestedSet.has(currentId)) {
          await Promise.all(
            pendentes
              .filter((item) => item.campo_socios === config.campoSocios && item.socio_membro_id === currentId)
              .map((item) => storage.updateBiaSocioSolicitacao(item.id, { status: "cancelado", respondido_em: new Date() } as any))
          );
        }
      }

      for (const socioId of requestedIds) {
        if (await hasBiaMouAceito(opts.biaId, socioId)) {
          efetivados.push(socioId);
          continue;
        }
        const jaExiste = pendentes.some((item) =>
          item.campo_socios === config.campoSocios && item.socio_membro_id === socioId
        );
        if (jaExiste) continue;
        const solicitacao = await createSocioSolicitacao({
          biaId: opts.biaId,
          biaNome: opts.biaNome,
          socioId,
          papel: config.papel,
          campoSocios: config.campoSocios,
          req: opts.req,
        });
        criadas.push(solicitacao);
      }

      if (opts.payload) {
        opts.payload[config.campoSocios] = JSON.stringify(efetivados);
      }
    }
    return criadas;
  }

  function normalizeText(value: any): string {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function relationId(value: any): string | null {
    if (!value) return null;
    if (typeof value === "object") {
      if (value.id) return String(value.id);
      if (value.cadastro_geral_id) return relationId(value.cadastro_geral_id);
      if (value.bias_projetos_id) return relationId(value.bias_projetos_id);
    }
    return String(value);
  }

  function extractComunidadeMembros(comunidade: any): any[] {
    return (Array.isArray(comunidade?.membros) ? comunidade.membros : [])
      .map((item: any) => item?.cadastro_geral_id || item)
      .filter(Boolean);
  }

  function extractComunidadeBiaIds(comunidade: any): string[] {
    return (Array.isArray(comunidade?.bias) ? comunidade.bias : [])
      .map((item: any) => relationId(item?.bias_projetos_id || item?.bias_id || item))
      .filter(Boolean) as string[];
  }

  function membroMatchesNucleo(membro: any, nucleo: string): boolean {
    const target = normalizeText(nucleo);
    const values = [
      membro?.nucleo_alianca,
      ...(Array.isArray(membro?.nucleos_alianca) ? membro.nucleos_alianca : []),
      membro?.tipo_alianca,
      ...(Array.isArray(membro?.tipos_alianca) ? membro.tipos_alianca : []),
      membro?.cargo,
    ].map(normalizeText).filter(Boolean);
    return values.some((value) => value === target || value.includes(target) || target.includes(value));
  }

  async function loadComunidadesParaChamada() {
    const col = await getComunidadeCol();
    return directusFetchScoped(
      col,
      "limit=500&fields=id,nome,pais,territorio,sigla_territorio,bias.bias_projetos_id,membros.cadastro_geral_id.id,membros.cadastro_geral_id.nome,membros.cadastro_geral_id.Nome_de_usuario,membros.cadastro_geral_id.email,membros.cadastro_geral_id.cargo,membros.cadastro_geral_id.tipo_alianca,membros.cadastro_geral_id.tipos_alianca,membros.cadastro_geral_id.nucleo_alianca,membros.cadastro_geral_id.nucleos_alianca"
    );
  }

  async function getChamadaAudience(opts: { bia: any; biaId: string; diretorId: string | null; nucleo: string; escopo: string; filtrarNucleo?: boolean }) {
    const comunidades = await loadComunidadesParaChamada();
    const base = comunidades.find((com: any) => extractComunidadeBiaIds(com).includes(opts.biaId))
      || comunidades.find((com: any) => extractComunidadeMembros(com).some((m: any) => String(m.id) === String(opts.diretorId)));
    if (!base) return { comunidade: null, destinatarios: [] as any[] };

    const basePais = normalizeText(base.pais);
    const baseTerritorio = normalizeText(base.territorio);
    const comunidadesNoEscopo = comunidades.filter((com: any) => {
      if (opts.escopo === "comunidade") return String(com.id) === String(base.id);
      if (opts.escopo === "territorio") return normalizeText(com.pais) === basePais && normalizeText(com.territorio) === baseTerritorio;
      if (opts.escopo === "nacional") return normalizeText(com.pais) === basePais;
      return true;
    });

    const byId = new Map<string, any>();
    for (const com of comunidadesNoEscopo) {
      for (const membro of extractComunidadeMembros(com)) {
        if (!membro?.id || !membro?.email) continue;
        if (opts.filtrarNucleo !== false && !membroMatchesNucleo(membro, opts.nucleo)) continue;
        byId.set(String(membro.id), {
          id: String(membro.id),
          nome: membro.nome || membro.Nome_de_usuario || membro.email,
          email: membro.email,
        });
      }
    }

    return { comunidade: base, destinatarios: [...byId.values()] };
  }

  function getBiaNumericValue(bia: any, ...fields: string[]): number | null {
    for (const field of fields) {
      const raw = bia?.[field];
      const value = typeof raw === "number"
        ? raw
        : String(raw ?? "").includes(",")
          ? Number(String(raw).replace(/\./g, "").replace(",", "."))
          : Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  }

  function chamadaDiretorCampoFromNucleo(nucleo: string | null | undefined): string {
    const normalized = normalizeText(nucleo);
    if (normalized.includes("capital")) return "diretor_capital";
    if (normalized.includes("comercial")) return "diretor_comercial";
    if (normalized.includes("obra")) return "diretor_execucao";
    if (normalized.includes("tecnico")) return "diretor_nucleo_tecnico";
    return "diretor_alianca";
  }

  function parseChamadaLinkFromDescricao(descricao: string | null | undefined): string | null {
    const match = String(descricao || "").match(/https?:\/\/\S+/i);
    return match?.[0] || null;
  }

  async function getChamadasAliancaFromOpas(opts: { membroId?: string | null; biaId?: string | null; includeAll?: boolean }) {
    const opas = await directusFetchScoped(
      "tipos_oportunidades",
      "limit=100&sort=-date_created&fields=id,nome_oportunidade,bia,nucleo_alianca,descricao,date_created"
    );
    const chamadasOpas = opas.filter((opa: any) => {
      const title = normalizeText(opa.nome_oportunidade);
      const desc = normalizeText(opa.descricao);
      const biaId = directusRelationId(opa.bia);
      if (opts.biaId && biaId !== opts.biaId) return false;
      return title.includes("chamadas para alianca de lideranca") || desc.includes("cargo em aberto");
    });

    const result: any[] = [];
    for (const opa of chamadasOpas) {
      const biaId = directusRelationId(opa.bia);
      if (!biaId) continue;
      const bia = await directusFetchOne("bias_projetos", biaId, "fields=*").catch(() => null);
      if (!bia) continue;
      const diretorCampo = chamadaDiretorCampoFromNucleo(opa.nucleo_alianca);
      const audience = await getChamadaAudience({
        bia,
        biaId,
        diretorId: null,
        nucleo: opa.nucleo_alianca || CHAMADA_DIRETOR_CONFIG[diretorCampo]?.nucleo || "Lideranca",
        escopo: "comunidade",
      }).catch(() => ({ destinatarios: [] as any[] }));
      const destinatarios = audience.destinatarios || [];
      if (!opts.includeAll && opts.membroId && !destinatarios.some((item: any) => String(item.id) === String(opts.membroId))) {
        continue;
      }
      result.push({
        id: `opa:${opa.id}`,
        bia_id: biaId,
        bia_nome: bia.nome_bia || null,
        diretor_campo: diretorCampo,
        diretor_membro_id: null,
        diretor_nome: null,
        nucleo_alianca: opa.nucleo_alianca || null,
        ordem: 1,
        escopo: "comunidade",
        titulo: "RO para a comunidade",
        data_hora: opa.date_created || new Date().toISOString(),
        link_reuniao: parseChamadaLinkFromDescricao(opa.descricao),
        opa_id: opa.id,
        destinatarios,
        status: "pendente",
        origem: "opa",
      });
    }
    return result;
  }

  app.get("/api/chamadas-alianca/minhas", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const role = (req.session as any).role || "user";
      const membroId = (req.session as any).membroId as string | null;
      if (role === "admin" || role === "manager" || role === "superadmin") {
        return res.json(await storage.getAllChamadasAlianca());
      }
      if (!membroId) return res.json([]);
      return res.json(await storage.getChamadasAliancaByDestinatario(membroId));
    } catch (error: any) {
      if (String(error?.message || "").includes("ECONNREFUSED")) {
        const role = (req.session as any).role || "user";
        const membroId = (req.session as any).membroId as string | null;
        const includeAll = role === "admin" || role === "manager" || role === "superadmin";
        return res.json(await getChamadasAliancaFromOpas({ membroId, includeAll }));
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chamadas-alianca/bia/:biaId", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await directusFetchOne("bias_projetos", req.params.biaId, "fields=*");
      if (!bia) return res.status(404).json({ error: "BIA nao encontrada" });
      if (!canViewBia(bia, req)) return res.status(403).json({ error: "Voce nao tem acesso a esta BIA" });
      return res.json(await storage.getChamadasAliancaByBia(req.params.biaId));
    } catch (error: any) {
      if (String(error?.message || "").includes("ECONNREFUSED")) {
        return res.json(await getChamadasAliancaFromOpas({ biaId: req.params.biaId, includeAll: true }));
      }
      res.status(500).json({ error: error.message });
    }
  });

  function googleCalendarUrlForChamada(params: {
    titulo: string;
    dataHora: Date;
    linkReuniao: string;
    biaNome?: string | null;
    escopo?: string | null;
    nucleo?: string | null;
    opaId?: string | null;
  }) {
    const start = Number.isNaN(params.dataHora.getTime()) ? new Date() : params.dataHora;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const opaLink = params.opaId ? `${process.env.APP_URL || "https://app.builtalliances.com"}/opas/${params.opaId}` : null;
    const details = [
      `Chamada para alianca vinculada a BIA ${params.biaNome || "BUILT"}.`,
      params.nucleo ? `Nucleo: ${params.nucleo}.` : null,
      params.escopo ? `Escopo: ${params.escopo}.` : null,
      params.linkReuniao ? `Link da reuniao: ${params.linkReuniao}` : null,
      opaLink ? `OBA: ${opaLink}` : null,
    ].filter(Boolean).join("\n");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(params.titulo)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(params.linkReuniao || "")}`;
  }

  app.get("/api/chamadas-alianca/adicionar-agenda", async (req, res) => {
    const titulo = String(req.query.titulo || "Chamada para alianca");
    const dataHora = new Date(String(req.query.dataHora || ""));
    const linkReuniao = String(req.query.linkReuniao || "");
    const opaId = String(req.query.opaId || "");
    const membroId = String(req.query.membroId || (req.session as any).membroId || "");
    const biaNome = String(req.query.biaNome || "");
    const escopo = String(req.query.escopo || "");
    const nucleo = String(req.query.nucleo || "");
    const googleFromEmail = String(req.query.google || "");
    const googleRedirect = googleFromEmail.startsWith("https://calendar.google.com/")
      ? googleFromEmail
      : googleCalendarUrlForChamada({ titulo, dataHora, linkReuniao, biaNome, escopo, nucleo, opaId });

    try {
      const userIdFromSession = (req.session as any).directusUserId || (req.session as any).userId || null;
      let targetUserId = userIdFromSession ? String(userIdFromSession) : "";
      let targetMembroId = membroId || ((req.session as any).membroId ? String((req.session as any).membroId) : "");

      if (!targetUserId && targetMembroId) {
        const users = await storage.getAllUsers();
        const target = users.find((user: any) => user.ativo && String(user.membro_directus_id || "") === targetMembroId);
        if (target) targetUserId = String(target.id);
      }

      if (targetUserId) {
        const dataBase = Number.isNaN(dataHora.getTime()) ? new Date() : dataHora;
        const origemTarefaId = opaId ? `chamada-alianca-opa-${opaId}` : `chamada-alianca-${targetUserId}-${dataBase.toISOString()}`;
        const existing = await db.execute(sql`
          SELECT id
          FROM agenda_tarefas
          WHERE user_id = ${targetUserId}
            AND origem_tarefa_id = ${origemTarefaId}
          LIMIT 1
        `);

        if (!((existing as any).rows || []).length) {
          await storage.createAgendaTarefa({
            user_id: targetUserId,
            membro_id: targetMembroId || null,
            titulo,
            descricao: [
              `Chamada para alianca vinculada a BIA ${biaNome || "BUILT"}.`,
              nucleo ? `Nucleo: ${nucleo}.` : null,
              escopo ? `Escopo: ${escopo}.` : null,
              linkReuniao ? `Link da reuniao: ${linkReuniao}` : null,
              opaId ? `OBA: ${(process.env.APP_URL || "https://app.builtalliances.com")}/opas/${opaId}` : null,
            ].filter(Boolean).join("\n"),
            data: dataBase.toISOString().slice(0, 10),
            hora: dataBase.toTimeString().slice(0, 5),
            status: "pendente",
            prioridade: "media",
            contexto_tipo: "chamada_alianca",
            contexto_id: opaId || null,
            origem_tarefa_id: origemTarefaId,
            atribuido_por_user_id: null,
            atribuido_por_membro_id: null,
            atribuido_por_nome: "Chamada para alianca",
          } as any);
        }
      }
    } catch (error: any) {
      console.warn("[chamadas-alianca] Nao foi possivel adicionar na agenda da plataforma:", error?.message || error);
    }

    res.redirect(302, googleRedirect);
  });

  app.post("/api/bias/:id/disparar-alianca", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const diretorCampo = String(req.body?.diretor_campo || req.body?.alvo_campo || "");
      const dataHora = new Date(String(req.body?.data_hora || ""));
      let linkReuniao = String(req.body?.link_reuniao || "").trim();
      if (linkReuniao && !/^https?:\/\//i.test(linkReuniao)) linkReuniao = `https://${linkReuniao}`;
      const opaInput = req.body?.opa && typeof req.body.opa === "object" ? req.body.opa : {};
      const diretorConfig = CHAMADA_DIRETOR_CONFIG[diretorCampo] || CHAMADA_PATRIMONIAL_CONFIG[diretorCampo];
      const isPatrimonialTarget = !!CHAMADA_PATRIMONIAL_CONFIG[diretorCampo];
      if (!diretorConfig) return res.status(400).json({ error: "Papel invalido para disparo de alianca" });
      if (Number.isNaN(dataHora.getTime())) return res.status(400).json({ error: "Data da reuniao invalida" });
      if (!/^https?:\/\//i.test(linkReuniao)) return res.status(400).json({ error: "Informe um link de reuniao valido" });

      const authorization = await requireBiaModuleAccess(req, res, req.params.id, "configuracao_bia", "edit");
      if (!authorization) return;
      const bia = authorization.bia;
      const diretorId = isPatrimonialTarget ? null : directusRelationId(bia[diretorCampo]);
      const papelPreenchido = isPatrimonialTarget
        ? parseBiaMemberList(bia[diretorCampo]).length > 0
        : !!diretorId;
      if (papelPreenchido) return res.status(400).json({ error: "Este papel ja possui membro. Dispare a alianca apenas para papeis em aberto." });

      const percentualField = CHAMADA_DIRETOR_PERCENTUAL_FIELDS[diretorCampo];
      const valorBaseDm = Number(getBiaNumericValue(bia, "valor_origem", "valor_geral_venda_vgv", "valor_realizado_venda") || 0);
      const percentualDm = percentualField
        ? Number(String(bia[percentualField] ?? "").replace(",", "."))
        : null;
      const valorDmDiretor = percentualField && Number.isFinite(percentualDm)
        ? valorBaseDm * Number(percentualDm) / 100
        : null;
      if (percentualField && (!valorDmDiretor || valorDmDiretor <= 0)) {
        return res.status(400).json({
          error: `O percentual DM de ${(diretorConfig as any).label || diretorConfig.nucleo} esta zerado. Ajuste a aba DM antes de disparar a chamada.`,
        });
      }

      let chamadasStorageDisponivel = true;
      let existentes: any[] = [];
      try {
        existentes = await storage.getChamadasAliancaByBia(req.params.id);
      } catch (error: any) {
        chamadasStorageDisponivel = false;
        console.warn("[chamadas-alianca] Banco local indisponivel, seguindo sem historico:", error?.message || error);
      }
      const chamadasDoDiretor = existentes.filter((item) => item.diretor_campo === diretorCampo);
      const nextOrder = Math.max(0, ...chamadasDoDiretor.map((item) => Number(item.ordem) || 0)) + 1;
      const etapa = CHAMADA_ALIANCA_SEQUENCE.find((item) => item.ordem === nextOrder);
      if (!etapa) return res.status(400).json({ error: "Ciclo de chamadas concluido para este diretor" });

      const audience = await getChamadaAudience({
        bia,
        biaId: req.params.id,
        diretorId,
        nucleo: diretorConfig.nucleo,
        escopo: etapa.escopo,
        filtrarNucleo: !isPatrimonialTarget,
      });

      const tituloOpa = String(opaInput.nome_oportunidade || "").trim() || CHAMADA_ALIANCA_TITULO_OPA;
      const tipoOpa = percentualField ? "LideranÃ§a" : (String(opaInput.tipo || "").trim() || diretorConfig.tipo);
      const valorOpaInput = Number(String(opaInput.valor_origem_opa ?? "").replace(/\./g, "").replace(",", "."));
      const valorOpaFinal = percentualField
        ? Number(valorDmDiretor)
        : (Number.isFinite(valorOpaInput) && valorOpaInput > 0 ? valorOpaInput : valorBaseDm);
      const memInput = Number(String(opaInput.Minimo_esforco_multiplicador ?? "").replace(",", "."));
      const descricaoEditada = String(opaInput.descricao || "").trim();
      const descricao = [
        `${etapa.label} da BIA ${bia.nome_bia || req.params.id}.`,
        `Area: LideranÃ§a.`,
        `Nucleo acionado: ${diretorConfig.nucleo}.`,
        `Papel em aberto: ${(diretorConfig as any).label || diretorConfig.nucleo}.`,
        `Data da reuniao: ${dataHora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`,
        `Link da reuniao: ${linkReuniao}`,
      ].join("\n");
      const descricaoFinal = descricaoEditada ? `${descricaoEditada}\n\n${descricao}` : descricao;

      await ensureOpaMediaFields();
      const opa = await directusCreate("tipos_oportunidades", prepareOpaPayload({
        nome_oportunidade: tituloOpa,
        tipo: tipoOpa,
        status: "ativa",
        bia: req.params.id,
        valor_origem_opa: valorOpaFinal,
        Minimo_esforco_multiplicador: Number.isFinite(memInput) && memInput > 0 ? memInput : 100,
        nucleo_alianca: diretorConfig.nucleo,
        descricao: descricaoFinal,
        perfil_aliado: "Convite para papel em aberto",
        localizacao: bia.localizacao || null,
        latitude: bia.latitude || null,
        longitude: bia.longitude || null,
      }));

      const chamadaPayload = {
        bia_id: req.params.id,
        bia_nome: bia.nome_bia || null,
        diretor_campo: diretorCampo,
        diretor_membro_id: null,
        diretor_nome: null,
        nucleo_alianca: diretorConfig.nucleo,
        ordem: etapa.ordem,
        escopo: etapa.escopo,
        titulo: etapa.label,
        data_hora: dataHora,
        link_reuniao: linkReuniao,
        opa_id: opa.id || null,
        destinatarios: audience.destinatarios,
        status: "pendente",
        criado_por_user_id: (req.session as any).directusUserId || null,
        criado_por_membro_id: (req.session as any).membroId || null,
        criado_por_nome: (req.session as any).nome || null,
      } as any;
      let chamada = { id: null, ...chamadaPayload };
      if (chamadasStorageDisponivel) {
        try {
          chamada = await storage.createChamadaAlianca(chamadaPayload);
        } catch (error: any) {
          chamadasStorageDisponivel = false;
          console.warn("[chamadas-alianca] OBA criada, mas registro local falhou:", error?.message || error);
        }
      }

      const { enviarChamadaAlianca } = await import("./mailer");
      for (const destinatario of audience.destinatarios) {
        enviarChamadaAlianca({
          destinatarioEmail: destinatario.email,
          destinatarioNome: destinatario.nome,
          destinatarioMembroId: destinatario.id,
          titulo: tituloOpa,
          biaNome: bia.nome_bia || null,
          escopo: etapa.label,
          dataHora,
          linkReuniao,
          nucleo: diretorConfig.nucleo,
          opaId: opa?.id || null,
        }).catch((e: any) => console.error("[chamadas-alianca] email error:", e.message));
      }

      res.json({
        chamada,
        opa,
        destinatarios_count: audience.destinatarios.length,
        proxima_ordem: nextOrder + 1,
        registro_local_salvo: chamadasStorageDisponivel,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function normalizePdfText(value: any): string {
    let text = String(value ?? "");
    const cp1252Fallback: Record<number, number> = {
      0x0192: 0x83,
      0x201A: 0x82,
      0x201E: 0x84,
      0x2026: 0x85,
      0x2020: 0x86,
      0x2021: 0x87,
      0x02C6: 0x88,
      0x2030: 0x89,
      0x0160: 0x8A,
      0x2039: 0x8B,
      0x0152: 0x8C,
      0x017D: 0x8E,
      0x2018: 0x91,
      0x2019: 0x92,
      0x201C: 0x93,
      0x201D: 0x94,
      0x2022: 0x95,
      0x2013: 0x96,
      0x2014: 0x97,
      0x02DC: 0x98,
      0x2122: 0x99,
      0x0161: 0x9A,
      0x203A: 0x9B,
      0x0153: 0x9C,
      0x017E: 0x9E,
      0x0178: 0x9F,
    };
    for (let attempt = 0; attempt < 3 && /[ÃÂâ]/.test(text); attempt++) {
      const bytes: number[] = [];
      let canDecode = true;
      for (const char of text) {
        const code = char.charCodeAt(0);
        const byte = code <= 0xFF ? code : cp1252Fallback[code];
        if (byte === undefined) {
          canDecode = false;
          break;
        }
        bytes.push(byte);
      }
      if (!canDecode) break;
      const decoded = Buffer.from(bytes).toString("utf8");
      if (!decoded || decoded === text || decoded.includes("�")) break;
      text = decoded;
    }
    const mojibakeReplacements: Record<string, string> = {
      "\u00C3\u0192": "Ã",
      "\u00C3\u00A0": "à",
      "\u00C3\u00A1": "á",
      "\u00C3\u00A2": "â",
      "\u00C3\u00A3": "ã",
      "\u00C3\u00A7": "ç",
      "\u00C3\u00A8": "è",
      "\u00C3\u00A9": "é",
      "\u00C3\u00AA": "ê",
      "\u00C3\u00AD": "í",
      "\u00C3\u00B3": "ó",
      "\u00C3\u00B4": "ô",
      "\u00C3\u00B5": "õ",
      "\u00C3\u00BA": "ú",
      "\u00C3\u00BC": "ü",
      "\u00C3\u0080": "À",
      "\u00C3\u0081": "Á",
      "\u00C3\u0082": "Â",
      "\u00C3\u0083": "Ã",
      "\u00C3\u0087": "Ç",
      "\u00C3\u0089": "É",
      "\u00C3\u2030": "É",
      "\u00C3\u008A": "Ê",
      "\u00C3\u0093": "Ó",
      "\u00C3\u0094": "Ô",
      "\u00C3\u0095": "Õ",
      "\u00C3\u009A": "Ú",
      "\u00C2\u00BA": "º",
      "\u00C2\u00AA": "ª",
      "\u00E2\u20AC\u201C": "-",
      "\u00E2\u20AC\u201D": "-",
      "\u00E2\u20AC\u0153": '"',
      "\u00E2\u20AC\u009D": '"',
      "\u00E2\u20AC\u02DC": "'",
      "\u00E2\u20AC\u2122": "'",
    };
    for (const [broken, replacement] of Object.entries(mojibakeReplacements)) {
      text = text.split(broken).join(replacement);
    }
    return text
      .replace(/BIAm\?-f\?BUILT/g, "BIA - BUILT")
      .replace(/\bBIA\s*-BUILT\b/g, "BIA - BUILT")
      .replace(/\ba tua ndo\b/g, "atuando")
      .replace(/\bsocietári a\b/g, "societária")
      .replace(/\bpoder á\b/g, "poderá")
      .replace(/\bassegura ndo\b/g, "assegurando")
      .replace(/\bmai s\b/g, "mais")
      .replace(/\bParce iros\b/g, "Parceiros")
      .replace(/\bobrigam -se\b/g, "obrigam-se")
      .replace(/BUILT,sendo/g, "BUILT, sendo")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
  }

  function pdfHex(value: string): string {
    return `<${Buffer.from(normalizePdfText(value), "latin1").toString("hex").toUpperCase()}>`;
  }

  function wrapPdfLine(line: string, maxChars = 96): string[] {
    const clean = normalizePdfText(line).replace(/\s+/g, " ").trim();
    if (!clean) return [""];
    const words = clean.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function splitPdfParagraphs(body: string): string[] {
    const normalized = normalizePdfText(body).replace(/\r\n?/g, "\n");
    const paragraphs: string[] = [];
    const flush = (buffer: string[]) => {
      const value = buffer.join(" ").replace(/\s+/g, " ").trim();
      if (value) {
        for (const part of value.split(/\s+(?=\d+(?:\.\d+)+\.\s+)/).map((item) => item.trim()).filter(Boolean)) {
          paragraphs.push(part);
        }
      }
      buffer.length = 0;
    };

    for (const block of normalized.split(/\n{2,}/)) {
      const buffer: string[] = [];
      for (const line of block.split("\n").map((item) => item.trim()).filter(Boolean)) {
        const isEmentaHeading = /^EMENTA:?$/i.test(line);
        const isStandaloneMouHeading = /^(MEMORANDO DE ENTENDIMENTOS|ALIANÇA PATRIMONIAL PADRÃO BUILT)$/i.test(line);
        const isHeading = line.length < 90
          && (
            isEmentaHeading
            || isStandaloneMouHeading
            || /^[0-9]+(?:\.[0-9]+)*\.\s+/.test(line)
            || /^[A-Z0-9 .IVX-]+$/.test(line.toUpperCase())
          )
          && (isEmentaHeading || !/[,:;]/.test(line));
        const isNumberedClauseStart = /^\d+(?:\.\d+)+\.\s+/.test(line);

        if (isHeading) {
          flush(buffer);
          paragraphs.push(line);
        } else if (isNumberedClauseStart) {
          flush(buffer);
          buffer.push(line);
        } else {
          buffer.push(line);
        }
      }
      flush(buffer);
    }

    return paragraphs;
  }

  function emphasizeMouPdfText(value: string): string {
    let output = value;
    const protect = (text: string) => text.includes("**") ? text : `**${text}**`;
    const replacements: Array<[RegExp, (...args: string[]) => string]> = [
      [/^MEMORANDO DE ENTENDIMENTOS \(MOU\)$/i, (match) => protect(match)],
      [/^ALIANÇA PATRIMONIAL PADRÃO BUILT$/i, (match) => protect(match)],
      [/^EMENTA:$/i, (match) => protect(match)],
      [/^(\d+(?:\.\d+)*\.\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .IVX-]+)$/i, (_match, number, heading) => `${number}${protect(heading)}`],
      [/O presente MEMORANDO DE ENTENDIMENTOS \("MOU"\)/g, (match) => protect(match)],
      [/\bnatureza pré-contratual\b/g, (match) => protect(match)],
      [/\bdiretrizes, compromissos mínimos vinculantes, deveres de conduta, regras de governança, matriz de participação econômica e parâmetros de responsabilidade\b/g, (match) => protect(match)],
      [/\borganização, estruturação e exploração econômica de ativo imobiliário\b/g, (match) => protect(match)],
      [/\bA exploração econômica será destinada ao objetivo da aliança:/g, (match) => protect(match)],
      [/\bAs partes reconhecem\b/g, (match) => protect(match)],
      [/\bPlataforma BUILT - Builders United for Investment Logistics and Trade\b/g, (match) => protect(match)],
      [/\bBIA - BUILT Integrated Alliance - BIA\b/g, (match) => protect(match)],
    ];
    for (const [pattern, replacement] of replacements) {
      output = output.replace(pattern, replacement);
    }
    return output;
  }

  function buildBiaFooterLabel(bia: any, biaId: string): string {
    return buildBiaMouRodapeTexto(bia, biaId);
  }

  function buildSimpleTextPdf(
    title: string,
    sections: Array<{ title: string; body: string }>,
    options: { headerLabel?: string; footerLabel?: string } = {}
  ): Buffer {
    const pages: string[][] = [];
    let ops: string[] = [];
    let y = 0;
    const navy = "0.000 0.114 0.204";
    const blue = "0.146 0.388 0.922";
    const gold = "0.843 0.733 0.490";
    const slate = "0.220 0.290 0.360";
    const logoImage = loadMouLogoForPdf();
    const footerOfficialImage = loadMouAssetPngForPdf("built-official-document.png");
    const footerCertifiedImage = loadMouAssetPngForPdf("built-certified-alliance.png");
    const footerLimit = options.footerLabel ? 104 : 54;

    const text = (value: string, x: number, yy: number, size = 10, font = "F1", color = "0 0 0") => {
      ops.push(`BT /${font} ${size} Tf ${color} rg ${x} ${yy} Td ${pdfHex(value)} Tj ET`);
    };
    const helveticaWidths: Record<string, number> = {
      " ": 278,
      "/": 278,
      "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
      "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
      A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778,
      H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722,
      O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722,
      V: 667, W: 944, X: 667, Y: 667, Z: 611,
      a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556,
      h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
      o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556,
      v: 500, w: 722, x: 500, y: 500, z: 500,
      ",": 278, ".": 278, ":": 278, ";": 278, "-": 333, "(": 333, ")": 333,
    };
    const helveticaBoldWidths: Record<string, number> = {
      ...helveticaWidths,
      A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778,
      H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722,
      O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722,
      V: 667, W: 944, X: 667, Y: 667, Z: 611,
      a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611,
      h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611,
      o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611,
      v: 556, w: 778, x: 556, y: 556, z: 500,
      ",": 278, ".": 278, ":": 333, ";": 333, "-": 333, "(": 333, ")": 333,
    };
    const estimateTextWidth = (value: string, size = 10, font = "F1") => {
      const widths = font === "F2" ? helveticaBoldWidths : helveticaWidths;
      return Array.from(value).reduce((total, char) => total + (widths[char] ?? 556), 0) * size / 1000;
    };
    const wrapPdfLineByWidth = (line: string, maxWidth: number, size = 10, font = "F1"): string[] => {
      const clean = normalizePdfText(line).replace(/\s+/g, " ").trim();
      if (!clean) return [""];
      const words = clean.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && estimateTextWidth(candidate, size, font) > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
      return lines;
    };
    type PdfInlineRun = { text: string; bold: boolean };
    const parsePdfInlineRuns = (value: string): PdfInlineRun[] => {
      const normalized = normalizePdfText(value).replace(/\s+/g, " ").trim();
      if (!normalized) return [];
      const runs: PdfInlineRun[] = [];
      const pattern = /\*\*([\s\S]*?)\*\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalized))) {
        if (match.index > lastIndex) {
          runs.push({ text: normalized.slice(lastIndex, match.index), bold: false });
        }
        if (match[1]) {
          runs.push({ text: match[1], bold: true });
        }
        lastIndex = pattern.lastIndex;
      }
      if (lastIndex < normalized.length) {
        runs.push({ text: normalized.slice(lastIndex), bold: false });
      }
      return runs.filter((run) => run.text.length > 0);
    };
    const wrapPdfInlineRuns = (
      runs: PdfInlineRun[],
      size: number,
      baseFont: string,
      maxWidth: number
    ): PdfInlineRun[][] => {
      const lines: PdfInlineRun[][] = [];
      let current: PdfInlineRun[] = [];
      let currentWidth = 0;
      const compactRuns = (items: PdfInlineRun[]): PdfInlineRun[] => {
        const compacted: PdfInlineRun[] = [];
        for (const item of items) {
          if (!item.text) continue;
          const previous = compacted[compacted.length - 1];
          if (previous && previous.bold === item.bold) {
            previous.text += item.text;
          } else {
            compacted.push({ ...item });
          }
        }
        return compacted;
      };
      const pushCurrent = () => {
        while (current[0]?.text.trim() === "") current.shift();
        while (current[current.length - 1]?.text.trim() === "") current.pop();
        if (current.length) lines.push(compactRuns(current));
        current = [];
        currentWidth = 0;
      };
      for (const run of runs) {
        const tokens = run.text.split(/(\s+)/).filter(Boolean);
        for (const token of tokens) {
          const leadingWhitespace = /^\s+$/.test(token);
          if (leadingWhitespace && current.length === 0) continue;
          const tokenText = leadingWhitespace ? " " : token;
          const font = run.bold ? "F2" : baseFont;
          const tokenWidth = estimateTextWidth(tokenText, size, font);
          if (!leadingWhitespace && current.length && currentWidth + tokenWidth > maxWidth) {
            pushCurrent();
          }
          current.push({ text: tokenText, bold: run.bold });
          currentWidth += tokenWidth;
        }
      }
      pushCurrent();
      return lines.length ? lines : [[{ text: "", bold: false }]];
    };
    const textRight = (value: string, rightX: number, yy: number, size = 10, font = "F1", color = "0 0 0") => {
      text(value, rightX - estimateTextWidth(value, size, font), yy, size, font, color);
    };
    const textCenter = (value: string, centerX: number, yy: number, size = 10, font = "F1", color = "0 0 0") => {
      text(value, centerX - estimateTextWidth(value, size, font) / 2, yy, size, font, color);
    };
    const rect = (x: number, yy: number, w: number, h: number, color: string) => {
      ops.push(`q ${color} rg ${x} ${yy} ${w} ${h} re f Q`);
    };
    const roundedRect = (
      x: number,
      yy: number,
      w: number,
      h: number,
      radius: number,
      fillColor: string,
      strokeColor?: string,
      strokeWidth = 0.7
    ) => {
      const r = Math.min(radius, w / 2, h / 2);
      const c = r * 0.5522847498;
      const x0 = x;
      const x1 = x + w;
      const y0 = yy;
      const y1 = yy + h;
      const path = [
        `${x0 + r} ${y0} m`,
        `${x1 - r} ${y0} l`,
        `${x1 - r + c} ${y0} ${x1} ${y0 + r - c} ${x1} ${y0 + r} c`,
        `${x1} ${y1 - r} l`,
        `${x1} ${y1 - r + c} ${x1 - r + c} ${y1} ${x1 - r} ${y1} c`,
        `${x0 + r} ${y1} l`,
        `${x0 + r - c} ${y1} ${x0} ${y1 - r + c} ${x0} ${y1 - r} c`,
        `${x0} ${y0 + r} l`,
        `${x0} ${y0 + r - c} ${x0 + r - c} ${y0} ${x0 + r} ${y0} c`,
      ].join(" ");
      if (strokeColor) {
        ops.push(`q ${fillColor} rg ${strokeColor} RG ${strokeWidth} w ${path} B Q`);
      } else {
        ops.push(`q ${fillColor} rg ${path} f Q`);
      }
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color = "0.85 0.85 0.85", width = 0.7) => {
      ops.push(`q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
    };
    const newPage = () => {
      if (ops.length) pages.push(ops);
      ops = [];
      rect(0, 768, 595, 74, "1 1 1");
      if (logoImage) {
        const logoWidth = 252;
        const logoHeight = logoWidth * (logoImage.height / logoImage.width);
        ops.push(`q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} 64 780 cm /Logo Do Q`);
      } else {
        text("BUILT", 46, 796, 32, "F2", navy);
        text("Builders United for Investment, Logistics and Trade", 48, 780, 8, "F1", slate);
      }
      const headerRight = 505;
      textRight(options.headerLabel || "MOU PADRÃO BUILT", headerRight, 804, 11, "F2", navy);
      textRight(new Date().toLocaleDateString("pt-BR"), headerRight, 788, 8, "F1", "0 0 0");
      rect(0, 764, 595, 3, gold);
      if (options.footerLabel) {
        line(42, 94, 553, 94, "0.86 0.78 0.62", 0.7);
        const footerSealSize = 50;
        const footerSealY = 31;
        if (footerOfficialImage) {
          ops.push(`q ${footerSealSize} 0 0 ${footerSealSize} 78 ${footerSealY} cm /OfficialSeal Do Q`);
        }
        if (footerCertifiedImage) {
          ops.push(`q ${footerSealSize} 0 0 ${footerSealSize} 144 ${footerSealY} cm /CertifiedSeal Do Q`);
        }
        const footerFontSize = 6.7;
        const footerLines = wrapPdfLineByWidth(options.footerLabel, 318, footerFontSize, "F1").slice(0, 4);
        footerLines.forEach((lineText, index) => {
          text(lineText, 210, 72 - index * 9, footerFontSize, "F1", navy);
        });
      }
      y = 730;
    };
    const ensure = (height: number) => {
      if (y - height < footerLimit) newPage();
    };
    const paragraph = (value: string, options: { size?: number; font?: string; color?: string; width?: number; gap?: number; indent?: number } = {}) => {
      const size = options.size || 9.5;
      const gap = options.gap ?? 13;
      const indent = options.indent || 0;
      const baseFont = options.font || "F1";
      const runs = parsePdfInlineRuns(emphasizeMouPdfText(value));
      const maxWidth = (options.width || 102) * size * 0.53;
      const lines = wrapPdfInlineRuns(runs, size, baseFont, maxWidth);
      ensure(lines.length * gap + 8);
      for (const wrappedRuns of lines) {
        let x = 48 + indent;
        for (let index = 0; index < wrappedRuns.length; index++) {
          const run = wrappedRuns[index];
          const font = run.bold ? "F2" : baseFont;
          text(run.text, x, y, size, font, options.color || "0.05 0.10 0.16");
          const nextRun = wrappedRuns[index + 1];
          const transitionGap = nextRun && nextRun.bold !== run.bold ? size * 0.12 : 0;
          x += estimateTextWidth(run.text, size, font) + transitionGap;
        }
        y -= gap;
      }
      y -= 4;
    };
    const sectionTitle = (value: string) => {
      if (y < 128) newPage();
      y -= 12;
      ensure(58);
      rect(42, y - 8, 511, 28, "0.945 0.970 1.000");
      rect(42, y - 8, 4, 28, blue);
      text(value, 58, y, 12, "F2", navy);
      y -= 42;
    };
    const infoBox = (lines: string[]) => {
      const boxHeight = Math.max(56, lines.length * 16 + 24);
      ensure(boxHeight + 12);
      rect(42, y - boxHeight + 10, 511, boxHeight, "0.985 0.988 0.992");
      line(42, y + 10, 553, y + 10, "0.72 0.82 0.94");
      line(42, y - boxHeight + 10, 553, y - boxHeight + 10, "0.72 0.82 0.94");
      let rowY = y - 10;
      for (const item of lines) {
        text(item, 58, rowY, 9.5, "F1", slate);
        rowY -= 16;
      }
      y -= boxHeight + 10;
    };
    const allocationTable = (lines: string[]) => {
      const rows = lines
        .filter((item) => item.includes(":") && item.includes(" - "))
        .map((item) => {
          const separator = item.indexOf(":");
          const label = item.slice(0, separator).trim();
          const rest = item.slice(separator + 1);
          const [percent, value] = rest.split(" - ");
          const roleSeparator = label.indexOf(" - ");
          return {
            group: roleSeparator >= 0 ? label.slice(0, roleSeparator).trim() : "Participantes",
            name: roleSeparator >= 0 ? label.slice(roleSeparator + 3).trim() : label,
            percent: (percent || "").trim(),
            value: (value || "").trim(),
            percentNumber: Number(String(percent || "").replace("%", "").replace(/\./g, "").replace(",", ".")),
          };
        });
      if (!rows.length) return;
      const groupOrder = ["Sócios Guardiões", "SÃ³cios GuardiÃµes", "Sócios Multiplicadores", "SÃ³cios Multiplicadores", "Não classificados", "NÃ£o classificados"];
      const groups = Array.from(rows.reduce((acc, row) => {
        if (!acc.has(row.group)) acc.set(row.group, []);
        acc.get(row.group)!.push(row);
        return acc;
      }, new Map<string, typeof rows>()).entries()).sort(([a], [b]) => {
        const ai = groupOrder.indexOf(a);
        const bi = groupOrder.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      const totalHeight = groups.reduce((sum, [, groupRows]) => sum + 34 + groupRows.length * 47, 28);
      ensure(totalHeight + 22);
      const cardX = 42;
      const cardW = 511;
      const cardBottomY = y - totalHeight + 14;
      roundedRect(cardX, y - totalHeight + 14, cardW, totalHeight, 8, "1 1 1", "0.86 0.78 0.62", 0.55);
      let rowY = y - 18;
      for (const [group, groupRows] of groups) {
        const groupLabel = group.replace("SÃ³cios", "Sócios").replace("GuardiÃµes", "Guardiões").replace("NÃ£o", "Não").toUpperCase();
        const countFill = groupLabel.includes("MULTIPLICADORES") ? "0.88 0.98 0.93" : "0.90 0.95 1.00";
        const countColor = groupLabel.includes("MULTIPLICADORES") ? "0.08 0.58 0.30" : blue;
        text(groupLabel, 58, rowY, 8.4, "F2", "0.38 0.46 0.54");
        const countX = Math.min(250, 58 + estimateTextWidth(groupLabel, 8.4, "F2") + 10);
        roundedRect(countX, rowY - 7, 17, 12, 6, countFill, "0.82 0.88 0.96", 0.35);
        textCenter(String(groupRows.length), countX + 8.5, rowY - 3, 7, "F2", countColor);
        rowY -= 25;
        for (const row of groupRows) {
          const percentNumber = Number.isFinite(row.percentNumber) ? Math.max(0, Math.min(100, row.percentNumber)) : 0;
          const barX = 58;
          const barY = rowY - 20;
          const barW = 478;
          const barH = 6;
          const fillW = barW * (percentNumber / 100);
          const valueRightX = 496;
          const pillX = 505;
          const pillW = 38;
          const name = row.name.length > 42 ? `${row.name.slice(0, 39)}...` : row.name;
          text(name, 74, rowY, 9.2, "F2", navy);
          text("○", 58, rowY - 0.5, 8.5, "F1", "0.45 0.52 0.60");
          textRight(row.value, valueRightX, rowY, 8.6, "F1", slate);
          roundedRect(pillX, rowY - 8, pillW, 16, 5, "0.90 0.95 1.00", "0.82 0.88 0.96", 0.35);
          textCenter(row.percent, pillX + pillW / 2, rowY - 3.6, 7.8, "F2", blue);
          roundedRect(barX, barY, barW, barH, 3, "0.95 0.96 0.98");
          if (fillW > 0) roundedRect(barX, barY, Math.max(fillW, 3), barH, 3, "0.23 0.51 0.93");
          rowY -= 42;
        }
        rowY -= 5;
      }
      y = Math.min(rowY - 8, cardBottomY - 18);
    };

    newPage();
    text(title, 48, y, 18, "F2", navy);
    y -= 18;
    line(48, y, 548, y, "0.72 0.82 0.94", 1);
    y -= 28;

    for (const [sectionIndex, section] of sections.entries()) {
      if (sectionIndex > 0) newPage();
      sectionTitle(section.title);
      const rawParagraphs = normalizePdfText(section.body).split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const paragraphs = splitPdfParagraphs(section.body);
      const normalizedSectionTitle = normalizePdfText(section.title);
      if (normalizedSectionTitle.includes("Mapa de Aloca\u00E7\u00E3o") || normalizedSectionTitle.includes("Mapa de Alocacao")) {
        const tableStart = rawParagraphs.findIndex((item) => item.includes("Aloca\u00E7\u00E3o") || item.includes("Alocacao"));
        const intro = tableStart >= 0 ? rawParagraphs.slice(0, tableStart) : rawParagraphs.slice(0, 5);
        infoBox(intro);
        allocationTable(rawParagraphs);
        const last = rawParagraphs[rawParagraphs.length - 1];
        if (last && last.includes("Este mapa")) paragraph(last, { color: slate, width: 96 });
        y -= 18;
        continue;
      }
      for (const item of paragraphs) {
        const normalizedItem = normalizePdfText(item);
        const isAllCapsHeading = item.length < 70 && /^[A-Z0-9 .IVX-]+$/.test(normalizedItem.toUpperCase()) && !item.includes(".");
        const isNumberedHeading = /^\d+(?:\.\d+)*\.\s+/.test(normalizedItem)
          && normalizedItem.length < 95
          && !/[,:;]/.test(normalizedItem)
          && !/\b(é|são|será|serão|deverá|deverão|poderá|poderão|constitui|representa|reconhecem|tem|têm)\b/i.test(normalizedItem);
        const isSubheading = isAllCapsHeading || isNumberedHeading;
        if (isSubheading) {
          ensure(34);
          y -= 8;
        }
        paragraph(item, {
          font: isSubheading ? "F2" : "F1",
          color: isSubheading ? navy : "0.05 0.10 0.16",
          size: isSubheading ? 10.5 : 9.2,
          gap: isSubheading ? 16 : undefined,
          width: 98,
        });
        if (isSubheading) y -= 4;
      }
      y -= 14;
    }
    if (ops.length) pages.push(ops);
    const totalPages = pages.length;
    pages.forEach((pageOps, index) => {
      const pageLabel = `Página ${index + 1} de ${totalPages}`;
      const pageLabelSize = 7.2;
      const pageLabelX = 553 - estimateTextWidth(pageLabel, pageLabelSize, "F1");
      pageOps.push(`BT /F1 ${pageLabelSize} Tf ${slate} rg ${pageLabelX.toFixed(2)} 22 Td ${pdfHex(pageLabel)} Tj ET`);
    });

    const objects: string[] = [];
    const addObject = (content: string) => {
      objects.push(content);
      return objects.length;
    };
    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("");
    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    let logoObjectId: number | null = null;
    if (logoImage) {
      const alphaStream = logoImage.alpha.toString("latin1");
      const alphaId = addObject(`<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logoImage.alpha.length} >>\nstream\n${alphaStream}\nendstream`);
      const rgbStream = logoImage.rgb.toString("latin1");
      logoObjectId = addObject(`<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${alphaId} 0 R /Length ${logoImage.rgb.length} >>\nstream\n${rgbStream}\nendstream`);
    }
    const addPngImageObject = (image: ReturnType<typeof loadMouAssetPngForPdf>) => {
      if (!image) return null;
      const alphaStream = image.alpha.toString("latin1");
      const alphaId = addObject(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.alpha.length} >>\nstream\n${alphaStream}\nendstream`);
      const rgbStream = image.rgb.toString("latin1");
      return addObject(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${alphaId} 0 R /Length ${image.rgb.length} >>\nstream\n${rgbStream}\nendstream`);
    };
    const officialSealObjectId = addPngImageObject(footerOfficialImage);
    const certifiedSealObjectId = addPngImageObject(footerCertifiedImage);
    const pageIds: number[] = [];
    const contentIds: number[] = [];

    pages.forEach((pageOps) => {
      const stream = pageOps.join("\n");
      const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      const xObjects = [
        logoObjectId ? `/Logo ${logoObjectId} 0 R` : "",
        officialSealObjectId ? `/OfficialSeal ${officialSealObjectId} 0 R` : "",
        certifiedSealObjectId ? `/CertifiedSeal ${certifiedSealObjectId} 0 R` : "",
      ].filter(Boolean).join(" ");
      const xObjectResources = xObjects ? ` /XObject << ${xObjects} >>` : "";
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >>${xObjectResources} >> /Contents ${contentId} 0 R >>`);
      contentIds.push(contentId);
      pageIds.push(pageId);
    });
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    void catalogId;
    void contentIds;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "latin1");
  }

  function readMouAsset(name: string): string {
    const candidates = [
      path.resolve(process.cwd(), "server", "assets", "mou-padrao", name),
      path.resolve(process.cwd(), "dist", "server", "assets", "mou-padrao", name),
      path.resolve(process.cwd(), "dist", "assets", "mou-padrao", name),
      path.resolve(ROUTES_DIR, "server", "assets", "mou-padrao", name),
      path.resolve(ROUTES_DIR, "assets", "mou-padrao", name),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    return found ? normalizePdfText(fs.readFileSync(found, "utf8")) : "";
  }

  function readTermAsset(name: string): string {
    const candidates = [
      path.resolve(process.cwd(), "server", "assets", "termos", name),
      path.resolve(process.cwd(), "dist", "server", "assets", "termos", name),
      path.resolve(process.cwd(), "dist", "assets", "termos", name),
      path.resolve(ROUTES_DIR, "server", "assets", "termos", name),
      path.resolve(ROUTES_DIR, "assets", "termos", name),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    return found ? fs.readFileSync(found, "utf8").trim() : "";
  }

  function loadMouAssetPngForPdf(name: string) {
    const candidates = [
      path.resolve(process.cwd(), "server", "assets", "mou-padrao", name),
      path.resolve(process.cwd(), "dist", "server", "assets", "mou-padrao", name),
      path.resolve(process.cwd(), "dist", "assets", "mou-padrao", name),
      path.resolve(ROUTES_DIR, "server", "assets", "mou-padrao", name),
      path.resolve(ROUTES_DIR, "assets", "mou-padrao", name),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) return null;
    const png = PNG.sync.read(fs.readFileSync(found));
    const rgb = Buffer.alloc(png.width * png.height * 3);
    const alpha = Buffer.alloc(png.width * png.height);
    for (let i = 0, p = 0, a = 0; i < png.data.length; i += 4, p += 3, a += 1) {
      rgb[p] = png.data[i];
      rgb[p + 1] = png.data[i + 1];
      rgb[p + 2] = png.data[i + 2];
      alpha[a] = png.data[i + 3];
    }
    return { width: png.width, height: png.height, rgb: deflateSync(rgb), alpha: deflateSync(alpha) };
  }

  function loadMouLogoForPdf() {
    return loadMouAssetPngForPdf("logo-built-horizontal-colorida.png")
      || loadMouAssetPngForPdf("logo-built-horizontal-negativo.png");
  }

  async function uploadPdfToDirectus(buffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "application/pdf" });
    formData.append("file", blob, filename);
    const directusRes = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: formData,
    });
    if (!directusRes.ok) {
      const errText = await directusRes.text();
      throw new Error(`Erro ao enviar PDF ao Directus: ${directusRes.status} - ${errText}`);
    }
    const json = await directusRes.json();
    return json.data.id;
  }

  function formatPdfMoney(value: any, currency = "BRL"): string {
    const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  }

  function formatPdfPercent(value: any): string {
    const n = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(n)) return "-";
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}%`;
  }

  function parsePdfNumber(value: any): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const normalized = text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function mergeContractData(member: any, aceite: any): Record<string, any> {
    const dados = aceite?.dados_contratuais && typeof aceite.dados_contratuais === "object" ? aceite.dados_contratuais : {};
    const fallback: Record<string, any> = {
      nome_completo: member?.nome || member?.Nome_de_usuario,
      email: member?.email,
      telefone: member?.telefone || member?.whatsapp,
      cpf: member?.cpf || member?.CPF,
      nacionalidade: member?.nacionalidade,
      nome_mae: member?.nome_mae,
      nome_pai: member?.nome_pai,
      data_nascimento: member?.data_nascimento,
      profissao: member?.profissao || member?.cargo,
      rg: member?.rg,
      estado_civil: member?.estado_civil,
      regime_comunhao: member?.regime_comunhao,
      cep: member?.cep,
      endereco: member?.endereco || [member?.cidade, member?.estado, member?.pais].filter(Boolean).join(", "),
      numero: member?.numero,
      complemento: member?.complemento,
      bairro: member?.bairro,
      cidade: member?.cidade,
      estado: member?.estado,
      pais: member?.pais,
      titular_cep: member?.titular_cep,
      titular_endereco: member?.titular_endereco,
      titular_numero: member?.titular_numero,
      titular_complemento: member?.titular_complemento,
      titular_bairro: member?.titular_bairro,
      titular_cidade: member?.titular_cidade,
      titular_estado: member?.titular_estado,
      titular_pais: member?.titular_pais,
      conjuge_nome_completo: member?.conjuge_nome_completo,
      conjuge_nacionalidade: member?.conjuge_nacionalidade,
      conjuge_nome_mae: member?.conjuge_nome_mae,
      conjuge_nome_pai: member?.conjuge_nome_pai,
      conjuge_data_nascimento: member?.conjuge_data_nascimento,
      conjuge_profissao: member?.conjuge_profissao,
      conjuge_email: member?.conjuge_email,
      conjuge_telefone: member?.conjuge_telefone,
      conjuge_cpf: member?.conjuge_cpf,
      conjuge_rg: member?.conjuge_rg,
      mesmo_endereco_conjuge: member?.mesmo_endereco_conjuge,
      conjuge_cep: member?.conjuge_cep,
      conjuge_endereco: member?.conjuge_endereco,
      conjuge_numero: member?.conjuge_numero,
      conjuge_complemento: member?.conjuge_complemento,
      conjuge_bairro: member?.conjuge_bairro,
      conjuge_cidade: member?.conjuge_cidade,
      conjuge_estado: member?.conjuge_estado,
      conjuge_pais: member?.conjuge_pais,
    };
    const compact = (source: Record<string, any>) =>
      Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      );
    const merged = { ...compact(dados) };
    for (const [key, value] of Object.entries(fallback)) {
      if (value !== null && value !== undefined) merged[key] = value;
    }
    return merged;
  }

  function qualificacaoParte(participant: { roles: string[]; member: any; data: Record<string, any> }): string {
    const d = participant.data;
    const formatEndereco = (source: Record<string, any>, prefix = "") => {
      const key = (field: string) => prefix ? `${prefix}_${field}` : field;
      const linha = [
        source[key("endereco")],
        source[key("numero")] ? `nº ${source[key("numero")]}` : "",
        source[key("complemento")],
      ].filter(Boolean).join(", ");
      return [
        linha,
        source[key("bairro")],
        source[key("cidade")],
        source[key("estado")],
        source[key("pais")],
        source[key("cep")] ? `CEP ${source[key("cep")]}` : "",
      ].filter(Boolean).join(", ");
    };
    const usaEnderecoSeparado = String(d.mesmo_endereco) === "false" || String(d.mesmo_endereco_conjuge) === "false";
    const endereco = (usaEnderecoSeparado ? formatEndereco(d, "titular") : formatEndereco(d)) || "endereço não informado";
    const estadoCivil = mouValue(d.estado_civil);
    const regime = d.regime_comunhao ? ` sob o regime de ${d.regime_comunhao}` : "";
    const conjuge = d.conjuge_nome_completo
      ? ` Casado(a) com ${d.conjuge_nome_completo}, ${mouValue(d.conjuge_nacionalidade)}, filho(a) de ${mouValue(d.conjuge_nome_mae)} e ${mouValue(d.conjuge_nome_pai)}, nascido(a) em ${mouValue(d.conjuge_data_nascimento)}, ${mouValue(d.conjuge_profissao)}, e-mail ${mouValue(d.conjuge_email)}, telefone ${mouValue(d.conjuge_telefone)}, CPF ${mouValue(d.conjuge_cpf)} e RG ${mouValue(d.conjuge_rg)}.`
      : "";
    const enderecoConjuge = d.conjuge_nome_completo && usaEnderecoSeparado
      ? ` O cônjuge reside em ${formatEndereco(d, "conjuge") || "endereço não informado"}.`
      : "";
    return `${mouValue(d.nome_completo || participant.member?.nome || participant.member?.Nome_de_usuario)}, ${mouValue(d.nacionalidade)}, filho(a) de ${mouValue(d.nome_mae)} e ${mouValue(d.nome_pai)}, nascido(a) em ${mouValue(d.data_nascimento)}, ${mouValue(d.profissao)}, e-mail ${mouValue(d.email)}, telefone ${mouValue(d.telefone)}, inscrito(a) no CPF sob o nº ${mouValue(d.cpf)} e no RG sob o nº ${mouValue(d.rg)}, ${estadoCivil}${regime}, residente e domiciliado(a) em ${endereco}.${conjuge}${enderecoConjuge} Papel(is) na BIA: ${participant.roles.join(", ")}.`;
  }

  function mouMemberName(value: any): string | null {
    if (!value) return null;
    if (typeof value === "object") {
      return value.nome || value.Nome_de_usuario || value.email || value.id || null;
    }
    return null;
  }

  async function fetchCadastroGeralForMou(memberId: string, fields: string) {
    const id = String(memberId);
    const query = (selectedFields: string) =>
      directusFetchScoped(
        "cadastro_geral",
        `fields=${encodeURIComponent(selectedFields)}&filter[id][_eq]=${encodeURIComponent(id)}&limit=1`
      );
    try {
      const item = await directusFetchOne("cadastro_geral", id);
      if (item) return item;
    } catch (error: any) {
      console.warn("[bia-mou-padrao] Cadastro completo indisponivel; tentando campos segmentados:", error?.message || error);
    }

    const merged: Record<string, any> = {};
    const fieldGroups = [
      fields,
      "id,nome,Nome_de_usuario,email,telefone,whatsapp,cpf,CPF,cargo,cidade,estado,pais",
      "nacionalidade,nome_mae,nome_pai,data_nascimento,profissao,rg,estado_civil,regime_comunhao",
      "cep,endereco,numero,complemento,bairro,cidade,estado,pais,titular_cep,titular_endereco,titular_numero,titular_complemento,titular_bairro,titular_cidade,titular_estado,titular_pais",
      "conjuge_nome_completo,conjuge_nacionalidade,conjuge_nome_mae,conjuge_nome_pai,conjuge_data_nascimento,conjuge_profissao,conjuge_email,conjuge_telefone,conjuge_cpf,conjuge_rg,mesmo_endereco,mesmo_endereco_conjuge,conjuge_cep,conjuge_endereco,conjuge_numero,conjuge_complemento,conjuge_bairro,conjuge_cidade,conjuge_estado,conjuge_pais",
    ];
    for (const selectedFields of fieldGroups) {
      try {
        const rows = await query(selectedFields);
        const exact = rows.find((row: any) => String(row?.id || "") === id);
        Object.assign(merged, exact || (rows.length === 1 ? rows[0] : null) || {});
      } catch (error: any) {
        console.warn("[bia-mou-padrao] Grupo de campos do cadastro indisponivel:", error?.message || error);
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }

  async function getMouParticipantsForBia(bia: any, biaId: string) {
    const roleEntries: Array<{ role: string; memberId: string | null }> = [
      { role: "Aliado Licenciado BUILT", memberId: directusRelationId(bia.aliado_built) },
      { role: "Diretor(a) de AlianÃ§a", memberId: directusRelationId(bia.diretor_alianca) },
      { role: "Diretor(a) de NÃºcleo TÃ©cnico", memberId: directusRelationId(bia.diretor_nucleo_tecnico) },
      { role: "Diretor(a) de NÃºcleo de Obra", memberId: directusRelationId(bia.diretor_execucao) },
      { role: "Diretor(a) de NÃºcleo Comercial", memberId: directusRelationId(bia.diretor_comercial) },
      { role: "Diretor(a) de NÃºcleo de Capital", memberId: directusRelationId(bia.diretor_capital) },
      ...parseBiaMemberList(bia.socios_guardioes).map((memberId) => ({ role: "SÃ³cio GuardiÃ£o", memberId })),
      ...parseBiaMemberList(bia.socios_multiplicadores).map((memberId) => ({ role: "SÃ³cio Multiplicador", memberId })),
    ].filter((entry): entry is { role: string; memberId: string } => !!entry.memberId);

    const grouped = new Map<string, string[]>();
    for (const entry of roleEntries) {
      const memberId = String(entry.memberId);
      const roles = grouped.get(memberId) || [];
      if (!roles.includes(entry.role)) roles.push(entry.role);
      grouped.set(memberId, roles);
    }
    let aceites: any[] = [];
    try {
      aceites = await db.select().from(biaMouAceites).where(eq(biaMouAceites.bia_id, biaId));
    } catch (error: any) {
      console.warn("[bia-mou-padrao] Banco local indisponivel para aceites do MOU:", error?.message || error);
    }
    const aceiteByMember = new Map(aceites.map((aceite: any) => [String(aceite.membro_id), aceite]));
    const fields = [
      "id", "nome", "Nome_de_usuario", "email", "telefone", "whatsapp", "cpf", "CPF", "cargo", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "pais",
      "nacionalidade", "nome_mae", "nome_pai", "data_nascimento", "profissao", "rg", "estado_civil", "regime_comunhao",
      "titular_cep", "titular_endereco", "titular_numero", "titular_complemento", "titular_bairro", "titular_cidade", "titular_estado", "titular_pais",
      "conjuge_nome_completo", "conjuge_nacionalidade", "conjuge_nome_mae", "conjuge_nome_pai",
      "conjuge_data_nascimento", "conjuge_profissao", "conjuge_email", "conjuge_telefone", "conjuge_cpf", "conjuge_rg",
      "mesmo_endereco", "mesmo_endereco_conjuge", "conjuge_cep", "conjuge_endereco", "conjuge_numero", "conjuge_complemento", "conjuge_bairro", "conjuge_cidade", "conjuge_estado", "conjuge_pais",
    ].join(",");
    const participants = [];
    for (const [memberId, roles] of Array.from(grouped.entries())) {
      const member = await fetchCadastroGeralForMou(String(memberId), fields).catch(() => null) || { id: memberId };
      participants.push({
        memberId,
        roles,
        member,
        aceite: aceiteByMember.get(memberId) || null,
        data: mergeContractData(member, aceiteByMember.get(memberId)),
      });
    }
    return participants;
  }

  function buildAnexoIQualificacao(bia: any, biaId: string, participants: Awaited<ReturnType<typeof getMouParticipantsForBia>>) {
    const participantByRole = (role: string) => participants.find((p) => p.roles.includes(role))?.data?.nome_completo || null;
    const fieldOrParticipant = (field: string, role: string) => mouMemberName(bia[field]) || participantByRole(role) || "a definir";
    const diretores = {
      "Diretor(a) de AlianÃ§a": fieldOrParticipant("diretor_alianca", "Diretor(a) de AlianÃ§a"),
      "Diretor(a) de NÃºcleo TÃ©cnico": fieldOrParticipant("diretor_nucleo_tecnico", "Diretor(a) de NÃºcleo TÃ©cnico"),
      "Diretor(a) de NÃºcleo de Obra": fieldOrParticipant("diretor_execucao", "Diretor(a) de NÃºcleo de Obra"),
      "Diretor(a) de NÃºcleo Comercial": fieldOrParticipant("diretor_comercial", "Diretor(a) de NÃºcleo Comercial"),
      "Diretor(a) de NÃºcleo de Capital": fieldOrParticipant("diretor_capital", "Diretor(a) de NÃºcleo de Capital"),
      "Aliado Licenciado BUILT": fieldOrParticipant("aliado_built", "Aliado Licenciado BUILT"),
    };
    const camposAtivo = biaMouAtivoCampos(bia);
    const qualificacaoAtivo = [
      camposAtivo.qualificacao,
      camposAtivo.descricaoAdicional,
      camposAtivo.areaM2 ? `Área: ${camposAtivo.areaM2}m²` : "",
    ].filter(Boolean).join(" | ");
    const registroAtivo = [
      `Matrícula: ${camposAtivo.matricula}`,
      camposAtivo.livro ? `Livro: ${camposAtivo.livro}` : "",
      camposAtivo.folha ? `Folha: ${camposAtivo.folha}` : "",
      `Cartório: ${camposAtivo.cartorio}`,
      `Comarca: ${camposAtivo.comarca}`,
    ].filter(Boolean).join(" | ");
    const ativo = [
      `BIA: ${mouValue(bia.nome_bia)}`,
      `ID da BIA: ${biaId}`,
      `Ativo: ${qualificacaoAtivo}`,
      `Endereço do ativo: ${camposAtivo.enderecoCompleto}`,
      registroAtivo,
    ].join("\n");
    const partes = participants.length
      ? participants.map(qualificacaoParte).join("\n\n")
      : "Nenhum participante aceito foi localizado para esta BIA.";
    const diretoria = Object.entries(diretores).map(([role, nome]) => `${role}: ${nome};`).join("\n");
    return [
      ativo,
      "",
      "PARTES QUALIFICADAS",
      partes,
      "",
      "DIRETORIA DA BIA",
      "Para fins de governanÃ§a, organizaÃ§Ã£o funcional, exercÃ­cio de atribuiÃ§Ãµes, participaÃ§Ã£o no Conselho da BIA, registro de responsabilidades e rastreabilidade das deliberaÃ§Ãµes, a Diretoria da BIA serÃ¡ composta pelos participantes formalmente nomeados, ativos e registrados na Plataforma BUILT.",
      diretoria,
      "",
      "As funÃ§Ãµes vagas, pendentes ou nÃ£o preenchidas poderÃ£o ser posteriormente preenchidas pela governanÃ§a mediante registro correspondente na Plataforma BUILT, sem necessidade de aditamento formal deste Anexo, salvo exigÃªncia legal, societÃ¡ria, registral ou contratual especÃ­fica.",
    ].join("\n");
  }

  type MouAllocationRow = {
    group: "SÃ³cios GuardiÃµes" | "SÃ³cios Multiplicadores" | "NÃ£o classificados";
    memberId: string;
    name: string;
    value: number;
    percent: number;
  };

  async function getBiaAllocationMap(bia: any, biaId: string): Promise<MouAllocationRow[]> {
    const memberName = (value: any) => {
      if (value && typeof value === "object") {
        return value.Nome_de_usuario || value.nome || value.nome_completo || value.razao_social || value.email || value.id || "Membro desconhecido";
      }
      return "Membro desconhecido";
    };
    const memberId = (value: any) => {
      if (value && typeof value === "object") return value.id ? String(value.id) : null;
      return value ? String(value) : null;
    };
    const relationArrayFirst = (value: any) => {
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    };
    const relationMember = (value: any) => {
      const first = relationArrayFirst(value);
      if (!first || typeof first !== "object") return first;
      return first.cadastro_geral_id || first.cadastro_geral || first.membro_id || first.member_id || first;
    };
    let allEntries: any[] = [];
    try {
      allEntries = await directusFetchScoped(
        "fluxo_caixa",
        `fields=id,bia,tipo,valor,descricao,status,favorecido_id,Favorecido,Favorecido.*,Favorecido.cadastro_geral_id.*&filter[bia][_eq]=${encodeURIComponent(biaId)}`
      );
    } catch (error: any) {
      console.warn("[bia-mou-padrao] Consulta MAP com Favorecido indisponivel, tentando favorecido_id:", error?.message || error);
      allEntries = await directusFetchScoped(
        "fluxo_caixa",
        `fields=id,bia,tipo,valor,descricao,status,favorecido_id&filter[bia][_eq]=${encodeURIComponent(biaId)}`
      ).catch((fallbackError: any) => {
        console.warn("[bia-mou-padrao] Nao foi possivel buscar fluxo_caixa para o MAP:", fallbackError?.message || fallbackError);
        return [];
      });
    }
    const entries = allEntries.filter((entry: any) => directusRelationId(entry?.bia) === biaId || String(entry?.bia || "") === biaId);

    const values = new Map<string, { memberId: string; name: string; value: number }>();
    for (const entry of entries) {
      if (entry?.tipo !== "entrada") continue;
      if (entry?.descricao === "Valor de Origem da BIA") continue;
      const favorecido = relationMember(entry?.favorecido_id) || relationMember(entry?.Favorecido);
      const id = memberId(favorecido);
      if (!id) continue;
      const current = values.get(id) || { memberId: id, name: memberName(favorecido), value: 0 };
      current.value += parsePdfNumber(entry?.valor);
      values.set(id, current);
    }

    let transferencias: any[] = [];
    try {
      transferencias = await storage.getTransferenciasCotasByBia(biaId);
    } catch (error: any) {
      console.warn("[bia-mou-padrao] Transferencias de cotas indisponiveis para o MAP:", error?.message || error);
    }

    const guardioes = new Set(parseBiaMemberList(bia.socios_guardioes));
    const multiplicadores = new Set(parseBiaMemberList(bia.socios_multiplicadores));
    const roleByMember = new Map<string, MouAllocationRow["group"]>();
    guardioes.forEach((id) => roleByMember.set(id, "SÃ³cios GuardiÃµes"));
    multiplicadores.forEach((id) => roleByMember.set(id, "SÃ³cios Multiplicadores"));

    const nameCache = new Map<string, string>();
    const resolveMemberName = async (id: string) => {
      if (nameCache.has(id)) return nameCache.get(id)!;
      const member = await fetchCadastroGeralForMou(id, "id,nome,Nome_de_usuario,nome_completo,razao_social,email").catch(() => null);
      const name = memberName(member || { id });
      nameCache.set(id, name);
      return name;
    };

    for (const transfer of transferencias.filter((item: any) => item.status === "aceita")) {
      const origemId = String(transfer.membro_origem_id || "");
      const destinoId = String(transfer.membro_destino_id || "");
      if (!origemId || !destinoId) continue;
      const origem = values.get(origemId);
      if (!origem) continue;
      const requestedValue = parsePdfNumber(transfer.valor_total);
      const movedValue = Math.min(requestedValue, Math.max(0, origem.value));
      if (movedValue <= 0) continue;
      origem.value = Math.max(0, origem.value - movedValue);
      const destino = values.get(destinoId) || {
        memberId: destinoId,
        name: await resolveMemberName(destinoId),
        value: 0,
      };
      destino.value += movedValue;
      values.set(destinoId, destino);
      if (!roleByMember.has(destinoId)) roleByMember.set(destinoId, roleByMember.get(origemId) || "NÃ£o classificados");
    }

    const rowsBase = Array.from(values.values()).filter((item) => item.value > 0.005);
    for (const item of rowsBase) {
      const currentName = String(item.name || "").trim();
      if (
        !currentName
        || currentName === "Membro desconhecido"
        || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentName)
      ) {
        item.name = await resolveMemberName(item.memberId);
      }
    }
    const total = rowsBase.reduce((sum, item) => sum + item.value, 0);
    return rowsBase
      .map((item) => ({
        group: roleByMember.get(item.memberId) || "NÃ£o classificados",
        memberId: item.memberId,
        name: item.name,
        value: item.value,
        percent: total > 0 ? (item.value / total) * 100 : 0,
      }))
      .sort((a, b) => {
        const order = ["SÃ³cios GuardiÃµes", "SÃ³cios Multiplicadores", "NÃ£o classificados"];
        const groupDiff = order.indexOf(a.group) - order.indexOf(b.group);
        return groupDiff !== 0 ? groupDiff : b.value - a.value;
      });
  }

  function buildAnexoIIMapa(bia: any, biaId: string, allocationRows: MouAllocationRow[]) {
    const moeda = bia.moeda || "BRL";
    const total = allocationRows.reduce((sum, row) => sum + row.value, 0);
    const rows = allocationRows.length
      ? allocationRows.map((row) => [`${row.group} - ${row.name}`, row.percent, row.value])
      : [["Sem aportes registrados", 0, 0]];
    return [
      `BIA: ${mouValue(bia.nome_bia)}`,
      `ID da BIA: ${biaId}`,
      `Total alocado no MAP: ${formatPdfMoney(total, moeda)}`,
      `Participantes com alocaÃ§Ã£o: ${allocationRows.length}`,
      "",
      "AlocaÃ§Ã£o patrimonial atual:",
      ...rows.map(([label, percent, value]) => `${label}: ${formatPdfPercent(percent)} - ${formatPdfMoney(value, moeda)}`),
      "",
      "Este mapa reflete os aportes registrados na Plataforma BUILT e as transferÃªncias de cotas aceitas atÃ© a data de geraÃ§Ã£o deste documento. AlteraÃ§Ãµes futuras devem ser registradas na plataforma, no MAP atualizado, em ata ou em documento equivalente.",
    ].join("\n");
  }

  async function fetchBiaForMouPdf(biaId: string) {
    const fields = [
      "*",
      "aliado_built.id", "aliado_built.nome", "aliado_built.Nome_de_usuario", "aliado_built.email",
      "diretor_alianca.id", "diretor_alianca.nome", "diretor_alianca.Nome_de_usuario", "diretor_alianca.email",
      "diretor_nucleo_tecnico.id", "diretor_nucleo_tecnico.nome", "diretor_nucleo_tecnico.Nome_de_usuario", "diretor_nucleo_tecnico.email",
      "diretor_execucao.id", "diretor_execucao.nome", "diretor_execucao.Nome_de_usuario", "diretor_execucao.email",
      "diretor_comercial.id", "diretor_comercial.nome", "diretor_comercial.Nome_de_usuario", "diretor_comercial.email",
      "diretor_capital.id", "diretor_capital.nome", "diretor_capital.Nome_de_usuario", "diretor_capital.email",
    ].join(",");
    const url = `${DIRECTUS_URL}/items/bias_projetos/${biaId}?fields=${encodeURIComponent(fields)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Directus error: ${response.status}`);
    const json = await response.json();
    return json.data ? await ensureBiaPublicCode(json.data) : null;
  }

  app.post("/api/bias/:id/gerar-mou-padrao", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await fetchBiaForMouPdf(req.params.id);
      if (!bia) return res.status(404).json({ error: "BIA nao encontrada" });
      const authorization = await requireBiaModuleAccess(req, res, String(bia.id), "configuracao_bia", "edit");
      if (!authorization) return;

      const infoLocal = await storage.getBiaInfoComercial(req.params.id).catch(() => null);
      const biaComInfo = {
        ...bia,
        ...pickFilledBiaInfoComercialFields(bia ?? {}),
        ...pickFilledBiaInfoComercialFields(infoLocal ?? {}),
      };
      const participants = await getMouParticipantsForBia(biaComInfo, req.params.id);
      const allocationRows = await getBiaAllocationMap(biaComInfo, req.params.id);
      const mouPadraoBase = readMouAsset("mou-padrao-built.txt") || "MOU PadrÃ£o BUILT nÃ£o localizado nos assets do servidor.";
      const mouPadrao = personalizarBiaMouTexto(mouPadraoBase, req.params.id, biaComInfo);
      const anexoIII = readMouAsset("anexo-iii-termo-metodologia.txt") || "Anexo III nÃ£o localizado nos assets do servidor.";
      const anexoIV = readMouAsset("anexo-iv-parceiro-capital.txt") || "Anexo IV nÃ£o localizado nos assets do servidor.";
      const sections = [
        { title: "MOU PadrÃ£o BUILT", body: mouPadrao },
        { title: "Anexo I - QualificaÃ§Ã£o das Partes", body: buildAnexoIQualificacao(biaComInfo, req.params.id, participants) },
        { title: "Anexo II - Mapa de Aloca\u00E7\u00E3o Patrimonial Inicial", body: buildAnexoIIMapa(biaComInfo, req.params.id, allocationRows) },
        { title: "Anexo III - Termo de AdesÃ£o Ã  Metodologia BUILT", body: anexoIII },
        { title: "Anexo IV - Termo de AdesÃ£o e Responsabilidade do Parceiro de Capital", body: anexoIV },
      ];
      const now = new Date();
      const title = `MOU PadrÃ£o BUILT - ${biaComInfo.nome_bia || req.params.id}`;
      const footerLabel = buildBiaFooterLabel(biaComInfo, req.params.id);
      const pdf = buildSimpleTextPdf(title, sections, { footerLabel });
      const safeName = String(biaComInfo.nome_bia || req.params.id).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || req.params.id;
      const fileId = await uploadPdfToDirectus(pdf, `mou-padrao-built-${safeName}-${now.toISOString().slice(0, 10)}.pdf`);
      const arquivos = await resolveFileIds([fileId]);
      let item: any = null;
      let warning: string | null = null;
      try {
        const [created] = await db.insert(nucleoTecnicoDocs).values({
          bia_id: req.params.id,
          alianca_tipo: "juridica",
          tipo_documento: "MOU PadrÃ£o BUILT",
          descricao: `PDF gerado automaticamente com MOU PadrÃ£o e 4 anexos em ${now.toLocaleString("pt-BR")}.`,
          membro_responsavel: (req.session as any).membroId || null,
          arquivo_ids: [fileId],
        }).returning();
        item = { ...created, arquivos };
      } catch (error: any) {
        item = {
          id: `mou-fallback-${req.params.id}-${Date.now()}`,
          bia_id: req.params.id,
          alianca_tipo: "juridica",
          tipo_documento: "MOU PadrÃ£o BUILT",
          descricao: `PDF gerado automaticamente com MOU PadrÃ£o e 4 anexos em ${now.toLocaleString("pt-BR")}.`,
          membro_responsavel: (req.session as any).membroId || null,
          arquivo_ids: [fileId],
          created_at: now,
          arquivos,
        };
        nucleoTecnicoDocsFallback.unshift(item);
        upsertFallbackDocument("tecnico", item);
        console.warn("[bia-mou-padrao] PDF registrado em fallback temporario:", error?.message || error);
      }
      res.json({ success: true, item, arquivo: arquivos[0] || { id: fileId, url: `/api/files/${fileId}` }, warning });
    } catch (error: any) {
      console.error("[bia-mou-padrao] erro ao gerar PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  type DocumentoAceiteResumo = {
    id: string;
    tipo: "termo" | "mou";
    chave?: string;
    titulo: string;
    versao: string | null;
    aceito_em: string | null;
    origem: string;
    bia_id?: string | null;
    bia_nome?: string | null;
    aceite_localizacao?: any;
  };

  const TERMOS_ACEITE_BUILT: Record<string, { titulo: string; versao: string; origem: string; body: string }> = {
    codigo_etica: {
      titulo: "Código de Ética BUILT",
      versao: "BUILT JUR - 1",
      origem: "Cadastro inicial",
      body: [
        "CÓDIGO DE ÉTICA BUILT",
        "",
        "Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.",
        "",
        "Eu agirei com transparência, lealdade e respeito em todas as relações.",
        "",
        "Eu protegerei a confiança construída e a reputação coletiva.",
        "",
        "Eu assumirei responsabilidade integral por minhas ações, decisões e conduta.",
        "",
        "Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.",
        "",
        "Eu honrarei os esforços e a dignidade dos meus aliados acima do lucro.",
      ].join("\n"),
    },
    politicas_participacao_protecao: {
      titulo: "PolÃ­ticas de ParticipaÃ§Ã£o e ProteÃ§Ã£o BUILT",
      versao: "BUILT JUR - 1",
      origem: "Cadastro inicial",
      body: [
        "POLÃTICAS DE PARTICIPAÃ‡ÃƒO E PROTEÃ‡ÃƒO - BUILT",
        "",
        "Estas PolÃ­ticas definem as regras gerais de acesso, participaÃ§Ã£o, permanÃªncia, conduta, proteÃ§Ã£o institucional e uso do ecossistema BUILT.",
        "",
        "Seu objetivo Ã© proteger a BUILT, seus membros, comunidades, OBAs, BIAs, parceiros, ativos, registros, metodologia, plataforma, marca e reputaÃ§Ã£o.",
        "",
        "A BUILT opera com base em boa-fÃ© objetiva, lealdade, comprometimento, transparÃªncia, rastreabilidade, responsabilidade individual, validaÃ§Ã£o reputacional, cooperaÃ§Ã£o estratÃ©gica, proteÃ§Ã£o institucional, integridade patrimonial e disciplina relacional.",
        "",
        "O acesso aos ambientes da BUILT poderÃ¡ depender de aceite eletrÃ´nico ou fÃ­sico dos Termos de Acesso, CÃ³digo de Ã‰tica, PolÃ­ticas de ParticipaÃ§Ã£o e ProteÃ§Ã£o e demais instrumentos aplicÃ¡veis.",
        "",
        "Todo participante deverÃ¡ atuar com Ã©tica, boa-fÃ©, lealdade, comprometimento, transparÃªncia, diligÃªncia, cooperaÃ§Ã£o, respeito Ã  legislaÃ§Ã£o e aderÃªncia ao CÃ³digo de Ã‰tica, a estas PolÃ­ticas e aos instrumentos aplicÃ¡veis.",
        "",
        "SÃ£o confidenciais as informaÃ§Ãµes estratÃ©gicas, comerciais, tÃ©cnicas, financeiras, jurÃ­dicas, societÃ¡rias, patrimoniais, reputacionais, operacionais, metodolÃ³gicas, documentais ou negociais acessadas no ecossistema BUILT, salvo quando expressamente classificadas como pÃºblicas.",
        "",
        "A manifestaÃ§Ã£o de interesse em OBA Ã© ato preliminar e dependerÃ¡ de anÃ¡lise, seleÃ§Ã£o, aprovaÃ§Ã£o, aceite especÃ­fico, registro na Plataforma BUILT e instrumentos aplicÃ¡veis da respectiva BIA.",
        "",
        "A participaÃ§Ã£o em BIA especÃ­fica dependerÃ¡ de aprovaÃ§Ã£o da governanÃ§a competente, aceite prÃ³prio, registro na Plataforma BUILT, definiÃ§Ã£o de funÃ§Ã£o, aporte, entrega ou responsabilidade, e vinculaÃ§Ã£o aos instrumentos aplicÃ¡veis.",
        "",
        "A BUILT atua como plataforma privada de mÃ©todo, rede, governanÃ§a, rastreabilidade, validaÃ§Ã£o reputacional, organizaÃ§Ã£o informacional e proteÃ§Ã£o institucional.",
        "",
        "Estas PolÃ­ticas integram, por referÃªncia, os Termos de Acesso da Plataforma BUILT, fluxos de OBA, MOUs de BIA, MAPs, termos de adesÃ£o, atas, registros, anexos e demais instrumentos aplicÃ¡veis.",
      ].join("\n"),
    },
    vitrine: {
      titulo: "Termo de Acesso e Uso da Vitrine Pública BUILT",
      versao: "BUILT JUR - 2",
      origem: "BUILT Vitrine",
      body: readTermAsset("built-jur-2-vitrine.txt") || [
        "TERMO DE ACESSO E USO DA VITRINE PÃšBLICA BUILT",
        "",
        "Este Termo regula o acesso Ã  vitrine pÃºblica da BUILT, ambiente digital destinado Ã  exposiÃ§Ã£o institucional, descoberta de perfis, consulta de categorias, apresentaÃ§Ã£o pÃºblica controlada de empresas e profissionais formalmente habilitados e demais funcionalidades abertas pela BUILT.",
        "",
        "A vitrine pÃºblica possui natureza informativa, institucional e relacional. A presenÃ§a do usuÃ¡rio na vitrine pÃºblica nÃ£o constitui certificaÃ§Ã£o absoluta, endosso profissional, promessa de contrataÃ§Ã£o, garantia de reputaÃ§Ã£o, garantia de capacidade tÃ©cnica ou aval financeiro.",
        "",
        "O usuÃ¡rio Ã© integralmente responsÃ¡vel pelos dados, documentos, imagens, currÃ­culos, registros, marcas, portfÃ³lios, links, descriÃ§Ãµes e demais conteÃºdos inseridos.",
        "",
        "O acesso Ã© pessoal, revogÃ¡vel, nÃ£o exclusivo e intransferÃ­vel. Ã‰ vedado usar a vitrine pÃºblica para spam, fraude, engenharia social, concorrÃªncia desleal ou desvio de oportunidades.",
        "",
        "O aceite deste Termo poderÃ¡ ocorrer por clique, checkbox, autenticaÃ§Ã£o social, assinatura eletrÃ´nica, fluxo de cadastro ou outro mecanismo eletrÃ´nico apto a demonstrar manifestaÃ§Ã£o inequÃ­voca de vontade.",
      ].join("\n"),
    },
    area_aliancas: {
      titulo: "Termo de Acesso à Área de Alianças BUILT",
      versao: "BUILT JUR - 4",
      origem: "BUILT Alliances",
      body: readTermAsset("built-jur-4-area-aliancas.txt") || [
        "TERMO DE ACESSO \u00C0 \u00C1REA DE ALIAN\u00C7AS BUILT",
        "",
        "Este Termo disciplina o ingresso e a perman\u00EAncia do usu\u00E1rio na \u00C1rea de Alian\u00E7as BUILT, ambiente restrito destinado a empres\u00E1rios s\u00F3cios, profissionais formalmente habilitados e demais participantes eleg\u00EDveis aprovados pela BUILT.",
        "",
        "O acesso \u00E0 \u00C1rea de Alian\u00E7as depende de aprova\u00E7\u00E3o cadastral, reputacional, t\u00E9cnica e documental, conforme os crit\u00E9rios internos da BUILT.",
        "",
        "O Membro Aliado compromete-se a atuar com \u00E9tica, boa-f\u00E9, lealdade, dilig\u00EAncia, respeito \u00E0 legisla\u00E7\u00E3o aplic\u00E1vel e ader\u00EAncia integral ao C\u00F3digo de \u00C9tica, \u00E0s Pol\u00EDticas de Participa\u00E7\u00E3o e Prote\u00E7\u00E3o, aos manuais internos e aos instrumentos espec\u00EDficos da BUILT.",
        "",
        "Toda participa\u00E7\u00E3o relevante do Membro Aliado em oportunidades, valida\u00E7\u00F5es, alian\u00E7as, entregas, CPPs, comunidades ou BIAs dever\u00E1 ser registrada no ambiente indicado pela BUILT para fins de governan\u00E7a, transpar\u00EAncia, compliance e auditoria.",
        "",
        "A condi\u00E7\u00E3o de Membro Aliado n\u00E3o garante participa\u00E7\u00E3o autom\u00E1tica em BIAs, recebimento de oportunidades, contrata\u00E7\u00E3o, remunera\u00E7\u00E3o, retorno econ\u00F4mico, indica\u00E7\u00E3o comercial ou aporte de capital.",
      ].join("\n"),
    },
    built_capital: {
      titulo: "Termo de Acesso à Área de Parceiros de Capital BUILT",
      versao: "BUILT JUR - 3",
      origem: "BUILT Capital",
      body: readTermAsset("built-jur-3-capital.txt") || [
        "TERMO PROVISÃ“RIO DE ACESSO AO BUILT CAPITAL",
        "",
        "Este termo regula o acesso inicial ao BUILT Capital, ambiente restrito voltado Ã  conexÃ£o, qualificaÃ§Ã£o e relacionamento com parceiros de capital, investidores, originadores e participantes estratÃ©gicos da rede BUILT.",
        "",
        "O acesso ao BUILT Capital nÃ£o constitui recomendaÃ§Ã£o de investimento, oferta pÃºblica, intermediaÃ§Ã£o financeira, promessa de retorno, garantia de rentabilidade ou aprovaÃ§Ã£o automÃ¡tica de aporte.",
        "",
        "Toda decisÃ£o de aporte, crÃ©dito, investimento, financiamento ou parceria dependerÃ¡ de anÃ¡lise prÃ³pria, diligÃªncia, instrumentos especÃ­ficos, registro e aprovaÃ§Ã£o das partes envolvidas.",
        "",
        "O usuÃ¡rio compromete-se a fornecer informaÃ§Ãµes verdadeiras, manter seus dados atualizados, respeitar confidencialidade, compliance, origem lÃ­cita de recursos e legislaÃ§Ã£o aplicÃ¡vel.",
      ].join("\n"),
    },
    pinbank_baas: {
      titulo: "Termos de Uso BaaS PINBANK",
      versao: "PINBANK",
      origem: "Núcleo de Capital",
      body: [
        "COMPROVANTE DE ACEITE DOS TERMOS DE USO BAAS PINBANK",
        "",
        "Este comprovante registra o aceite eletrônico da versão informada pela PINBANK no momento da confirmação.",
        "",
        "O conteúdo integral oficial permanece vinculado ao provedor bancário e ao processo de abertura e operação da conta da respectiva BIA.",
      ].join("\n"),
    },
  };

  app.get("/api/termos-aceite/:chave", (req, res) => {
    const term = TERMOS_ACEITE_BUILT[req.params.chave];
    if (!term) return res.status(404).json({ error: "Termo não encontrado" });
    res.json({
      chave: req.params.chave,
      titulo: term.titulo,
      versao: term.versao,
      origem: term.origem,
      body: term.body,
    });
  });

  const acceptedDocDate = (value: any) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  };

  const normalizeAcceptanceLocation = (value: any) => {
    if (!value || typeof value !== "object") return null;
    const status = String(value.status || "").trim();
    const allowed = new Set(["capturada", "negada", "indisponivel", "erro"]);
    const normalized: Record<string, any> = {
      status: allowed.has(status) ? status : "erro",
      captured_at: acceptedDocDate(value.captured_at) || new Date().toISOString(),
    };
    const hasLatitude = value.latitude !== null && value.latitude !== undefined && value.latitude !== "";
    const hasLongitude = value.longitude !== null && value.longitude !== undefined && value.longitude !== "";
    const hasAccuracy = value.accuracy !== null && value.accuracy !== undefined && value.accuracy !== "";
    const latitude = hasLatitude ? Number(value.latitude) : Number.NaN;
    const longitude = hasLongitude ? Number(value.longitude) : Number.NaN;
    const accuracy = hasAccuracy ? Number(value.accuracy) : Number.NaN;
    if (Number.isFinite(latitude)) normalized.latitude = latitude;
    if (Number.isFinite(longitude)) normalized.longitude = longitude;
    if (Number.isFinite(accuracy) && accuracy >= 0) normalized.accuracy = accuracy;
    if (value.message) normalized.message = String(value.message).slice(0, 240);
    return normalized;
  };

  const ACCEPTANCE_LOCATION_REQUIRED_ERROR =
    "Para registrar o aceite, permita o acesso à localização do dispositivo e tente novamente.";

  const getCapturedAcceptanceLocation = (value: any) => {
    const location = normalizeAcceptanceLocation(value);
    if (!location || location.status !== "capturada") return null;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
    return location;
  };

  const formatAcceptanceLocationLines = (value: any) => {
    const loc = normalizeAcceptanceLocation(value);
    if (!loc || loc.status !== "capturada" || loc.latitude == null || loc.longitude == null) {
      return ["Localização do aceite: não autorizada/indisponível"];
    }
    return [
      `Localização do aceite: ${Number(loc.latitude).toFixed(6)}, ${Number(loc.longitude).toFixed(6)}`,
      loc.accuracy != null ? `Precisão aproximada: ${Math.round(Number(loc.accuracy))} m` : "Precisão aproximada: não informada",
      `Localização capturada em: ${loc.captured_at ? new Date(loc.captured_at).toLocaleString("pt-BR") : "não informado"}`,
    ];
  };

  async function recordTermAcceptanceAudit(params: {
    membroId: string;
    termoChave: string;
    termoVersao?: string | null;
    origem?: string | null;
    aceitoEm?: string | Date | null;
    aceiteLocalizacao?: any;
  }) {
    const loc = normalizeAcceptanceLocation(params.aceiteLocalizacao);
    await ensureTermosAceiteAuditoriaTable().catch(() => {});
    const locJson = loc ? JSON.stringify(loc) : null;
    await db.execute(sql`
      INSERT INTO termos_aceite_auditoria (membro_id, termo_chave, termo_versao, origem, aceito_em, aceite_localizacao)
      VALUES (${params.membroId}, ${params.termoChave}, ${params.termoVersao || null}, ${params.origem || null}, ${params.aceitoEm ? new Date(params.aceitoEm) : new Date()}, ${locJson}::jsonb)
    `).catch((err: any) => console.warn("[termos-aceite] falha ao registrar auditoria:", err?.message || err));
  }

  async function getLatestTermAcceptanceLocations(membroId: string) {
    await ensureTermosAceiteAuditoriaTable().catch(() => {});
    const result: any = await db.execute(sql`
      SELECT DISTINCT ON (termo_chave) termo_chave, aceite_localizacao
      FROM termos_aceite_auditoria
      WHERE membro_id = ${membroId}
      ORDER BY termo_chave, aceito_em DESC
    `).catch(() => ({ rows: [] }));
    const rows = Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
    const map = new Map<string, any>();
    rows.forEach((row: any) => map.set(String(row.termo_chave), row.aceite_localizacao || null));
    return map;
  }

  async function listarDocumentosAceitosDoUsuario(req: any): Promise<DocumentoAceiteResumo[]> {
    const membroId = req.session?.membroId as string | null;
    if (!membroId) return [];

    const docs = new Map<string, DocumentoAceiteResumo>();
    const aceiteLocationByTerm = await getLatestTermAcceptanceLocations(membroId);
    const membro = await directusFetchOne(
      "cadastro_geral",
      membroId,
      "fields=id,nome,Nome_de_usuario,email,codigo_etica_aceito_em,codigo_etica_versao,politicas_participacao_aceito_em,politicas_participacao_versao,vitrine_termo_aceito_em,vitrine_termo_versao,area_aliancas_termo_aceito_em,area_aliancas_termo_versao,built_capital_termo_aceito_em,built_capital_termo_versao"
    ).catch(() => null);

    const addTerm = (key: string, acceptedAt: any, version?: any, origem?: string, aceiteLocalizacao?: any) => {
      if (!acceptedAt) return;
      const term = TERMOS_ACEITE_BUILT[key];
      if (!term) return;
      const id = `termo-${key}`;
      docs.set(id, {
        id,
        tipo: "termo",
        chave: key,
        titulo: term.titulo,
        versao: version || term.versao,
        aceito_em: acceptedDocDate(acceptedAt),
        origem: origem || term.origem,
        aceite_localizacao: aceiteLocalizacao ?? aceiteLocationByTerm.get(key) ?? null,
      });
    };

    if (membro) {
      addTerm("codigo_etica", membro.codigo_etica_aceito_em, membro.codigo_etica_versao);
      addTerm("politicas_participacao_protecao", membro.politicas_participacao_aceito_em, membro.politicas_participacao_versao);
      addTerm("vitrine", membro.vitrine_termo_aceito_em, membro.vitrine_termo_versao);
      addTerm("area_aliancas", membro.area_aliancas_termo_aceito_em, membro.area_aliancas_termo_versao);
      addTerm("built_capital", membro.built_capital_termo_aceito_em, membro.built_capital_termo_versao);
    }

    try {
      const convites = await storage.getConvitesByCandidatoMembro(membroId);
      for (const convite of convites) {
        const dados = convite.dados_contratuais && typeof convite.dados_contratuais === "object"
          ? convite.dados_contratuais as Record<string, any>
          : {};
        const aceitos = dados.termos_aceitos && typeof dados.termos_aceitos === "object" ? dados.termos_aceitos : {};
        const versoes = dados.termos_versoes && typeof dados.termos_versoes === "object" ? dados.termos_versoes : {};
        const acceptedAt = dados.aceito_em || convite.termos_aceitos_em;
        for (const [key, accepted] of Object.entries(aceitos)) {
          if (accepted) addTerm(key, acceptedAt, (versoes as any)[key], undefined, dados.aceite_localizacao);
        }
      }
    } catch (error: any) {
      console.warn("[documentos-aceitos] falha ao buscar convites para fallback:", error?.message || error);
    }

    try {
      const mouAceites = await db.select().from(biaMouAceites)
        .where(eq(biaMouAceites.membro_id, membroId))
        .orderBy(desc(biaMouAceites.aceito_em));
      for (const aceite of mouAceites) {
        let biaNome = "";
        try {
          const bia = await directusFetchOne("bias_projetos", aceite.bia_id, "fields=id,nome_bia,codigo_publico").catch(() => null);
          biaNome = bia?.nome_bia || "";
        } catch {}
        const biaNomeSemPrefixo = String(biaNome || "").replace(/\s+/g, " ").replace(/^BIA\s+/i, "").trim();
        const id = `mou-${aceite.id}`;
        docs.set(id, {
          id,
          tipo: "mou",
          titulo: biaNome
            ? `${aceite.mou_titulo || "MOU PadrÃ£o BUILT"} - ${biaNome}`
            : aceite.mou_titulo || "MOU PadrÃ£o BUILT",
          versao: aceite.mou_versao || null,
          aceito_em: acceptedDocDate(aceite.aceito_em),
          origem: biaNomeSemPrefixo ? `BIA ${biaNomeSemPrefixo}` : `BIA ${aceite.bia_id}`,
          bia_id: aceite.bia_id,
          bia_nome: biaNome || null,
          aceite_localizacao: (aceite as any).aceite_localizacao || null,
        });
      }
    } catch (error: any) {
      console.warn("[documentos-aceitos] falha ao buscar MOUs aceitos:", error?.message || error);
    }

    try {
      const bankResult: any = await db.execute(sql`
        SELECT bia_id, terms_version, terms_accepted_at, terms_acceptance_location
        FROM bia_bank_accounts
        WHERE terms_accepted_by_membro_id = ${membroId}
          AND terms_accepted_at IS NOT NULL
        ORDER BY terms_accepted_at DESC
      `).catch(() => ({ rows: [] }));
      const persistedAccounts = Array.isArray(bankResult?.rows) ? bankResult.rows : [];
      const memoryAccounts = Array.from(memoryBiaBankAccounts.values()).filter((account: any) =>
        String(account?.terms_accepted_by_membro_id || "") === String(membroId)
        && Boolean(account?.terms_accepted_at)
      );
      const accountsByBia = new Map<string, any>();
      [...persistedAccounts, ...memoryAccounts].forEach((account: any) => {
        const biaId = String(account?.bia_id || "").trim();
        if (biaId && !accountsByBia.has(biaId)) accountsByBia.set(biaId, account);
      });

      for (const account of Array.from(accountsByBia.values())) {
        const bia = await directusFetchOne("bias_projetos", account.bia_id, "fields=id,nome_bia,codigo_publico").catch(() => null);
        const biaNome = String(bia?.nome_bia || "").replace(/\s+/g, " ").replace(/^BIA\s+/i, "").trim();
        const id = `termo-pinbank-${account.bia_id}`;
        docs.set(id, {
          id,
          tipo: "termo",
          chave: "pinbank_baas",
          titulo: biaNome ? `Termos de Uso BaaS PINBANK - BIA ${biaNome}` : "Termos de Uso BaaS PINBANK",
          versao: account.terms_version || "PINBANK",
          aceito_em: acceptedDocDate(account.terms_accepted_at),
          origem: biaNome ? `Núcleo de Capital - BIA ${biaNome}` : `Núcleo de Capital - BIA ${account.bia_id}`,
          bia_id: account.bia_id,
          bia_nome: biaNome || null,
          aceite_localizacao: account.terms_acceptance_location || null,
        });
      }
    } catch (error: any) {
      console.warn("[documentos-aceitos] falha ao buscar termos bancários aceitos:", error?.message || error);
    }

    return Array.from(docs.values()).sort((a, b) => {
      const da = a.aceito_em ? new Date(a.aceito_em).getTime() : 0;
      const dbb = b.aceito_em ? new Date(b.aceito_em).getTime() : 0;
      return dbb - da;
    });
  }

  app.get("/api/me/documentos-aceitos", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const documentos = await listarDocumentosAceitosDoUsuario(req);
      res.json({ documentos });
    } catch (error: any) {
      console.error("[documentos-aceitos] erro ao listar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/me/documentos-aceitos/:documentoId/pdf", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const documentos = await listarDocumentosAceitosDoUsuario(req);
      const documento = documentos.find((item) => item.id === req.params.documentoId);
      if (!documento) return res.status(404).json({ error: "Documento nÃ£o encontrado" });
      const membroAceiteId = (req.session as any).membroId as string | null;
      const membroAceite = membroAceiteId
        ? await directusFetchOne(
          "cadastro_geral",
          membroAceiteId,
          "fields=id,nome,Nome_de_usuario,email"
        ).catch(() => null)
        : null;
      const membroAceiteNome = String(
        membroAceite?.nome ||
        membroAceite?.Nome_de_usuario ||
        membroAceite?.email ||
        "nÃ£o informado"
      );

      let sections: Array<{ title: string; body: string }> = [];
      let footerLabel: string | undefined;
      if (documento.tipo === "mou") {
        const biaNome = String(documento.bia_nome || "").replace(/\s+/g, " ").replace(/^BIA\s+/i, "").trim();
        sections = [
          {
            title: "Comprovante de aceite",
            body: [
              `Documento: ${documento.titulo}`,
              `Tipo: MOU PadrÃ£o BUILT`,
              `VersÃ£o: ${documento.versao || "nÃ£o informada"}`,
              `Origem: ${biaNome ? `BIA ${biaNome}` : documento.origem}`,
              `Pessoa: ${membroAceiteNome}`,
              `CÃ³digo rastreÃ¡vel da pessoa: ${membroAceite?.id || membroAceiteId || "nÃ£o informado"}`,
              `BIA vinculada: ${biaNome || documento.bia_id || "nÃ£o informada"}`,
              `CÃ³digo rastreÃ¡vel da BIA: ${documento.bia_id || "nÃ£o informado"}`,
              `Aceito em: ${documento.aceito_em ? new Date(documento.aceito_em).toLocaleString("pt-BR") : "nÃ£o informado"}`,
              ...formatAcceptanceLocationLines(documento.aceite_localizacao),
            ].join("\n"),
          },
          {
            title: "Registro de aceite",
            body: "Este comprovante registra que a pessoa indicada aceitou eletronicamente o MOU PadrÃ£o BUILT vinculado Ã  BIA informada na plataforma BUILT. O documento completo permanece vinculado aos registros formais da respectiva AlianÃ§a, seus anexos, deliberaÃ§Ãµes internas e instrumentos jurÃ­dicos especÃ­ficos.",
          },
        ];
      } else {
        const term = documento.chave ? TERMOS_ACEITE_BUILT[documento.chave] : null;
        const body = term?.body || [
          "Documento hist\u00F3rico de aceite.",
          "",
          "O texto completo desta vers\u00E3o n\u00E3o est\u00E1 mapeado no sistema atual. Este comprovante preserva os metadados do aceite registrado.",
        ].join("\n");
        sections = [
          {
            title: "Comprovante de aceite",
            body: [
              `Documento: ${documento.titulo}`,
              `Vers\u00E3o: ${documento.versao || "n\u00E3o informada"}`,
              `Origem: ${documento.origem}`,
              `Pessoa: ${membroAceiteNome}`,
              `C\u00F3digo rastre\u00E1vel da pessoa: ${membroAceite?.id || membroAceiteId || "n\u00E3o informado"}`,
              `Aceito em: ${documento.aceito_em ? new Date(documento.aceito_em).toLocaleString("pt-BR") : "n\u00E3o informado"}`,
              ...formatAcceptanceLocationLines(documento.aceite_localizacao),
            ].join("\n"),
          },
          { title: documento.titulo, body },
        ];
      }

      const pdf = buildSimpleTextPdf(documento.titulo, sections, {
        headerLabel: "COMPROVANTE BUILT",
        ...(footerLabel ? { footerLabel } : {}),
      });
      const filename = `${documento.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "documento-aceito"}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(pdf);
    } catch (error: any) {
      console.error("[documentos-aceitos] erro ao gerar PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId as string | null;
      const directusUserId = (req.session as any).directusUserId as string;

      // Security: if the user has no linked Directus member profile, return empty scoped data
      if (!membroId) {
        return res.json({
          bias: [],
          comunidades: [],
          opas: [],
          convergencias: [],
          dashboard_stats: {
            convergencias_total: 0,
            opas_total_periodo: 0,
            interesses_manifestados: 0,
            indice_convergencia: 0,
            taxa_interesse: 0,
            opas_comunidade_total: 0,
            opas_por_abrangencia: [
              { name: "Regional", value: 0 },
              { name: "Nacional", value: 0 },
              { name: "Global", value: 0 },
            ],
          },
          totals: { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 },
          opas_abertas: 0,
        });
      }

      const BIA_ROLE_FIELDS = [
        "autor_bia", "aliado_built", "diretor_alianca", "diretor_nucleo_tecnico",
        "diretor_execucao", "diretor_comercial", "diretor_capital",
      ];

      const fetchDashboardOpas = async () => {
        const baseFields = "fields=id,nome_oportunidade,tipo,ramo_atuacao,bia,localizacao,pais,valor_origem_opa,nucleo_alianca,perfil_aliado,objetivo_alianca,Minimo_esforco_multiplicador,date_created";
        try {
          return await directusFetchScoped("tipos_oportunidades", `${baseFields},status`);
        } catch (err) {
          console.warn("[dashboard] tipos_oportunidades status unavailable, retrying without status");
          return await directusFetchScoped("tipos_oportunidades", baseFields).catch(() => []);
        }
      };

      const [allBias, allOpas, comunidades, fluxoCaixa] = await Promise.all([
        directusFetchScoped("bias_projetos",
          "fields=id,codigo_publico,nome_bia,situacao,objetivo_alianca,destinacao,localizacao,latitude,longitude,observacoes,imagem_directus_id," +
          "valor_origem,valor_geral_venda_vgv,valor_realizado_venda,custo_final_previsto,resultado_liquido,moeda," +
          "cpp_autor_opa,cpp_aliado_built,cpp_built,cpp_dir_alianca,cpp_dir_tecnico,cpp_dir_obras,cpp_dir_comercial,cpp_dir_capital," +
          "bia_publica,autor_bia,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital," +
          "socios_guardioes,socios_multiplicadores,terceiros"
        ),
        fetchDashboardOpas(),
        directusFetch(await getComunidadeCol(), COMUNIDADE_FIELDS).catch(() => []),
        directusFetch("fluxo_caixa", "fields=id,bia,tipo,valor,favorecido_id").catch(() => []),
      ]);

      const userBias = await Promise.all(
        (allBias as any[])
          .filter(b => isUserLinkedToBia(b, membroId))
          .map((b: any) => ensureBiaPublicCode(b))
      );

      const userBiaIds = new Set(userBias.map((b: any) => b.id));
      const CLOSED_STATUSES = new Set(["concluida", "desistencia"]);
      const relationId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === "object") return value.id ? String(value.id) : null;
        return String(value);
      };
      const allBiaNameMap: Record<string, string> = {};
      for (const b of allBias as any[]) allBiaNameMap[b.id] = b.nome_bia || b.id;
      const biaNameMap: Record<string, string> = {};
      for (const b of userBias) biaNameMap[b.id] = b.nome_bia || b.id;

      const meusInteresses = await storage.getInteressesByUser(directusUserId).catch(() => []);
      const interesseOpaIds = new Set(meusInteresses.map((interesse: any) => interesse.opa_id));
      const interesseDataMap = new Map(meusInteresses.map((interesse: any) => [interesse.opa_id, interesse]));
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const isWithinLastTwelveMonths = (item: any) => {
        if (!item?.date_created) return true;
        const createdAt = new Date(item.date_created);
        if (Number.isNaN(createdAt.getTime())) return true;
        return createdAt >= twelveMonthsAgo;
      };

      const userOpas = (allOpas as any[])
        .filter((o: any) => interesseOpaIds.has(o.id))
        .map((o: any) => ({
          ...o,
          bia_id: relationId(o.bia) || relationId(o.bia_id),
          nome_bia_vinculada: allBiaNameMap[relationId(o.bia) || relationId(o.bia_id) || ""] || null,
          interesse_criado_em: interesseDataMap.get(o.id)?.criado_em || null,
          interesse_multiplicador: interesseDataMap.get(o.id)?.multiplicador || null,
        }));

      const normalize = (value: any) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const membroPerfil = await directusFetchOne("cadastro_geral", membroId, "fields=tipos_alianca,tipo_alianca,nucleos_alianca,nucleo_alianca,ramo_atuacao").catch(() => null);
      const areasContribuicao: string[] = [
        ...(Array.isArray(membroPerfil?.tipos_alianca) ? membroPerfil.tipos_alianca : []),
        membroPerfil?.tipo_alianca,
      ].filter(Boolean);
      const userRamosAtuacao = String(membroPerfil?.ramo_atuacao || "")
        .split("; ")
        .map((ramo) => normalize(ramo))
        .filter(Boolean);
      const keywordsForArea = (area: string): string[] => {
        const normalizedArea = normalize(area);
        const rules: Array<[RegExp, string[]]> = [
          [/(lideranca|diretoria)/, ["lideranca"]],
          [/(projeto)/, ["projeto"]],
          [/(juridic)/, ["juridicas", "juridica", "juridico"]],
          [/(inteligencia)/, ["inteligencia"]],
          [/(governanca|integridade|sustentabilidade)/, ["governanca", "integridade", "sustentabilidade"]],
          [/(execucao|construcao)/, ["execucao", "construcao"]],
          [/(fornecimento)/, ["fornecimento"]],
          [/(comerciais|comercial)/, ["comerciais", "comercial"]],
          [/(venda|vendas|locacao)/, ["vendas", "venda", "locacao"]],
          [/(marketing)/, ["marketing"]],
          [/(operacoes|facilities)/, ["operacoes", "facilities"]],
          [/(relacionamento)/, ["relacionamento"]],
          [/(aporte financeiro|investimento)/, ["aporte financeiro", "investimento", "capital"]],
          [/(credito|captacao)/, ["credito", "captacao", "funding", "financiamento"]],
          [/(contabe|contabil|tributari)/, ["contabeis", "contabil", "tributarias", "tributaria"]],
          [/(gestao financeira)/, ["gestao financeira", "financeira"]],
        ];
        const mappedWords = rules
          .filter(([pattern]) => pattern.test(normalizedArea))
          .flatMap(([, keywords]) => keywords);
        return Array.from(new Set(mappedWords));
      };
      const activeAreaKeywords = Array.from(new Set(areasContribuicao.flatMap((area) => keywordsForArea(String(area)))));
      const opasUltimosDozeMeses = (allOpas as any[]).filter(isWithinLastTwelveMonths);
      const convergenciasFull = opasUltimosDozeMeses
        .filter((o: any) => !CLOSED_STATUSES.has(o.status))
        .map((o: any) => ({
          ...o,
          bia_id: relationId(o.bia) || relationId(o.bia_id),
          nome_bia_vinculada: allBiaNameMap[relationId(o.bia) || relationId(o.bia_id) || ""] || null,
          _matchText: normalize([o.tipo, o.ramo_atuacao, o.nucleo_alianca, o.perfil_aliado, o.objetivo_alianca, o.nome_oportunidade].join(" ")),
          _tipoText: normalize(o.tipo),
          _ramoText: normalize(o.ramo_atuacao),
        }))
        .filter((o: any) => {
          const matchTipo = activeAreaKeywords.some((keyword) => o._tipoText.includes(keyword));
          const matchRamo = !!o._ramoText && userRamosAtuacao.some((ramo) => o._ramoText === ramo);
          return matchTipo || matchRamo;
        });
      const convergencias = convergenciasFull
        .slice(0, 6)
        .map(({ _matchText, _tipoText, _ramoText, ...o }: any) => o);

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

      const comunidadeBiaIds = new Set<string>();
      for (const comunidade of userComunidades) {
        const biasRelacionadas = Array.isArray(comunidade.bias) ? comunidade.bias : [];
        for (const rel of biasRelacionadas) {
          const biaId =
            relationId(rel?.bias_projetos_id) ||
            relationId(rel?.bias_id) ||
            relationId(rel?.id) ||
            relationId(rel);
          if (biaId) comunidadeBiaIds.add(biaId);
        }
      }
      if (comunidadeBiaIds.size === 0) {
        userBiaIds.forEach((biaId) => comunidadeBiaIds.add(biaId));
      }

      const classifyAbrangencia = (opa: any) => {
        const text = normalize([opa.tipo, opa.nucleo_alianca, opa.objetivo_alianca, opa.localizacao, opa.pais].join(" "));
        if (/(global|internacional|exterior|fora do brasil|outside brazil)/.test(text)) return "Global";
        if (/(nacional|brasil|brazil)/.test(text)) return "Nacional";
        return "Regional";
      };
      const opasComunidade = (allOpas as any[]).filter((opa: any) => {
        const biaId = relationId(opa.bia) || relationId(opa.bia_id);
        return !!biaId && comunidadeBiaIds.has(biaId);
      });
      const opasPorAbrangencia = ["Regional", "Nacional", "Global"].map((name) => ({
        name,
        value: opasComunidade.filter((opa: any) => classifyAbrangencia(opa) === name).length,
      }));
      const opasTotalPeriodo = opasUltimosDozeMeses.length;
      const dashboardStats = {
        convergencias_total: convergenciasFull.length,
        opas_total_periodo: opasTotalPeriodo,
        interesses_manifestados: meusInteresses.length,
        indice_convergencia: opasTotalPeriodo > 0 ? (convergenciasFull.length / opasTotalPeriodo) * 100 : 0,
        taxa_interesse: convergenciasFull.length > 0 ? (meusInteresses.length / convergenciasFull.length) * 100 : 0,
        opas_comunidade_total: opasComunidade.length,
        opas_por_abrangencia: opasPorAbrangencia,
      };

      function n(v: any) { return parseFloat(String(v ?? "")) || 0; }
      function relId(value: any): string | null {
        if (!value) return null;
        if (typeof value === "object") return value.id ? String(value.id) : null;
        return String(value);
      }

      const aportesPorBia: Record<string, { total: number; porMembro: Record<string, number> }> = {};
      const receitasPorBia: Record<string, Record<string, number>> = {};
      for (const item of fluxoCaixa as any[]) {
        const tipo = String(item.tipo || "").toLowerCase();
        const biaId = relId(item.bia);
        const favorecidoId = relId(item.favorecido_id);
        const valor = n(item.valor);
        if (!biaId || !favorecidoId || valor <= 0) continue;
        if (tipo === "entrada") {
          if (!aportesPorBia[biaId]) aportesPorBia[biaId] = { total: 0, porMembro: {} };
          aportesPorBia[biaId].total += valor;
          aportesPorBia[biaId].porMembro[favorecidoId] = (aportesPorBia[biaId].porMembro[favorecidoId] || 0) + valor;
        }
        if (tipo === "saida") {
          if (!receitasPorBia[biaId]) receitasPorBia[biaId] = {};
          receitasPorBia[biaId][favorecidoId] = (receitasPorBia[biaId][favorecidoId] || 0) + valor;
        }
      }

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
        diretor_alianca: "Dir. de AlianÃ§a",
        diretor_nucleo_tecnico: "Dir. NÃºcleo TÃ©cnico",
        diretor_execucao: "Dir. de ExecuÃ§Ã£o",
        diretor_comercial: "Dir. Comercial",
        diretor_capital: "Dir. de Capital",
      };

      const biasWithRole = userBias.map((b: any) => {
        const papel = BIA_ROLE_FIELDS.find(role => directusRelationId(b[role]) === membroId);
        return { ...b, papel_usuario: papel ? biaRoleMap[papel] : "Membro" };
      });

      res.json({
        bias: userBias.map((b: any) => {
          const papel = BIA_ROLE_FIELDS.find((role) => directusRelationId(b[role]) === membroId);
          const papeis: Record<string, string> = {
            aliado_built: "Aliado BUILT",
            autor_bia: "Autor da BIA",
            diretor_alianca: "Dir. de AlianÃ§a",
            diretor_nucleo_tecnico: "Dir. NÃºcleo TÃ©cnico",
            diretor_execucao: "Dir. de ExecuÃ§Ã£o",
            diretor_comercial: "Dir. Comercial",
            diretor_capital: "Dir. de Capital",
          };
          const alocacao = aportesPorBia[b.id] || { total: 0, porMembro: {} };
          const investimentoUsuarioValor = alocacao.porMembro[membroId] || 0;
          const investimentoUsuarioPercentual = alocacao.total > 0 ? (investimentoUsuarioValor / alocacao.total) * 100 : 0;
          const receitaUsuarioValor = receitasPorBia[b.id]?.[membroId] || 0;
          return {
            ...b,
            papel_usuario: papel ? papeis[papel] : "Membro",
            investimento_usuario_valor: investimentoUsuarioValor,
            investimento_usuario_percentual: investimentoUsuarioPercentual,
            receita_usuario_valor: receitaUsuarioValor,
          };
        }),
        comunidades: userComunidades,
        opas: userOpas,
        convergencias,
        dashboard_stats: dashboardStats,
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
      const visible = items.filter((item: any) => canViewBia(item, req));
      const withCodes = await Promise.all(visible.map((item: any) => ensureBiaPublicCode(item)));
      res.json(resolveAnexosBia(withCodes));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:id", async (req, res) => {
    try {
      const item = await resolveBiaByIdOrPublicCode(req.params.id, "*,Anexos.directus_files_id.*");
      if (!item) return res.status(404).json({ error: "BIA nÃ£o encontrada" });
      if (!canViewBia(item, req)) return res.status(403).json({ error: "VocÃª nÃ£o tem acesso a esta BIA privada" });
      res.json(resolveAnexosBia([item])[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function prepareBiaPayload(body: Record<string, any>): Record<string, any> {
    // Strip private side-channel fields (prefixed with _) before sending to Directus
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => !k.startsWith("_")));
    delete (data as any).codigo_publico;
    for (const field of [
      "diretor_alianca", "diretor_nucleo_tecnico", "diretor_execucao", "diretor_comercial", "diretor_capital",
      "perc_dir_alianca", "perc_dir_tecnico", "perc_dir_obras", "perc_dir_comercial", "perc_dir_capital",
      "socios_multiplicadores", "socios_guardioes",
    ]) {
      delete (data as any)[field];
    }
    if (data.Anexos !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (Array.isArray(data.Anexos) && data.Anexos.every((a: any) => typeof a === "string")) {
        const validIds: string[] = data.Anexos.filter((id: string) => uuidRegex.test(id));
        data.Anexos = validIds.map((fileId: string) => ({ directus_files_id: fileId }));
      }
    }
    for (const field of ["terceiros"]) {
      if (data[field] !== undefined) {
        data[field] = JSON.stringify(parseBiaMemberList(data[field]));
      }
    }
    return data;
  }

  function biaFinancialNumber(value: any): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const BIA_DM_FIELD_MAP = [
    ["perc_autor_opa", "cpp_autor_opa"],
    ["perc_aliado_built", "cpp_aliado_built"],
    ["perc_built", "cpp_built"],
    ["perc_dir_alianca", "cpp_dir_alianca"],
    ["perc_dir_tecnico", "cpp_dir_tecnico"],
    ["perc_dir_obras", "cpp_dir_obras"],
    ["perc_dir_comercial", "cpp_dir_comercial"],
    ["perc_dir_capital", "cpp_dir_capital"],
  ] as const;

  function withUpdatedBiaDm(payload: Record<string, any>, currentBia?: Record<string, any> | null): Record<string, any> {
    const source = { ...(currentBia || {}), ...payload };
    const valorOrigem = biaFinancialNumber(source.valor_origem);
    const round = (value: number) => parseFloat(value.toFixed(2));
    let divisorMultiplicador = 0;
    let cppTotal = 0;
    const calculated: Record<string, number> = {};

    for (const [percentField, cppField] of BIA_DM_FIELD_MAP) {
      const percentual = biaFinancialNumber(source[percentField]);
      const cpp = valorOrigem * percentual / 100;
      divisorMultiplicador += percentual;
      cppTotal += cpp;
      calculated[cppField] = round(cpp);
    }

    return {
      ...payload,
      ...calculated,
      divisor_multiplicador: round(divisorMultiplicador),
      custo_origem_bia: round(valorOrigem + cppTotal),
      custo_final_previsto: round(cppTotal),
    };
  }

  function hasBiaFinancialField(payload: Record<string, any>): boolean {
    return [
      "valor_geral_venda_vgv",
      "valor_realizado_venda",
      "custo_final_previsto",
      "comissao_prevista_corretor",
      "ir_previsto",
      "inss_previsto",
      "manutencao_pos_obra_prevista",
      "comissao_realizada",
      "ir_realizado",
      "inss_realizado",
      "manutencao_realizada",
    ].some((field) => Object.prototype.hasOwnProperty.call(payload, field));
  }

  function withUpdatedBiaFinancials(payload: Record<string, any>, currentBia?: Record<string, any> | null): Record<string, any> {
    if (!hasBiaFinancialField(payload) && !payload.resultado_liquido && !payload.total_receita && !payload.lucro_previsto) {
      return payload;
    }

    const source = { ...(currentBia || {}), ...payload };
    const valorRealizado = biaFinancialNumber(source.valor_realizado_venda);
    const custoFinalPrevisto = biaFinancialNumber(source.custo_final_previsto);
    const pct = (realizadoField: string, previstoField: string) => {
      const hasRealizado = source[realizadoField] !== undefined && source[realizadoField] !== null && source[realizadoField] !== "";
      return biaFinancialNumber(hasRealizado ? source[realizadoField] : source[previstoField]);
    };

    const totalDeducoes =
      ((pct("comissao_realizada", "comissao_prevista_corretor") +
        pct("ir_realizado", "ir_previsto") +
        pct("inss_realizado", "inss_previsto") +
        pct("manutencao_realizada", "manutencao_pos_obra_prevista")) / 100) * valorRealizado;
    const totalReceita = valorRealizado - totalDeducoes;
    const resultadoLiquido = totalReceita - custoFinalPrevisto;
    const lucroPrevisto = valorRealizado > 0 ? (resultadoLiquido / valorRealizado) * 100 : 0;
    const round = (value: number) => parseFloat(value.toFixed(2));

    return {
      ...payload,
      total_receita: round(totalReceita),
      resultado_liquido: round(resultadoLiquido),
      lucro_previsto: round(lucroPrevisto),
    };
  }

  const BIA_DIRETOR_DIRECT_FIELDS = [
    "diretor_alianca",
    "diretor_nucleo_tecnico",
    "diretor_execucao",
    "diretor_comercial",
    "diretor_capital",
    "perc_dir_alianca",
    "perc_dir_tecnico",
    "perc_dir_obras",
    "perc_dir_comercial",
    "perc_dir_capital",
  ];

  function pickBiaDiretorDirectFields(body: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = {};
    for (const field of BIA_DIRETOR_DIRECT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const value = body[field];
      data[field] = value === "" || value === undefined ? null : value;
    }
    return data;
  }

  function pickBiaSocioDirectFields(body: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = {};
    for (const { campoSocios } of SOCIO_SOLICITACAO_CONFIG) {
      if (!Object.prototype.hasOwnProperty.call(body, campoSocios)) continue;
      data[campoSocios] = JSON.stringify(parseBiaMemberList(body[campoSocios]));
    }
    return data;
  }

  async function cancelPendingRequestsForBypassedBia(biaId: string, body: Record<string, any>) {
    const cancellations: Promise<void>[] = [];
    for (const config of DIRETOR_SOLICITACAO_CONFIG) {
      if (Object.prototype.hasOwnProperty.call(body, config.campoDiretor)) {
        cancellations.push(storage.cancelBiaDiretorSolicitacoes(biaId, config.campoDiretor));
      }
    }
    for (const config of SOCIO_SOLICITACAO_CONFIG) {
      if (Object.prototype.hasOwnProperty.call(body, config.campoSocios)) {
        cancellations.push(storage.cancelBiaSocioSolicitacoes(biaId, config.campoSocios));
      }
    }
    const results = await Promise.allSettled(cancellations);
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      console.warn(`[bia-pending-bypass] BIA ${biaId} salva diretamente; ${failed.length} limpeza(s) de pendência não puderam ser concluídas.`);
    }
  }

  app.post("/api/bias", async (req, res) => {
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const sessionNome = (req.session as any).nome as string || "";
      const sessionEmail = (req.session as any).email as string || "";
      const isSuperAdminRole = sessionRole === "admin" || sessionRole === "manager";

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
            if (tiposAlianca.some((tipo) => String(tipo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("lideranca"))) {
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
        return res.status(403).json({ error: "Apenas membros com Selo Aliado BUILT, Ãrea de ContribuiÃ§Ã£o de LideranÃ§a ou administradores podem criar BIAs." });
      }

      // Create the BIA in Directus
      const createBody = { ...req.body };
      if (sessionMembroId && !createBody.autor_bia) createBody.autor_bia = sessionMembroId;
      if (sessionMembroId && !createBody.diretor_alianca) createBody.diretor_alianca = sessionMembroId;
      if (sessionMembroId && (!isSuperAdminRole || !createBody.aliado_built)) {
        let aliadoDaComunidade: string | null = null;
        try {
          const comunidades = await getMembroComunidadesLinks(sessionMembroId);
          const comunidade = comunidades.find((item: any) => item.is_mae) || comunidades[0] || null;
          const aliado = comunidade?.aliado;
          const aliadoId = directusRelationId(aliado);
          if (aliadoId) aliadoDaComunidade = String(aliadoId);
        } catch (_) {}
        if (!isSuperAdminRole && !aliadoDaComunidade) {
          return res.status(400).json({ error: "NÃ£o foi possÃ­vel identificar o Aliado BUILT da sua comunidade." });
        }
        if (aliadoDaComunidade) createBody.aliado_built = aliadoDaComunidade;
      }
      const createPayload = withUpdatedBiaFinancials(withUpdatedBiaDm(prepareBiaPayload(createBody), null), null);
      createPayload.codigo_publico = await createUniqueBiaPublicCode();
      let item = await directusCreate("bias_projetos", createPayload);
      let diretorFlowError: string | null = null;
      const diretorSolicitacoes = await processDiretorSolicitacoes({
        biaId: item.id,
        biaNome: item.nome_bia || createBody.nome_bia || null,
        body: createBody,
        payload: createPayload,
        req,
        currentBia: null,
      }).catch((e: any) => {
        console.error("[bia-diretores] failed to create requests:", e.message);
        diretorFlowError = e.message;
        return [];
      });
      if (diretorFlowError) {
        const diretorFallbackPayload = pickBiaDiretorDirectFields(createBody);
        if (Object.keys(diretorFallbackPayload).length > 0) {
          try {
            item = await directusUpdate("bias_projetos", item.id, diretorFallbackPayload);
          } catch (fallbackErr: any) {
            console.error("[bia-diretores] failed to save direct fallback fields:", fallbackErr.message);
          }
        }
      }
      const socioSolicitacoes = await processSocioSolicitacoes({
        biaId: item.id,
        biaNome: item.nome_bia || createBody.nome_bia || null,
        body: createBody,
        req,
        currentBia: null,
      }).catch((e: any) => {
        console.error("[bia-socios] failed to create requests:", e.message);
        return [];
      });
      const valorOrigem = parseFloat(createBody.valor_origem) || 0;
      if (valorOrigem > 0) {
        syncValorOrigemLancamento(item.id, valorOrigem).catch(console.error);
      }

      // If Diretor de AlianÃ§a (not Aliado BUILT), create pending approval record
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
          return res.json({ ...item, _aprovacao_pendente: true, _aprovacao_id: aprovacao.id, _diretor_solicitacoes: diretorSolicitacoes.length, _diretor_flow_error: diretorFlowError, _socio_solicitacoes: socioSolicitacoes.length });
        } catch (aprovErr: any) {
          console.error("[bia-aprovacao] Failed to create approval record:", aprovErr.message);
          // BIA was created â€” return it even if approval record failed
        }
      }

      res.json({ ...item, _diretor_solicitacoes: diretorSolicitacoes.length, _diretor_flow_error: diretorFlowError, _socio_solicitacoes: socioSolicitacoes.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bias/:id", async (req, res) => {
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const isSuperAdminRole =
        sessionRole === "admin" ||
        sessionRole === "manager" ||
        sessionRole === "superadmin" ||
        sessionRole === "master" ||
        isBootstrapSuperAdmin((req.session as any).email);
      let payload = prepareBiaPayload(req.body);
      const currentBia = await resolveBiaByIdOrPublicCode(
        req.params.id,
        "id,codigo_publico,nome_bia,autor_bia,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital,perc_autor_opa,perc_aliado_built,perc_built,perc_dir_alianca,perc_dir_tecnico,perc_dir_obras,perc_dir_comercial,perc_dir_capital,socios_guardioes,socios_multiplicadores,terceiros,valor_origem,valor_realizado_venda,custo_final_previsto,comissao_prevista_corretor,ir_previsto,inss_previsto,manutencao_pos_obra_prevista,comissao_realizada,ir_realizado,inss_realizado,manutencao_realizada,total_receita,resultado_liquido,lucro_previsto"
      ).catch(() => null);
      if (!currentBia?.id) return res.status(404).json({ error: "BIA nÃ£o encontrada" });
      const biaUpdateId = String(currentBia.id);
      const originPatch = normalizeBiaOriginPatch(req.body);
      if (originPatch.error) return res.status(400).json({ error: originPatch.error });
      if (originPatch.shouldUpdate) {
        payload.valor_origem = originPatch.value;
      } else if (originPatch.provided) {
        // Formularios de outras areas nao podem apagar um valor financeiro ja salvo.
        delete payload.valor_origem;
      }
      const aliadoAtual = directusRelationId(currentBia?.aliado_built) || currentBia?.aliado_built || null;
      const analysisFields = new Set([
        "valor_geral_venda_vgv", "valor_realizado_venda", "comissao_prevista_corretor",
        "ir_previsto", "inss_previsto", "manutencao_pos_obra_prevista", "comissao_realizada",
        "ir_realizado", "inss_realizado", "manutencao_realizada", "total_receita",
        "resultado_liquido", "lucro_previsto",
      ]);
      const calculatorFields = new Set([
        "valor_origem", "divisor_multiplicador", "perc_autor_opa", "perc_aliado_built",
        "perc_built", "perc_dir_alianca", "perc_dir_tecnico", "perc_dir_obras",
        "perc_dir_comercial", "perc_dir_capital", "cpp_autor_opa", "cpp_aliado_built",
        "cpp_built", "cpp_dir_alianca", "cpp_dir_tecnico", "cpp_dir_obras",
        "cpp_dir_comercial", "cpp_dir_capital", "custo_origem_bia", "custo_final_previsto",
      ]);
      const requestedFields = Object.keys(req.body || {}).filter((field) =>
        !field.startsWith("_") && !(field === "valor_origem" && !originPatch.shouldUpdate)
      );
      const requiredModules = new Set<BiaAccessKey>();
      if (requestedFields.some((field) => analysisFields.has(field))) requiredModules.add("capital_analises");
      if (requestedFields.some((field) => calculatorFields.has(field))) requiredModules.add("capital_calculadora");
      if (requestedFields.some((field) => !analysisFields.has(field) && !calculatorFields.has(field))) {
        requiredModules.add("configuracao_bia");
      }
      if (requiredModules.size === 0) requiredModules.add("configuracao_bia");
      const resolvedAccess = await resolveBiaAccessForRequest(currentBia, req);
      const deniedModule = Array.from(requiredModules).find((module) => !hasBiaAccess(resolvedAccess.permissions, module, "edit"));
      if (deniedModule) {
        return res.status(403).json({
          error: "Voce nao tem permissao para salvar alteracoes nesta area da BIA.",
          code: "BIA_ACCESS_DENIED",
          module: deniedModule,
        });
      }
      if (!isSuperAdminRole && Object.prototype.hasOwnProperty.call(payload, "aliado_built")) {
        if (aliadoAtual) {
          (payload as any).aliado_built = aliadoAtual;
        } else {
          delete (payload as any).aliado_built;
        }
      }
      let diretorSolicitacoes: any[] = [];
      let socioSolicitacoes: any[] = [];
      let diretorFlowError: string | null = null;
      const pendingFlowBypassed = isBiaPendingBypassed(currentBia, req.params.id);
      if (isSuperAdminRole || pendingFlowBypassed) {
        Object.assign(payload, pickBiaDiretorDirectFields(req.body));
      } else {
        try {
          const payloadComSolicitacoes = { ...payload };
          diretorSolicitacoes = await processDiretorSolicitacoes({
            biaId: biaUpdateId,
            biaNome: currentBia?.nome_bia || req.body.nome_bia || null,
            body: req.body,
            payload: payloadComSolicitacoes,
            req,
            currentBia,
          });
          payload = payloadComSolicitacoes;
        } catch (e: any) {
          console.error("[bia-diretores] failed to process requests; saving direct BIA fields instead:", e.message);
          diretorFlowError = e.message;
          Object.assign(payload, pickBiaDiretorDirectFields(req.body));
        }
      }
      if (pendingFlowBypassed) {
        Object.assign(payload, pickBiaSocioDirectFields(req.body));
        await cancelPendingRequestsForBypassedBia(biaUpdateId, req.body);
      } else {
        try {
          socioSolicitacoes = await processSocioSolicitacoes({
            biaId: biaUpdateId,
            biaNome: currentBia?.nome_bia || req.body.nome_bia || null,
            body: req.body,
            req,
            payload,
            currentBia,
          });
        } catch (e: any) {
          console.error("[bia-socios] failed to process requests:", e.message);
        }
      }
      payload = withUpdatedBiaDm(payload, currentBia);
      payload = withUpdatedBiaFinancials(payload, currentBia);

      let lastError: any = null;
      const newlySkipped: string[] = [];
      const genericRetryFields = ["Anexos", "socios_multiplicadores", "socios_guardioes", "terceiros"];
      const extractRejectedFields = (parsed: any): string[] => {
        const fields = new Set<string>();
        for (const error of parsed?.errors || []) {
          const code = error?.extensions?.code;
          const field = error?.extensions?.field;
          if (field && (code === "VALUE_OUT_OF_RANGE" || code === "INVALID_PAYLOAD" || code === "FORBIDDEN")) {
            fields.add(String(field));
          }
          if (code === "INVALID_PAYLOAD" || code === "FORBIDDEN") {
            const message = String(error?.message || "");
            const match = message.match(/(?:field|Field)\s+"([^"]+)"/);
            if (match?.[1]) fields.add(match[1]);
          }
        }
        return Array.from(fields).filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
      };
      const maxAttempts = Object.keys(payload).length + 5;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const item = await directusUpdate("bias_projetos", biaUpdateId, payload);
          if (newlySkipped.length > 0) console.log(`[bias patch] discovered blocked fields: ${newlySkipped.join(", ")}`);
          if (originPatch.shouldUpdate) {
            const valorOrigem = originPatch.value ?? 0;
            const vencimentoOrigem = req.body._vencimento_origem || null;
            const numeroParcelas = req.body._numero_parcelas ? parseInt(req.body._numero_parcelas) : null;
            const vencimentosParcelas: string[] = Array.isArray(req.body._vencimentos_parcelas) ? req.body._vencimentos_parcelas : [];
            const valoresParcelas: number[] = Array.isArray(req.body._valores_parcelas) ? req.body._valores_parcelas.map(Number) : [];
            const aliadoCppId =
              directusRelationId(item.aliado_built) ||
              directusRelationId(currentBia?.aliado_built) ||
              directusRelationId(req.body.aliado_built) ||
              item.aliado_built ||
              currentBia?.aliado_built ||
              req.body.aliado_built ||
              null;
            const savedBia = { ...(currentBia || {}), ...payload, ...(item || {}) };
            const hasSavedField = (field: string) =>
              Object.prototype.hasOwnProperty.call(payload, field) ||
              Object.prototype.hasOwnProperty.call(item || {}, field) ||
              Object.prototype.hasOwnProperty.call(currentBia || {}, field);
            const savedPercent = (field: string) => {
              const sourceValue = Object.prototype.hasOwnProperty.call(payload, field)
                ? payload[field]
                : Object.prototype.hasOwnProperty.call(item || {}, field)
                  ? item[field]
                  : currentBia?.[field];
              if (!hasSavedField(field) || sourceValue === null || sourceValue === undefined || sourceValue === "") return 0;
              const parsed = Number(String(sourceValue).replace(",", "."));
              return Number.isFinite(parsed) ? parsed : 0;
            };
            const savedMemberId = (field: string) =>
              directusRelationId(savedBia[field]) || savedBia[field] || null;
            const savedMemberPercent = (memberField: string, percentField: string) =>
              savedMemberId(memberField) ? savedPercent(percentField) : 0;
            // Build contributors list for CPP entries
            const contributors: CppContributor[] = [
              {
                label: "Autor da Oportunidade",
                memberId: savedMemberId("autor_bia"),
                percentual: savedMemberPercent("autor_bia", "perc_autor_opa"),
              },
              { label: "Aliado BUILT", memberId: aliadoCppId, percentual: aliadoCppId ? savedPercent("perc_aliado_built") : 0 },
              { label: "BUILT", memberId: null, percentual: savedPercent("perc_built"), alwaysCreate: true },
              { label: "Dir. de AlianÃ§a", memberId: savedMemberId("diretor_alianca"), percentual: savedMemberPercent("diretor_alianca", "perc_dir_alianca"), isAporte: true },
              { label: "Dir. NÃºcleo TÃ©cnico", memberId: savedMemberId("diretor_nucleo_tecnico"), percentual: savedMemberPercent("diretor_nucleo_tecnico", "perc_dir_tecnico"), isAporte: true },
              { label: "Dir. NÃºcleo de Obra", memberId: savedMemberId("diretor_execucao"), percentual: savedMemberPercent("diretor_execucao", "perc_dir_obras"), isAporte: true },
              { label: "Dir. NÃºcleo Comercial", memberId: savedMemberId("diretor_comercial"), percentual: savedMemberPercent("diretor_comercial", "perc_dir_comercial"), isAporte: true },
              { label: "Dir. NÃºcleo de Capital", memberId: savedMemberId("diretor_capital"), percentual: savedMemberPercent("diretor_capital", "perc_dir_capital"), isAporte: true },
            ];
            try {
              const cppSummary = await syncValorOrigemLancamento(biaUpdateId, valorOrigem, vencimentoOrigem, numeroParcelas, vencimentosParcelas, valoresParcelas, contributors);
              return res.json({ ...item, _cppSummary: cppSummary, _diretor_solicitacoes: diretorSolicitacoes.length, _diretor_flow_error: diretorFlowError, _socio_solicitacoes: socioSolicitacoes.length });
            } catch (syncErr: any) {
              console.error("[sync fluxo_caixa] error:", syncErr.message);
              return res.json({ ...item, _cppSummary: null, _cppError: syncErr.message, _diretor_solicitacoes: diretorSolicitacoes.length, _diretor_flow_error: diretorFlowError, _socio_solicitacoes: socioSolicitacoes.length });
            }
          }
          return res.json({ ...item, _diretor_solicitacoes: diretorSolicitacoes.length, _diretor_flow_error: diretorFlowError, _socio_solicitacoes: socioSolicitacoes.length });
        } catch (err: any) {
          const msg: string = err.message || "";
          let parsed: any = null;
          try {
            const jsonStr = msg.replace(/^Directus update error \d+: /, "");
            parsed = JSON.parse(jsonStr);
          } catch {}
          const rejectedFields = extractRejectedFields(parsed);
          const retryableRejectedFields = rejectedFields.filter((field) =>
            genericRetryFields.includes(field) || (isSuperAdminRole && BIA_DM_PERCENT_FIELDS.has(field))
          );
          const requiredRejectedFields = rejectedFields.filter((field) => !retryableRejectedFields.includes(field));
          const isInternalDirectusError = (parsed?.errors || []).some((e: any) =>
            e.extensions?.code === "INTERNAL_SERVER_ERROR" || /unexpected error/i.test(e.message || "")
          );
          if (rejectedFields.length === 0) {
            if (isInternalDirectusError) {
              const retryField = genericRetryFields.find((field) => Object.prototype.hasOwnProperty.call(payload, field));
              if (retryField) {
                newlySkipped.push(retryField);
                delete (payload as any)[retryField];
                lastError = err;
                continue;
              }
            }
            lastError = err;
            break;
          }
          // Core fields must never be silently discarded after a Directus error.
          // Nullable team fields such as autor_bia need to reach Directus on every save.
          if (requiredRejectedFields.length > 0) {
            lastError = err;
            break;
          }
          for (const f of retryableRejectedFields) {
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await directusFetchOne("bias_projetos", req.params.id, "fields=id,aliado_built");
      if (!bia) return res.status(404).json({ error: "BIA nao encontrada" });
      if (!(await canDeleteBia(req, bia))) {
        return res.status(403).json({ error: "Apenas Aliados BUILT ou superadmin podem deletar BIAs." });
      }
      await directusDelete("bias_projetos", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:id/access-control", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await resolveBiaByIdOrPublicCode(req.params.id, "*");
      if (!bia?.id) return res.status(404).json({ error: "BIA nao encontrada" });
      if (!canViewBia(bia, req)) return res.status(403).json({ error: "Voce nao tem acesso a esta BIA" });

      const current = await resolveBiaAccessForRequest(bia, req);
      const response: any = {
        bia_id: String(bia.id),
        can_manage: current.canManage,
        storage_available: current.storageAvailable,
        current: {
        membro_id: (req.session as any)?.membroId || null,
          roles: current.roles,
          permissions: current.permissions,
          default_permissions: current.defaultPermissions,
          customized: current.customized,
          is_participant: current.isParticipant,
          is_bypass: current.isBypass,
        },
      };

      if (current.canManage) {
        const rolesByMember = collectBiaParticipantRoles(bia);
        let overrides: any[] = [];
        let storageAvailable = true;
        try {
          overrides = await db.select().from(biaUserPermissions)
            .where(eq(biaUserPermissions.bia_id, String(bia.id)));
        } catch (error: any) {
          storageAvailable = false;
          console.warn("[bia-access] lista de personalizacoes indisponivel:", error?.message || error);
        }
        response.storage_available = storageAvailable;
        const overridesByMember = new Map(overrides.map((row) => [String(row.membro_id), row]));
        const configurableParticipants = Array.from(rolesByMember.entries())
          .filter(([, roles]) => canConfigureBiaParticipantAccess(roles));
        response.participants = await Promise.all(configurableParticipants.map(async ([membroId, roles]) => {
          const override = overridesByMember.get(membroId) || null;
          const member = await directusFetchOne("cadastro_geral", membroId).catch(() => null);
          const defaultPermissions = defaultBiaAccessForRoles(roles);
          return {
            membro_id: membroId,
            nome: member?.Nome_de_usuario || member?.nome || member?.nome_completo || membroId,
            email: member?.email || null,
            avatar_url: assetApiUrl(member?.foto || member?.avatar),
            roles,
            role_labels: roles.map((role) => BIA_PARTICIPANT_ROLE_LABELS[role]),
            default_permissions: defaultPermissions,
            permissions: effectiveParticipantPermissions(roles, override, storageAvailable),
            customized: Boolean(override),
            updated_at: override?.updated_at || null,
            updated_by_nome: override?.updated_by_nome || null,
          };
        }));
      }
      return res.json(response);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/bias/:id/access-control/:membroId", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await resolveBiaByIdOrPublicCode(req.params.id, "*");
      if (!bia?.id) return res.status(404).json({ error: "BIA nao encontrada" });
      const manager = await resolveBiaAccessForRequest(bia, req);
      if (!manager.canManage) return res.status(403).json({ error: "Apenas gestores da BIA podem administrar acessos." });

      const targetId = String(req.params.membroId);
      const targetRoles = collectBiaParticipantRoles(bia).get(targetId) || [];
      if (targetRoles.length === 0) {
        return res.status(400).json({ error: "Este membro nao participa mais desta BIA." });
      }
      if (!canConfigureBiaParticipantAccess(targetRoles)) {
        return res.status(400).json({ error: "Terceiros vinculados nao possuem permissoes internas configuraveis." });
      }
      const input = req.body?.permissions ?? req.body;
      const keys = input && typeof input === "object" ? Object.keys(input) : [];
      const isComplete = keys.length === BIA_ACCESS_KEYS.length
        && BIA_ACCESS_KEYS.every((key) => Object.prototype.hasOwnProperty.call(input, key) && isBiaAccessLevel(input[key]));
      if (!isComplete || keys.some((key) => !BIA_ACCESS_KEYS.includes(key as BiaAccessKey))) {
        return res.status(400).json({ error: "Envie a matriz completa com niveis none, view ou edit." });
      }
      const permissions = normalizeBiaAccessMatrix(input);
      const [saved] = await db.insert(biaUserPermissions).values({
        bia_id: String(bia.id),
        membro_id: targetId,
        permissions,
        updated_by_user_id: String((req.session as any).directusUserId || "") || null,
        updated_by_membro_id: (req.session as any).membroId || null,
        updated_by_nome: (req.session as any).nome || (req.session as any).email || null,
      }).onConflictDoUpdate({
        target: [biaUserPermissions.bia_id, biaUserPermissions.membro_id],
        set: {
          permissions,
          updated_by_user_id: String((req.session as any).directusUserId || "") || null,
          updated_by_membro_id: (req.session as any).membroId || null,
          updated_by_nome: (req.session as any).nome || (req.session as any).email || null,
          updated_at: new Date(),
        },
      }).returning();
      return res.json({
        ...saved,
        permissions: effectiveParticipantPermissions(targetRoles, saved, true),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bias/:id/access-control/:membroId", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await resolveBiaByIdOrPublicCode(req.params.id, "*");
      if (!bia?.id) return res.status(404).json({ error: "BIA nao encontrada" });
      const manager = await resolveBiaAccessForRequest(bia, req);
      if (!manager.canManage) return res.status(403).json({ error: "Apenas gestores da BIA podem administrar acessos." });
      const targetId = String(req.params.membroId);
      const targetRoles = collectBiaParticipantRoles(bia).get(targetId) || [];
      if (targetRoles.length === 0) return res.status(400).json({ error: "Este membro nao participa mais desta BIA." });
      if (!canConfigureBiaParticipantAccess(targetRoles)) {
        return res.status(400).json({ error: "Terceiros vinculados nao possuem permissoes internas configuraveis." });
      }
      await db.delete(biaUserPermissions).where(and(
        eq(biaUserPermissions.bia_id, String(bia.id)),
        eq(biaUserPermissions.membro_id, targetId),
      ));
      return res.json({
        success: true,
        permissions: effectiveParticipantPermissions(targetRoles, null, true),
        default_permissions: defaultBiaAccessForRoles(targetRoles),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ========== BIA BANCO / PINBANK ==========

  const pinbank = new PinbankClient();
  const REQUIRED_BIA_BANK_DOCS = ["cartao_cnpj", "contrato_social", "comprovante_endereco_comercial"];
  const REQUIRED_SOCIO_BANK_DOCS = ["documento_identificacao", "selfie_documento", "comprovante_endereco_residencial"];
  const memoryBiaBankAccounts = new Map<string, any>();
  const memoryBiaBankDocuments = new Map<string, any[]>();
  const memoryBiaBankCharges = new Map<string, any[]>();

  const normalizeBankAccount = (row: any) => row ? {
    id: row.id,
    bia_id: row.bia_id,
    provider: row.provider,
    external_account_id: row.external_account_id,
    status: row.status,
    terms_version: row.terms_version,
    terms_accepted_at: row.terms_accepted_at,
    terms_acceptance_location: row.terms_acceptance_location || null,
    onboarding_requested_at: row.onboarding_requested_at,
    provider_payload: row.provider_payload || null,
  } : null;

  const normalizeBankCharge = (row: any) => row ? {
    id: row.id,
    bia_id: row.bia_id,
    fluxo_caixa_id: row.fluxo_caixa_id || null,
    provider: row.provider || row.pagamento_provider || "pinbank",
    type: row.type || row.pagamento_tipo || "boleto",
    status: row.status || row.pagamento_status || "pending",
    descricao: row.descricao || null,
    valor: row.valor ?? null,
    data_vencimento: row.data_vencimento || null,
    pagador_nome: row.pagador_nome || row.pagamento_pagador_nome || null,
    pagador_email: row.pagador_email || row.pagamento_pagador_email || null,
    pagador_documento: row.pagador_documento || row.pagamento_pagador_documento || null,
    nosso_numero: row.nosso_numero || null,
    payment_id: row.payment_id || row.pagamento_id || null,
    payment_url: row.payment_url || row.pagamento_url || null,
    linha_digitavel: row.linha_digitavel || null,
    provider_payload: row.provider_payload || null,
    created_at: row.created_at || row.pagamento_gerado_em || null,
  } : null;

  async function requireBiaBancoAccess(req: any, res: any, biaId: string) {
    const required = String(req.method || "GET").toUpperCase() === "GET" ? "view" : "edit";
    const authorization = await requireBiaModuleAccess(req, res, biaId, "capital_banco", required);
    return authorization?.bia || null;
  }

  function memoryBankAccount(biaId: string, patch: Record<string, any> = {}) {
    const current = memoryBiaBankAccounts.get(biaId) || {
      id: `memory-${biaId}`,
      bia_id: biaId,
      provider: "pinbank",
      external_account_id: null,
      status: "not_started",
      terms_version: null,
      terms_accepted_at: null,
      terms_accepted_by_user_id: null,
      terms_accepted_by_membro_id: null,
      terms_accepted_by_nome: null,
      terms_acceptance_location: null,
      onboarding_requested_at: null,
      onboarding_payload: null,
      provider_payload: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const next = { ...current, ...patch, updated_at: new Date().toISOString() };
    memoryBiaBankAccounts.set(biaId, next);
    return next;
  }

  function memoryBankDocuments(biaId: string) {
    return memoryBiaBankDocuments.get(biaId) || [];
  }

  function setMemoryBankDocument(biaId: string, document: any) {
    const documents = memoryBankDocuments(biaId);
    const index = documents.findIndex((item) => String(item.id) === String(document.id));
    const next = index >= 0
      ? documents.map((item) => String(item.id) === String(document.id) ? { ...item, ...document, updated_at: new Date().toISOString() } : item)
      : [{ ...document, created_at: document.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }, ...documents];
    memoryBiaBankDocuments.set(biaId, next);
    return next.find((item) => String(item.id) === String(document.id)) || document;
  }

  function memoryBankCharges(biaId: string) {
    return memoryBiaBankCharges.get(biaId) || [];
  }

  function setMemoryBankCharge(biaId: string, charge: any) {
    const charges = memoryBankCharges(biaId);
    const id = String(charge.id || `memory-charge-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const normalized = { ...charge, id, bia_id: biaId, updated_at: new Date().toISOString() };
    const index = charges.findIndex((item) => String(item.id) === id);
    const next = index >= 0
      ? charges.map((item) => String(item.id) === id ? { ...item, ...normalized } : item)
      : [{ ...normalized, created_at: normalized.created_at || new Date().toISOString() }, ...charges];
    memoryBiaBankCharges.set(biaId, next);
    return next.find((item) => String(item.id) === id) || normalized;
  }

  async function getBiaBankAccount(biaId: string) {
    try {
      const result: any = await db.execute(sql`SELECT * FROM bia_bank_accounts WHERE bia_id = ${biaId} LIMIT 1`);
      return result.rows?.[0] || memoryBiaBankAccounts.get(biaId) || null;
    } catch (error: any) {
      console.warn("[bia-banco] Banco local indisponivel; usando memoria:", error?.message || error);
      return memoryBiaBankAccounts.get(biaId) || null;
    }
  }

  async function ensureBiaBankAccount(biaId: string) {
    const existing = await getBiaBankAccount(biaId);
    if (existing) return existing;
    try {
      const result: any = await db.execute(sql`
        INSERT INTO bia_bank_accounts (bia_id, status)
        VALUES (${biaId}, 'not_started')
        ON CONFLICT (bia_id) DO UPDATE SET updated_at = now()
        RETURNING *
      `);
      return result.rows?.[0] || memoryBankAccount(biaId);
    } catch (error: any) {
      console.warn("[bia-banco] Nao foi possivel criar conta local; usando memoria:", error?.message || error);
      return memoryBankAccount(biaId);
    }
  }

  async function getBiaBankDocuments(biaId: string) {
    try {
      const result: any = await db.execute(sql`
        SELECT * FROM bia_bank_documents
        WHERE bia_id = ${biaId}
        ORDER BY created_at DESC
      `);
      const rows = result.rows || [];
      if (rows.length > 0) memoryBiaBankDocuments.set(biaId, rows);
      return rows.length > 0 ? rows : memoryBankDocuments(biaId);
    } catch (error: any) {
      console.warn("[bia-banco] Documentos locais indisponiveis; usando memoria:", error?.message || error);
      return memoryBankDocuments(biaId);
    }
  }

  async function getBiaBankCharges(biaId: string) {
    let localCharges: any[] = [];
    try {
      const result: any = await db.execute(sql`
        SELECT * FROM bia_bank_charges
        WHERE bia_id = ${biaId}
        ORDER BY created_at DESC
      `);
      localCharges = (result.rows || []).map(normalizeBankCharge).filter(Boolean);
      if (localCharges.length > 0) memoryBiaBankCharges.set(biaId, localCharges);
    } catch (error: any) {
      console.warn("[bia-banco] Cobrancas locais indisponiveis; usando memoria:", error?.message || error);
      localCharges = memoryBankCharges(biaId).map(normalizeBankCharge).filter(Boolean);
    }
    const fluxoCharges = (await listBiaBankPayments(biaId)).map((item: any) => normalizeBankCharge({
      ...item,
      id: `fluxo-${item.id}`,
      bia_id: biaId,
      fluxo_caixa_id: item.id,
      provider: item.pagamento_provider,
      status: item.pagamento_status,
      payment_id: item.pagamento_id,
      payment_url: item.pagamento_url,
      created_at: item.pagamento_gerado_em,
    })).filter(Boolean);
    const seen = new Set<string>();
    return [...localCharges, ...fluxoCharges].filter((charge: any) => {
      const key = String(charge.id || charge.payment_id || charge.payment_url || Math.random());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getBankDocumentMissing(documents: any[]) {
    const tipos = new Set(documents.map((doc) => String(doc.tipo || "")));
    return [
      ...REQUIRED_BIA_BANK_DOCS.filter((tipo) => !tipos.has(tipo)),
      ...REQUIRED_SOCIO_BANK_DOCS.filter((tipo) => !tipos.has(tipo)),
    ];
  }

  async function listBiaBankPayments(biaId: string) {
    try {
      const items = await directusFetchScoped(
        "fluxo_caixa",
        `fields=id,descricao,valor,data_vencimento,status,pagamento_provider,pagamento_id,pagamento_url,pagamento_status,pagamento_gerado_em&filter[bia][_eq]=${encodeURIComponent(biaId)}`
      );
      return (items || []).filter((item: any) => item.pagamento_url || item.pagamento_id || item.pagamento_status);
    } catch (error: any) {
      console.warn("[bia-banco] Nao foi possivel listar cobrancas do fluxo:", error?.message || error);
      return [];
    }
  }

  function bankMoneyToNumber(value: any) {
    if (typeof value === "number") return value;
    const raw = String(value || "").replace(/[R$\s]/g, "").trim();
    if (!raw) return 0;
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
    return Number(raw);
  }

  function normalizeBankDate(value: any) {
    if (!value) return null;
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function resolvePinbankCodigoCliente(account: any) {
    return Number(account?.external_account_id || pinbank.defaultCodigoCliente || 0) || 0;
  }

  function buildPinbankChargePayload(req: any, account: any): PinbankChargePayload {
    const valor = bankMoneyToNumber(req.body?.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error("Informe um valor valido para a cobranca.");
    }
    return {
      codigoCliente: resolvePinbankCodigoCliente(account),
      codigoCanal: pinbank.defaultCodigoCanal,
      valor,
      vencimento: normalizeBankDate(req.body?.vencimento || req.body?.data_vencimento),
      descricao: String(req.body?.descricao || "Aporte BIA BUILT").trim(),
      pagadorNome: String(req.body?.pagadorNome || req.body?.pagador_nome || "").trim(),
      pagadorDocumento: String(req.body?.pagadorDocumento || req.body?.pagador_documento || "").trim(),
      pagadorEmail: String(req.body?.pagadorEmail || req.body?.pagador_email || "").trim(),
      pagadorTelefone: String(req.body?.pagadorTelefone || req.body?.pagador_telefone || "").trim(),
      split: Array.isArray(req.body?.split) ? req.body.split : undefined,
      metadata: {
        biaId: req.params.biaId,
        fluxoCaixaId: req.body?.fluxoCaixaId || req.body?.fluxo_caixa_id || null,
        origem: "built_bia_banco",
      },
    };
  }

  function buildPinbankChargeQuery(account: any, charge?: any, extra: Record<string, any> = {}): PinbankChargeQueryPayload {
    return {
      codigoCliente: resolvePinbankCodigoCliente(account),
      codigoCanal: pinbank.defaultCodigoCanal,
      nossoNumero: charge?.nosso_numero || charge?.nossoNumero || extra.nossoNumero || null,
      paymentId: charge?.payment_id || charge?.paymentId || charge?.externalId || extra.paymentId || null,
      chargeId: charge?.id || extra.chargeId || null,
      dataInicio: extra.dataInicio || null,
      dataFim: extra.dataFim || null,
      transactionId: extra.transactionId || null,
      metadata: extra.metadata,
    };
  }

  async function saveBiaBankCharge(params: {
    biaId: string;
    fluxoCaixaId?: string | null;
    type: string;
    payload: PinbankChargePayload;
    providerResult: any;
    actor?: ReturnType<typeof getAuditActor>;
  }) {
    const result = params.providerResult || {};
    const status = String(result.status || result.raw?.Data?.Status || "pending");
    const chargeData = {
      id: randomUUID(),
      bia_id: params.biaId,
      fluxo_caixa_id: params.fluxoCaixaId || null,
      provider: "pinbank",
      type: params.type,
      status,
      descricao: params.payload.descricao || null,
      valor: params.payload.valor,
      data_vencimento: normalizeBankDate(params.payload.vencimento),
      pagador_nome: params.payload.pagadorNome || null,
      pagador_email: params.payload.pagadorEmail || null,
      pagador_documento: params.payload.pagadorDocumento || null,
      nosso_numero: result.nossoNumero || null,
      payment_id: result.externalId || null,
      payment_url: result.url || null,
      linha_digitavel: result.linhaDigitavel || null,
      payload: params.payload,
      provider_payload: result,
      created_by_user_id: params.actor?.userId || null,
      created_by_membro_id: params.actor?.membroId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let saved: any = null;
    try {
      const dbResult: any = await db.execute(sql`
        INSERT INTO bia_bank_charges (
          id, bia_id, fluxo_caixa_id, provider, type, status, descricao, valor, data_vencimento,
          pagador_nome, pagador_email, pagador_documento, nosso_numero, payment_id, payment_url,
          linha_digitavel, payload, provider_payload, created_by_user_id, created_by_membro_id, updated_at
        )
        VALUES (
          ${chargeData.id}, ${chargeData.bia_id}, ${chargeData.fluxo_caixa_id}, ${chargeData.provider}, ${chargeData.type},
          ${chargeData.status}, ${chargeData.descricao}, ${String(chargeData.valor)}, ${chargeData.data_vencimento},
          ${chargeData.pagador_nome}, ${chargeData.pagador_email}, ${chargeData.pagador_documento},
          ${chargeData.nosso_numero}, ${chargeData.payment_id}, ${chargeData.payment_url}, ${chargeData.linha_digitavel},
          ${JSON.stringify(chargeData.payload)}::jsonb, ${JSON.stringify(chargeData.provider_payload)}::jsonb,
          ${chargeData.created_by_user_id}, ${chargeData.created_by_membro_id}, now()
        )
        RETURNING *
      `);
      saved = dbResult.rows?.[0] || null;
    } catch (error: any) {
      console.warn("[bia-banco] Cobranca gravada em memoria:", error?.message || error);
    }
    if (!saved) saved = setMemoryBankCharge(params.biaId, chargeData);
    if (params.fluxoCaixaId) {
      await directusUpdate("fluxo_caixa", params.fluxoCaixaId, {
        pagamento_provider: "pinbank",
        pagamento_id: chargeData.payment_id,
        pagamento_url: chargeData.payment_url,
        pagamento_status: chargeData.status,
        pagamento_pais: "brasil",
        pagamento_pagador_nome: chargeData.pagador_nome,
        pagamento_pagador_email: chargeData.pagador_email,
        pagamento_pagador_documento: chargeData.pagador_documento,
        pagamento_gerado_em: new Date().toISOString(),
      }).catch((error: any) => console.warn("[bia-banco] Fluxo de caixa nao atualizado com cobranca PINBANK:", error?.message || error));
    }
    return normalizeBankCharge(saved);
  }

  async function updateBiaBankCharge(biaId: string, chargeId: string, patch: Record<string, any>) {
    let updated: any = null;
    try {
      const result: any = await db.execute(sql`
        UPDATE bia_bank_charges
        SET status = COALESCE(${patch.status || null}, status),
            payment_url = COALESCE(${patch.payment_url || null}, payment_url),
            provider_payload = COALESCE(${patch.provider_payload ? JSON.stringify(patch.provider_payload) : null}::jsonb, provider_payload),
            updated_at = now()
        WHERE id = ${chargeId} AND bia_id = ${biaId}
        RETURNING *
      `);
      updated = result.rows?.[0] || null;
    } catch (error: any) {
      console.warn("[bia-banco] Cobranca atualizada em memoria:", error?.message || error);
    }
    if (!updated) {
      const current = memoryBankCharges(biaId).find((item) => String(item.id) === String(chargeId));
      if (current) updated = setMemoryBankCharge(biaId, { ...current, ...patch });
    }
    if (updated?.fluxo_caixa_id && patch.status) {
      await directusUpdate("fluxo_caixa", updated.fluxo_caixa_id, { pagamento_status: patch.status })
        .catch((error: any) => console.warn("[bia-banco] Status do fluxo nao atualizado:", error?.message || error));
    }
    return normalizeBankCharge(updated);
  }

  async function findBiaBankCharge(biaId: string, chargeId: string) {
    const charges = await getBiaBankCharges(biaId);
    return charges.find((item: any) => String(item.id) === String(chargeId) || String(item.payment_id) === String(chargeId)) || null;
  }

  function providerData(value: any) {
    return value?.Data || value?.data || value?.raw?.Data || value || {};
  }

  function providerStatus(value: any, fallback = "pending") {
    const data = providerData(value);
    return String(data.Status || data.status || data.Situacao || value?.status || fallback);
  }

  function summarizeBankCharges(charges: any[]) {
    const total = charges.length;
    const paid = charges.filter((charge) => ["paid", "pago", "liquidado", "recebido"].includes(String(charge.status || "").toLowerCase())).length;
    const cancelled = charges.filter((charge) => ["cancelled", "canceled", "cancelado"].includes(String(charge.status || "").toLowerCase())).length;
    const pending = Math.max(0, total - paid - cancelled);
    const amount = charges.reduce((sum, charge) => sum + bankMoneyToNumber(charge.valor), 0);
    return { total, paid, pending, cancelled, amount };
  }

  const PINBANK_DOCUMENT_TYPE_CODES: Record<string, number> = {
    cartao_cnpj: Number(process.env.PINBANK_DOC_TIPO_CARTAO_CNPJ || "1"),
    contrato_social: Number(process.env.PINBANK_DOC_TIPO_CONTRATO_SOCIAL || "2"),
    comprovante_endereco_comercial: Number(process.env.PINBANK_DOC_TIPO_COMPROVANTE_ENDERECO_COMERCIAL || "3"),
    documento_identificacao: Number(process.env.PINBANK_DOC_TIPO_DOCUMENTO_IDENTIFICACAO || "4"),
    selfie_documento: Number(process.env.PINBANK_DOC_TIPO_SELFIE_DOCUMENTO || "5"),
    comprovante_endereco_residencial: Number(process.env.PINBANK_DOC_TIPO_COMPROVANTE_ENDERECO_RESIDENCIAL || "6"),
  };

  function onlyDigitsForPinbank(value: any) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function firstFilled(...values: any[]) {
    for (const value of values) {
      const text = value === null || value === undefined ? "" : String(value).trim();
      if (text) return text;
    }
    return "";
  }

  function pinbankDocTypeCode(tipo: string) {
    const code = PINBANK_DOCUMENT_TYPE_CODES[tipo];
    if (!Number.isFinite(code) || code <= 0) {
      throw new Error(`Tipo de documento PINBANK nao configurado para ${tipo}.`);
    }
    return code;
  }

  async function fetchDirectusFileForPinbank(fileId: string) {
    const metaRes = await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    const metaJson = metaRes.ok ? await metaRes.json().catch(() => ({})) : {};
    const meta = metaJson?.data || {};
    const assetRes = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!assetRes.ok) {
      throw new Error(`Arquivo ${fileId} nao encontrado no Directus para envio ao PINBANK.`);
    }
    const contentType = assetRes.headers.get("content-type") || meta.type || "application/octet-stream";
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const extension = String(meta.filename_download || meta.filename_disk || "").split(".").pop() || contentType.split("/").pop() || "bin";
    const filename = meta.filename_download || meta.filename_disk || `${fileId}.${extension}`;
    return {
      filename,
      contentType,
      format: String(extension || "").toLowerCase(),
      base64: buffer.toString("base64"),
    };
  }

  function buildPinbankCompanyPayload(opts: {
    bia: any;
    biaId: string;
    info: Record<string, any>;
    participants: Awaited<ReturnType<typeof getMouParticipantsForBia>>;
    account: any;
  }): { payload: PinbankCompanyOnboardingPayload; missingFields: string[] } {
    const { bia, info, participants, account } = opts;
    const responsavel = participants.find((p: any) => p.roles?.some((role: string) => normalizeText(role).includes("capital")))
      || participants.find((p: any) => p.roles?.some((role: string) => normalizeText(role).includes("aliado")))
      || participants[0];
    const respData = responsavel?.data || responsavel?.member || {};
    const commercialAddress = {
      cep: firstFilled(info.ativo_cep, bia.ativo_cep, bia.cep),
      endereco: firstFilled(info.ativo_endereco, bia.ativo_endereco, bia.localizacao, bia.endereco),
      numero: firstFilled(info.ativo_numero, bia.ativo_numero, bia.numero, "S/N"),
      complemento: firstFilled(info.ativo_complemento, bia.ativo_complemento, bia.complemento),
      bairro: firstFilled(info.ativo_bairro, bia.ativo_bairro, bia.bairro),
      cidade: firstFilled(info.ativo_cidade, bia.ativo_cidade, bia.cidade),
      estado: firstFilled(info.ativo_estado, bia.ativo_estado, bia.estado),
    };
    const residentialAddress = {
      cep: firstFilled(respData.cep, respData.titular_cep),
      endereco: firstFilled(respData.endereco, respData.titular_endereco),
      numero: firstFilled(respData.numero, respData.titular_numero, "S/N"),
      complemento: firstFilled(respData.complemento, respData.titular_complemento),
      bairro: firstFilled(respData.bairro, respData.titular_bairro),
      cidade: firstFilled(respData.cidade, respData.titular_cidade),
      estado: firstFilled(respData.estado, respData.titular_estado),
    };
    const companyName = firstFilled(info.razao_social, bia.razao_social, bia.nome_bia);
    const companyCnpj = onlyDigitsForPinbank(firstFilled(info.cnpj, bia.cnpj));
    const responsibleName = firstFilled(respData.nome_completo, respData.nome, respData.Nome_de_usuario);
    const responsibleCpf = onlyDigitsForPinbank(firstFilled(respData.cpf, respData.CPF));
    const responsibleEmail = firstFilled(respData.email);
    const responsiblePhone = firstFilled(respData.telefone, respData.whatsapp);
    const missingFields: string[] = [];
    const required = [
      [companyName, "Razao social da BIA"],
      [companyCnpj, "CNPJ da BIA"],
      [responsibleName, "Nome do responsavel pelo onboarding"],
      [responsibleCpf, "CPF do responsavel pelo onboarding"],
      [responsibleEmail, "E-mail do responsavel pelo onboarding"],
      [responsiblePhone, "Telefone do responsavel pelo onboarding"],
      [commercialAddress.cep, "CEP comercial da BIA"],
      [commercialAddress.endereco, "Endereco comercial da BIA"],
      [commercialAddress.cidade, "Cidade comercial da BIA"],
      [commercialAddress.estado, "Estado comercial da BIA"],
    ];
    for (const [value, label] of required) {
      if (!String(value || "").trim()) missingFields.push(String(label));
    }
    if (pinbank.configured && !pinbank.defaultCodigoCanal) {
      missingFields.push("PINBANK_CODIGO_CANAL");
    }
    const socios = participants
      .map((participant: any) => {
        const data = participant.data || participant.member || {};
        const nome = firstFilled(data.nome_completo, data.nome, data.Nome_de_usuario);
        if (!nome) return null;
        return {
          NomeSocio: nome,
          CpfSocio: onlyDigitsForPinbank(firstFilled(data.cpf, data.CPF)),
          PepSocio: false,
        };
      })
      .filter(Boolean) as Array<{ NomeSocio: string; CpfSocio?: string | number | null; PepSocio: boolean }>;
    const termId = String(account?.terms_version || "").match(/^\d+$/)
      ? account.terms_version
      : (process.env.PINBANK_CODIGO_TERMO || null);
    return {
      missingFields,
      payload: {
        codigoCanal: pinbank.defaultCodigoCanal,
        nome: responsibleName || "Responsavel BUILT",
        dataNascimento: firstFilled(respData.data_nascimento),
        cpf: responsibleCpf,
        rg: firstFilled(respData.rg),
        email: responsibleEmail,
        estadoCivil: firstFilled(respData.estado_civil),
        nomeMae: firstFilled(respData.nome_mae),
        nomePai: firstFilled(respData.nome_pai),
        paisOrigem: firstFilled(respData.nacionalidade, "Brasil"),
        celular: responsiblePhone,
        enderecoResidencial: residentialAddress,
        telefoneResidencial: responsiblePhone,
        enderecoComercial: commercialAddress,
        telefoneComercial: responsiblePhone,
        dadosBancarios: {
          banco: firstFilled(info.banco),
          agencia: firstFilled(info.agencia),
          conta: firstFilled(info.conta),
          tipo_conta: firstFilled(info.tipo_conta),
          titular_conta: firstFilled(info.titular_conta, companyName),
          cpfCnpj: companyCnpj,
        },
        razaoSocial: companyName || "BIA BUILT",
        nomeFantasia: firstFilled(info.nome_fantasia, bia.nome_bia, companyName),
        cnpj: companyCnpj || "00000000000000",
        listaSocios: socios.length > 0 ? socios : [{ NomeSocio: responsibleName || "Responsavel BUILT", CpfSocio: responsibleCpf, PepSocio: false }],
        idTermo: termId,
        enviarEmailPrimAcesso: true,
        pep: false,
      },
    };
  }

  async function uploadBiaDocumentsToPinbank(biaId: string, codigoCliente: number, documents: any[]) {
    const uploaded = [];
    for (const doc of documents) {
      if (doc.provider_document_id || !doc.file_id) continue;
      const file = await fetchDirectusFileForPinbank(String(doc.file_id));
      const payload: PinbankDocumentPayload = {
        codigoCliente,
        codigoCanal: pinbank.defaultCodigoCanal,
        tipoDocumento: pinbankDocTypeCode(String(doc.tipo)),
        nomeArquivo: file.filename,
        formatoArquivo: file.format,
        base64Arquivo: file.base64,
      };
      const providerResult = await pinbank.uploadDocument(payload);
      const externalDocId = providerResult?.externalId || null;
      try {
        await db.execute(sql`
          UPDATE bia_bank_documents
          SET status = 'sent',
              provider_document_id = ${externalDocId},
              provider_payload = ${JSON.stringify(providerResult)}::jsonb,
              updated_at = now()
          WHERE id = ${doc.id} AND bia_id = ${biaId}
        `);
      } catch (error: any) {
        console.warn("[bia-banco] Resultado do documento PINBANK gravado em memoria:", error?.message || error);
        setMemoryBankDocument(biaId, {
          ...doc,
          status: "sent",
          provider_document_id: externalDocId,
          provider_payload: providerResult,
        });
      }
      uploaded.push({ id: doc.id, provider_document_id: externalDocId, provider: providerResult.provider });
    }
    return uploaded;
  }

  app.get("/api/bias/:biaId/banco", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await ensureBiaBankAccount(req.params.biaId);
      const documents = await getBiaBankDocuments(req.params.biaId);
      const configStatus = pinbank.getConfigStatus();
      res.json({
        bia: { id: bia.id, nome_bia: bia.nome_bia, diretor_capital: bia.diretor_capital },
        account: normalizeBankAccount(account),
        documents,
        missingDocuments: getBankDocumentMissing(documents),
        charges: await getBiaBankCharges(req.params.biaId),
        providerConfigured: configStatus.configured,
        configStatus,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/termos", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      res.json(await pinbank.getTerms());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/aceite-termos", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const configStatus = pinbank.getConfigStatus();
      if (!configStatus.configured) {
        return res.status(400).json({
          error: "Configure a integracao PINBANK no ambiente do servidor antes de aceitar termos oficiais.",
          configStatus,
        });
      }
      const actor = getAuditActor(req);
      const version = String(req.body?.version || "pinbank_terms_pending");
      const acceptanceLocation = getCapturedAcceptanceLocation(req.body?.aceite_localizacao);
      if (!acceptanceLocation) {
        return res.status(400).json({ error: ACCEPTANCE_LOCATION_REQUIRED_ERROR });
      }
      const acceptanceLocationJson = JSON.stringify(acceptanceLocation);
      let account: any = null;
      try {
        const result: any = await db.execute(sql`
          INSERT INTO bia_bank_accounts (
            bia_id, status, terms_version, terms_accepted_at,
            terms_accepted_by_user_id, terms_accepted_by_membro_id, terms_accepted_by_nome,
            terms_acceptance_location, updated_at
          )
          VALUES (${req.params.biaId}, 'documents_pending', ${version}, now(), ${actor.userId}, ${actor.membroId}, ${actor.nome}, ${acceptanceLocationJson}::jsonb, now())
          ON CONFLICT (bia_id) DO UPDATE SET
            status = CASE WHEN bia_bank_accounts.status = 'not_started' THEN 'documents_pending' ELSE bia_bank_accounts.status END,
            terms_version = EXCLUDED.terms_version,
            terms_accepted_at = EXCLUDED.terms_accepted_at,
            terms_accepted_by_user_id = EXCLUDED.terms_accepted_by_user_id,
            terms_accepted_by_membro_id = EXCLUDED.terms_accepted_by_membro_id,
            terms_accepted_by_nome = EXCLUDED.terms_accepted_by_nome,
            terms_acceptance_location = EXCLUDED.terms_acceptance_location,
            updated_at = now()
          RETURNING *
        `);
        account = result.rows?.[0] || null;
      } catch (error: any) {
        console.warn("[bia-banco] Aceite gravado em memoria:", error?.message || error);
      }
      if (!account) {
        const current = await ensureBiaBankAccount(req.params.biaId);
        account = memoryBankAccount(req.params.biaId, {
          ...current,
          status: current?.status === "not_started" ? "documents_pending" : (current?.status || "documents_pending"),
          terms_version: version,
          terms_accepted_at: new Date().toISOString(),
          terms_accepted_by_user_id: actor.userId,
          terms_accepted_by_membro_id: actor.membroId,
          terms_accepted_by_nome: actor.nome,
          terms_acceptance_location: acceptanceLocation,
        });
      }
      if (actor.membroId) {
        await recordTermAcceptanceAudit({
          membroId: actor.membroId,
          termoChave: "pinbank_baas",
          termoVersao: version,
          origem: `Núcleo de Capital - BIA ${req.params.biaId}`,
          aceitoEm: account?.terms_accepted_at || new Date(),
          aceiteLocalizacao: acceptanceLocation,
        });
      }
      res.json({ success: true, account: normalizeBankAccount(account) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/documentos", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const tipo = String(req.body?.tipo || "").trim();
      const fileId = String(req.body?.fileId || "").trim();
      const membroId = req.body?.membroId ? String(req.body.membroId) : null;
      if (!tipo || !fileId) return res.status(400).json({ error: "Informe o tipo do documento e o arquivo." });
      if (!req.body?.permitirCompartilhamento) {
        return res.status(400).json({ error: "Autorize o compartilhamento do documento com o banco." });
      }
      const actor = getAuditActor(req);
      let document: any = null;
      try {
        const result: any = await db.execute(sql`
          INSERT INTO bia_bank_documents (
            bia_id, membro_id, tipo, file_id, status,
            permission_shared_at, permission_shared_by_user_id, permission_shared_by_membro_id, updated_at
          )
          VALUES (${req.params.biaId}, ${membroId}, ${tipo}, ${fileId}, 'sent', now(), ${actor.userId}, ${actor.membroId}, now())
          RETURNING *
        `);
        document = result.rows?.[0] || null;
      } catch (error: any) {
        console.warn("[bia-banco] Documento gravado em memoria:", error?.message || error);
      }
      if (!document) {
        document = setMemoryBankDocument(req.params.biaId, {
          id: `memory-doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          bia_id: req.params.biaId,
          membro_id: membroId,
          tipo,
          file_id: fileId,
          status: "sent",
          provider_document_id: null,
          provider_payload: null,
          permission_shared_at: new Date().toISOString(),
          permission_shared_by_user_id: actor.userId,
          permission_shared_by_membro_id: actor.membroId,
        });
      }
      const documents = await getBiaBankDocuments(req.params.biaId);
      const missing = getBankDocumentMissing(documents);
      const nextStatus = missing.length === 0 ? "terms_pending" : "documents_pending";
      const account = await getBiaBankAccount(req.params.biaId);
      if (!account || account.status === "not_started" || account.status === "documents_pending") {
        try {
          await db.execute(sql`
            INSERT INTO bia_bank_accounts (bia_id, status, updated_at)
            VALUES (${req.params.biaId}, ${nextStatus}, now())
            ON CONFLICT (bia_id) DO UPDATE SET status = ${nextStatus}, updated_at = now()
          `);
        } catch (error: any) {
          console.warn("[bia-banco] Status de documentos gravado em memoria:", error?.message || error);
          memoryBankAccount(req.params.biaId, { ...(account || {}), status: nextStatus });
        }
      }
      const codigoCliente = Number(account?.external_account_id || pinbank.defaultCodigoCliente || 0) || 0;
      if (pinbank.configured && codigoCliente && document) {
        const uploaded = await uploadBiaDocumentsToPinbank(req.params.biaId, codigoCliente, [document]);
        if (uploaded.length > 0) {
          try {
            const refreshed: any = await db.execute(sql`SELECT * FROM bia_bank_documents WHERE id = ${document.id} LIMIT 1`);
            document = refreshed.rows?.[0] || document;
          } catch {}
        }
      }
      res.json({ success: true, document, missingDocuments: missing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/documentos/status", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const documents = await getBiaBankDocuments(req.params.biaId);
      const account = await getBiaBankAccount(req.params.biaId);
      let providerStatus = null;
      const codigoCliente = Number(account?.external_account_id || pinbank.defaultCodigoCliente || 0) || 0;
      if (pinbank.configured && codigoCliente) {
        providerStatus = await pinbank.getDocumentStatus(codigoCliente).catch((error: any) => ({
          error: error?.message || String(error),
        }));
      }
      res.json({ documents, missingDocuments: getBankDocumentMissing(documents), providerStatus });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/documentos/inventario", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const codigoCliente = resolvePinbankCodigoCliente(account);
      const localDocuments = await getBiaBankDocuments(req.params.biaId);
      const inventory = await pinbank.getDocumentInventory(codigoCliente).catch((error: any) => ({
        error: error?.message || String(error),
      }));
      res.json({
        documents: localDocuments,
        missingDocuments: getBankDocumentMissing(localDocuments),
        providerInventory: inventory,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/documentos/:documentId/substituir", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const fileId = String(req.body?.fileId || "").trim();
      if (!fileId) return res.status(400).json({ error: "Informe o novo arquivo." });
      if (!req.body?.permitirCompartilhamento) {
        return res.status(400).json({ error: "Autorize o compartilhamento do documento com o banco." });
      }
      const account = await getBiaBankAccount(req.params.biaId);
      const documents = await getBiaBankDocuments(req.params.biaId);
      const current = documents.find((doc: any) => String(doc.id) === String(req.params.documentId));
      if (!current) return res.status(404).json({ error: "Documento nao encontrado." });
      const file = await fetchDirectusFileForPinbank(fileId);
      const providerResult = await pinbank.replaceDocument({
        codigoCliente: resolvePinbankCodigoCliente(account),
        codigoCanal: pinbank.defaultCodigoCanal,
        tipoDocumento: pinbankDocTypeCode(String(current.tipo)),
        nomeArquivo: file.filename,
        formatoArquivo: file.format,
        base64Arquivo: file.base64,
        providerDocumentId: current.provider_document_id || null,
      });
      let updated = null;
      try {
        const result: any = await db.execute(sql`
          UPDATE bia_bank_documents
          SET file_id = ${fileId},
              status = 'sent',
              provider_document_id = ${providerResult?.externalId || current.provider_document_id || null},
              provider_payload = ${JSON.stringify(providerResult)}::jsonb,
              updated_at = now()
          WHERE id = ${req.params.documentId} AND bia_id = ${req.params.biaId}
          RETURNING *
        `);
        updated = result.rows?.[0] || null;
      } catch (error: any) {
        console.warn("[bia-banco] Substituicao de documento gravada em memoria:", error?.message || error);
      }
      if (!updated) {
        updated = setMemoryBankDocument(req.params.biaId, {
          ...current,
          file_id: fileId,
          status: "sent",
          provider_document_id: providerResult?.externalId || current.provider_document_id || null,
          provider_payload: providerResult,
        });
      }
      res.json({ success: true, document: updated, providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/cobrancas", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const configStatus = pinbank.getConfigStatus();
      if (!configStatus.configured) {
        return res.status(400).json({
          error: "Configure a integracao PINBANK no ambiente do servidor antes de gerar cobrancas bancarias.",
          configStatus,
        });
      }
      const account = await ensureBiaBankAccount(req.params.biaId);
      const codigoCliente = resolvePinbankCodigoCliente(account);
      if (pinbank.configured && !codigoCliente) {
        return res.status(400).json({ error: "Abra a conta digital da BIA antes de gerar cobrancas PINBANK." });
      }
      const tipo = String(req.body?.tipo || "boleto").trim();
      const payload = buildPinbankChargePayload(req, account);
      let providerResult: any;
      if (tipo === "boleto_split") {
        providerResult = await pinbank.createSplitBoleto(payload);
      } else if (tipo === "link_pagamento") {
        providerResult = await pinbank.createPaymentLink(payload);
      } else {
        providerResult = await pinbank.createBoleto(payload);
      }
      const charge = await saveBiaBankCharge({
        biaId: req.params.biaId,
        fluxoCaixaId: req.body?.fluxoCaixaId || req.body?.fluxo_caixa_id || null,
        type: tipo,
        payload,
        providerResult,
        actor: getAuditActor(req),
      });
      res.json({ success: true, charge, providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/cobrancas/:chargeId/cancelar", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const charge = await findBiaBankCharge(req.params.biaId, req.params.chargeId);
      if (!charge) return res.status(404).json({ error: "Cobranca nao encontrada." });
      const providerResult = await pinbank.cancelBoleto(buildPinbankChargeQuery(account, charge));
      const updated = await updateBiaBankCharge(req.params.biaId, String(charge.id), {
        status: "cancelled",
        provider_payload: { ...(charge.provider_payload || {}), cancelamento: providerResult },
      });
      res.json({ success: true, charge: updated || { ...charge, status: "cancelled" }, providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/cobrancas/:chargeId/status", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const charge = await findBiaBankCharge(req.params.biaId, req.params.chargeId);
      if (!charge) return res.status(404).json({ error: "Cobranca nao encontrada." });
      const providerResult = await pinbank.getBoletoStatus(buildPinbankChargeQuery(account, charge));
      const nextStatus = providerStatus(providerResult, charge.status || "pending");
      const updated = await updateBiaBankCharge(req.params.biaId, String(charge.id), {
        status: nextStatus,
        provider_payload: { ...(charge.provider_payload || {}), statusConsulta: providerResult },
      });
      res.json({ success: true, charge: updated || { ...charge, status: nextStatus }, providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/cobrancas/lote", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const localCharges = await getBiaBankCharges(req.params.biaId);
      const providerResult = await pinbank.listBoletos(buildPinbankChargeQuery(account, null, {
        dataInicio: req.query.inicio || req.query.dataInicio || null,
        dataFim: req.query.fim || req.query.dataFim || null,
      })).catch((error: any) => ({ error: error?.message || String(error) }));
      res.json({ charges: localCharges, providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/cobrancas/metricas", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const localCharges = await getBiaBankCharges(req.params.biaId);
      const providerResult = await pinbank.getChargeMetrics(buildPinbankChargeQuery(account, null, {
        dataInicio: req.query.inicio || req.query.dataInicio || null,
        dataFim: req.query.fim || req.query.dataFim || null,
      })).catch((error: any) => ({ error: error?.message || String(error) }));
      res.json({ metrics: summarizeBankCharges(localCharges), providerResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/saldo", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const result = await pinbank.getBalance(resolvePinbankCodigoCliente(account));
      res.json({ balance: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/extrato", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const result = await pinbank.getStatement(buildPinbankChargeQuery(account, null, {
        dataInicio: req.query.inicio || req.query.dataInicio || null,
        dataFim: req.query.fim || req.query.dataFim || null,
      }));
      res.json({ statement: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:biaId/banco/comprovante/:transactionId", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await getBiaBankAccount(req.params.biaId);
      const result = await pinbank.getTransactionReceipt(buildPinbankChargeQuery(account, null, {
        transactionId: req.params.transactionId,
      }));
      res.json({ receipt: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias/:biaId/banco/onboarding", async (req: any, res) => {
    try {
      const bia = await requireBiaBancoAccess(req, res, req.params.biaId);
      if (!bia) return;
      const account = await ensureBiaBankAccount(req.params.biaId);
      const configStatus = pinbank.getConfigStatus();
      if (!configStatus.configured) {
        return res.status(400).json({
          error: "Configure a integracao PINBANK no ambiente do servidor antes de abrir a conta digital.",
          configStatus,
        });
      }
      if (!account?.terms_accepted_at) {
        return res.status(400).json({ error: "Aceite os termos PINBANK antes de abrir a conta." });
      }
      const documents = await getBiaBankDocuments(req.params.biaId);
      const missingDocuments = getBankDocumentMissing(documents);
      if (missingDocuments.length > 0) {
        return res.status(400).json({ error: "Envie todos os documentos obrigatorios antes do onboarding.", missingDocuments });
      }
      const infoLocal = await storage.getBiaInfoComercial(req.params.biaId).catch((error: any) => {
        console.warn("[bia-banco] Info comercial local indisponivel:", error?.message || error);
        return null;
      });
      const biaComInfo = {
        ...bia,
        ...pickFilledBiaInfoComercialFields(bia ?? {}),
        ...pickFilledBiaInfoComercialFields(infoLocal ?? {}),
      };
      const participants = await getMouParticipantsForBia(biaComInfo, req.params.biaId).catch((error: any) => {
        console.warn("[bia-banco] Participantes do MOU indisponiveis para PINBANK:", error?.message || error);
        return [];
      });
      const { payload, missingFields } = buildPinbankCompanyPayload({
        bia,
        biaId: req.params.biaId,
        info: biaComInfo,
        participants,
        account,
      });
      if (pinbank.configured && missingFields.length > 0) {
        return res.status(400).json({
          error: "Complete os dados obrigatorios antes de abrir a conta PINBANK.",
          missingFields,
        });
      }
      const providerResult: any = await pinbank.startCompanyOnboarding(payload);
      const externalId = providerResult?.externalId || providerResult?.id || providerResult?.raw?.Data?.CodigoCliente || null;
      const providerStatusText = String(providerResult?.status || "");
      const status = ["open", "rejected", "documents_pending"].includes(providerStatusText) ? providerStatusText : "in_review";
      let uploadedDocuments: any[] = [];
      const codigoCliente = Number(providerResult?.raw?.Data?.CodigoCliente || externalId || pinbank.defaultCodigoCliente || 0) || 0;
      if (pinbank.configured && codigoCliente) {
        uploadedDocuments = await uploadBiaDocumentsToPinbank(req.params.biaId, codigoCliente, documents);
      }
      const onboardingPayload = { ...payload, documents: documents.map((doc: any) => ({ tipo: doc.tipo, fileId: doc.file_id, membroId: doc.membro_id || null })) };
      let accountResult: any = null;
      try {
        const result: any = await db.execute(sql`
          UPDATE bia_bank_accounts
          SET status = ${status},
              external_account_id = ${externalId},
              onboarding_requested_at = now(),
              onboarding_payload = ${JSON.stringify(onboardingPayload)}::jsonb,
              provider_payload = ${JSON.stringify({ ...providerResult, uploadedDocuments })}::jsonb,
              updated_at = now()
          WHERE bia_id = ${req.params.biaId}
          RETURNING *
        `);
        accountResult = result.rows?.[0] || null;
      } catch (error: any) {
        console.warn("[bia-banco] Onboarding gravado em memoria:", error?.message || error);
      }
      if (!accountResult) {
        accountResult = memoryBankAccount(req.params.biaId, {
          ...(account || {}),
          status,
          external_account_id: externalId,
          onboarding_requested_at: new Date().toISOString(),
          onboarding_payload: onboardingPayload,
          provider_payload: { ...providerResult, uploadedDocuments },
        });
      }
      if (status === "open") {
        const email = (req.session as any)?.email;
        if (email) {
          import("./mailer")
            .then(({ enviarContaBiaAberta }) => enviarContaBiaAberta({
              destinatarioEmail: email,
              destinatarioNome: (req.session as any)?.nome || null,
              biaNome: bia.nome_bia || "BIA BUILT",
            }))
            .catch((error: any) => console.warn("[bia-banco] Email de conta aberta nao enviado:", error?.message || error));
        }
        recordUsageEvent(req, "bia_bank_account_open", {
          path: `/bias/${req.params.biaId}`,
          label: "Conta da BIA criada com sucesso! Voce ja pode movimentar.",
          metadata: { biaId: req.params.biaId, provider: "pinbank" },
        }).catch((error: any) => console.warn("[bia-banco] Alerta de conta aberta nao registrado:", error?.message || error));
      }
      res.json({ success: true, account: normalizeBankAccount(accountResult), uploadedDocuments });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/bias/:id/info-comercial
  app.get("/api/bias/:id/info-comercial", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      if (!await requireBiaModuleAccess(req, res, req.params.id, "configuracao_bia", "view")) return;
      const localInfo = await storage.getBiaInfoComercial(req.params.id).catch((error: any) => {
        console.warn(`[bia-info] leitura local indisponivel: ${error?.message || error}`);
        return null;
      });
      const bia = await directusFetchOne("bias_projetos", req.params.id).catch((error: any) => {
        console.warn(`[bia-info] leitura Directus indisponivel: ${error?.message || error}`);
        return null;
      });
      res.json({
        ...(localInfo ?? {}),
        ...pickFilledBiaInfoComercialFields(bia ?? {}),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/bias/:id/info-comercial
  app.put("/api/bias/:id/info-comercial", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      if (!await requireBiaModuleAccess(req, res, req.params.id, "configuracao_bia", "edit")) return;
      const infoPayload = pickBiaInfoComercialFields(req.body);
      let directusInfo = infoPayload;
      try {
        directusInfo = await directusUpdate("bias_projetos", req.params.id, infoPayload);
      } catch (firstError: any) {
        await ensureBiasExtraFields().catch((ensureError: any) => {
          console.warn(`[bia-info] campos Directus nao sincronizados: ${ensureError?.message || ensureError}`);
        });
        directusInfo = await directusUpdate("bias_projetos", req.params.id, infoPayload);
      }
      const localInfo = await storage.upsertBiaInfoComercial(req.params.id, infoPayload).catch((error: any) => {
        console.warn(`[bia-info] espelho local indisponivel: ${error?.message || error}`);
        return null;
      });
      res.json({
        ...(localInfo ?? {}),
        ...pickBiaInfoComercialFields(directusInfo ?? infoPayload),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/bias/:id/aportes â€” returns "Aporte do Fator de MultiplicaÃ§Ã£o" fluxo_caixa entries for a BIA
  app.get("/api/bias/:id/aportes", async (req, res) => {
    try {
      const biaId = req.params.id;
      if (!await requireBiaModuleAccess(req, res, biaId, "capital_financeiro", "view")) return;
      // Filter by BIA server-side to avoid loading all fluxo_caixa entries;
      // description prefix filter applied in-memory (Directus bracket filters are BIA-scoped here)
      const entries = await directusFetch(
        "fluxo_caixa",
        `filter[bia][_eq]=${encodeURIComponent(biaId)}&fields=id,bia,descricao,valor,data_vencimento,status,favorecido_id.id,favorecido_id.nome,favorecido_id.Nome_de_usuario`
      );
      const aportes = entries.filter(
        (e: any) => (e.descricao || "").startsWith("Aporte do Fator de MultiplicaÃ§Ã£o")
      );
      res.json(aportes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIA APROVAÃ‡Ã•ES ==========

  // GET /api/bia-aprovacoes â€” list pending approvals visible to the current user
  app.get("/api/bia-aprovacoes", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      let items;
      if (sessionRole === "admin" || sessionRole === "manager" || sessionRole === "superadmin") {
        items = await storage.getBiaAprovacoesPendentes();
      } else if (sessionMembroId) {
        items = await storage.getBiaAprovacoesParaAliado(sessionMembroId);
      } else {
        items = [];
      }
      res.json(items);
    } catch (error: any) {
      const cached = readCachedApiArrayFromLogs("/api/comunidades");
      if (cached) {
        const membroId = req.query.membro_id as string | undefined;
        let items = cached;
        if (membroId) {
          items = cached.filter((c: any) => {
            const aId = typeof c.aliado === "string" ? c.aliado : c.aliado?.id;
            if (String(aId || "") === String(membroId)) return true;
            const membros: any[] = Array.isArray(c.membros) ? c.membros : [];
            return membros.some((m: any) => {
              const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
              return String(id || "") === String(membroId);
            });
          });
        }
        console.warn("[comunidades] Directus indisponivel; usando ultimo snapshot local dos logs.");
        return res.json(items);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/bia-aprovacoes/minha â€” approvals created BY the current user (Diretor)
  app.get("/api/bia-aprovacoes/minha", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
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

  // PATCH /api/bia-aprovacoes/:id/aprovar â€” Aliado BUILT approves the BIA
  app.patch("/api/bia-aprovacoes/:id/aprovar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const aprovacao = await storage.getBiaAprovacaoById(req.params.id);
      if (!aprovacao) return res.status(404).json({ error: "AprovaÃ§Ã£o nÃ£o encontrada" });
      if (aprovacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitaÃ§Ã£o jÃ¡ foi processada" });

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

  // PATCH /api/bia-aprovacoes/:id/rejeitar â€” Aliado BUILT rejects the BIA
  app.patch("/api/bia-aprovacoes/:id/rejeitar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const sessionRole = (req.session as any).role || "user";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const aprovacao = await storage.getBiaAprovacaoById(req.params.id);
      if (!aprovacao) return res.status(404).json({ error: "AprovaÃ§Ã£o nÃ£o encontrada" });
      if (aprovacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitaÃ§Ã£o jÃ¡ foi processada" });

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

  // ========== BIA DIRETOR SOLICITACOES ==========

  app.get("/api/bia-mou/padrao", async (req, res) => {
    res.json({
      titulo: BIA_MOU_TITULO,
      versao: BIA_MOU_VERSAO,
      texto: await getBiaMouTextoPersonalizado(req.query?.biaId ? String(req.query.biaId) : null),
    });
  });

  app.get("/api/bia-diretor-solicitacoes/minhas", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      if (!sessionMembroId) return res.json([]);
      return res.json(await storage.getBiaDiretorSolicitacoesParaDiretor(sessionMembroId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bia-diretor-solicitacoes/bia/:biaId", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await directusFetchOne("bias_projetos", req.params.biaId, "fields=*");
      if (!bia) return res.status(404).json({ error: "BIA nao encontrada" });
      if (!canViewBia(bia, req)) return res.status(403).json({ error: "Voce nao tem acesso a esta BIA" });
      return res.json(await storage.getBiaDiretorSolicitacoesPendentesByBia(req.params.biaId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bia-diretor-solicitacoes/:id/aceitar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const solicitacao = await storage.getBiaDiretorSolicitacaoById(req.params.id);
      if (!solicitacao) return res.status(404).json({ error: "Solicitacao nao encontrada" });
      if (solicitacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitacao ja foi processada" });
      if (!sessionMembroId || solicitacao.diretor_membro_id !== sessionMembroId) {
        return res.status(403).json({ error: "Apenas o diretor indicado pode aceitar esta solicitacao" });
      }

      const mouCheck = await ensureMouAceitoOuRetornaPendencia(
        solicitacao.bia_id,
        solicitacao.diretor_membro_id,
        !!req.body?.aceitar_mou,
        req.body?.dados_contratuais_mou,
        req.body?.aceite_localizacao
      );
      if (!mouCheck.ok) return res.status((mouCheck as any).statusCode || 200).json(mouCheck.response);

      await directusUpdate("bias_projetos", solicitacao.bia_id, {
        [solicitacao.campo_diretor]: solicitacao.diretor_membro_id,
        [solicitacao.campo_percentual]: solicitacao.percentual || null,
      });
      await storage.updateBiaDiretorSolicitacao(solicitacao.id, {
        status: "aceito",
        respondido_em: new Date(),
      } as any);
      await storage.cancelBiaDiretorSolicitacoes(
        solicitacao.bia_id,
        solicitacao.campo_diretor,
        solicitacao.diretor_membro_id
      );

      await notificarRespostaSolicitacao({
        solicitanteEmail: solicitacao.solicitante_email,
        solicitanteNome: solicitacao.solicitante_nome,
        convidadoNome: solicitacao.diretor_nome,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        papel: solicitacao.papel,
        aceito: true,
      });
      await notificarNovoIntegrante({
        biaId: solicitacao.bia_id,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        novoMembroId: solicitacao.diretor_membro_id,
        novoNome: solicitacao.diretor_nome,
        papel: solicitacao.papel,
      });

      res.json({ success: true, status: "aceito" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bia-diretor-solicitacoes/:id/recusar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const solicitacao = await storage.getBiaDiretorSolicitacaoById(req.params.id);
      if (!solicitacao) return res.status(404).json({ error: "Solicitacao nao encontrada" });
      if (solicitacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitacao ja foi processada" });
      if (!sessionMembroId || solicitacao.diretor_membro_id !== sessionMembroId) {
        return res.status(403).json({ error: "Apenas o diretor indicado pode recusar esta solicitacao" });
      }

      await directusUpdate("bias_projetos", solicitacao.bia_id, {
        [solicitacao.campo_diretor]: null,
        [solicitacao.campo_percentual]: null,
      });
      await storage.updateBiaDiretorSolicitacao(solicitacao.id, {
        status: "recusado",
        respondido_em: new Date(),
      } as any);

      await notificarRespostaSolicitacao({
        solicitanteEmail: solicitacao.solicitante_email,
        solicitanteNome: solicitacao.solicitante_nome,
        convidadoNome: solicitacao.diretor_nome,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        papel: solicitacao.papel,
        aceito: false,
      });

      res.json({ success: true, status: "recusado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIA SOCIO SOLICITACOES ==========

  app.get("/api/bia-socio-solicitacoes/minhas", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      if (!sessionMembroId) return res.json([]);
      return res.json(await storage.getBiaSocioSolicitacoesParaSocio(sessionMembroId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bia-socio-solicitacoes/bia/:biaId", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const bia = await directusFetchOne("bias_projetos", req.params.biaId, "fields=*");
      if (!bia) return res.status(404).json({ error: "BIA nao encontrada" });
      if (!canViewBia(bia, req)) return res.status(403).json({ error: "Voce nao tem acesso a esta BIA" });
      return res.json(await storage.getBiaSocioSolicitacoesPendentesByBia(req.params.biaId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bia-socio-solicitacoes/:id/aceitar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const solicitacao = await storage.getBiaSocioSolicitacaoById(req.params.id);
      if (!solicitacao) return res.status(404).json({ error: "Solicitacao nao encontrada" });
      if (solicitacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitacao ja foi processada" });
      if (!sessionMembroId || solicitacao.socio_membro_id !== sessionMembroId) {
        return res.status(403).json({ error: "Apenas o socio indicado pode aceitar esta solicitacao" });
      }

      const mouCheck = await ensureMouAceitoOuRetornaPendencia(
        solicitacao.bia_id,
        solicitacao.socio_membro_id,
        !!req.body?.aceitar_mou,
        req.body?.dados_contratuais_mou,
        req.body?.aceite_localizacao
      );
      if (!mouCheck.ok) return res.status((mouCheck as any).statusCode || 200).json(mouCheck.response);

      const bia = await directusFetchOne("bias_projetos", solicitacao.bia_id, `fields=id,${solicitacao.campo_socios}`);
      const socios = new Set(parseBiaMemberList(bia?.[solicitacao.campo_socios]));
      socios.add(solicitacao.socio_membro_id);
      await directusUpdate("bias_projetos", solicitacao.bia_id, {
        [solicitacao.campo_socios]: JSON.stringify(Array.from(socios)),
      });
      await storage.updateBiaSocioSolicitacao(solicitacao.id, {
        status: "aceito",
        respondido_em: new Date(),
      } as any);

      await notificarRespostaSolicitacao({
        solicitanteEmail: solicitacao.solicitante_email,
        solicitanteNome: solicitacao.solicitante_nome,
        convidadoNome: solicitacao.socio_nome,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        papel: solicitacao.papel,
        aceito: true,
      });
      await notificarNovoIntegrante({
        biaId: solicitacao.bia_id,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        novoMembroId: solicitacao.socio_membro_id,
        novoNome: solicitacao.socio_nome,
        papel: solicitacao.papel,
      });

      res.json({ success: true, status: "aceito" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bia-socio-solicitacoes/:id/recusar", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
    try {
      const sessionMembroId = (req.session as any).membroId as string | null;
      const solicitacao = await storage.getBiaSocioSolicitacaoById(req.params.id);
      if (!solicitacao) return res.status(404).json({ error: "Solicitacao nao encontrada" });
      if (solicitacao.status !== "pendente") return res.status(400).json({ error: "Esta solicitacao ja foi processada" });
      if (!sessionMembroId || solicitacao.socio_membro_id !== sessionMembroId) {
        return res.status(403).json({ error: "Apenas o socio indicado pode recusar esta solicitacao" });
      }

      const bia = await directusFetchOne("bias_projetos", solicitacao.bia_id, `fields=id,${solicitacao.campo_socios}`);
      const socios = parseBiaMemberList(bia?.[solicitacao.campo_socios])
        .filter((id) => id !== solicitacao.socio_membro_id);
      await directusUpdate("bias_projetos", solicitacao.bia_id, {
        [solicitacao.campo_socios]: JSON.stringify(socios),
      });
      await storage.updateBiaSocioSolicitacao(solicitacao.id, {
        status: "recusado",
        respondido_em: new Date(),
      } as any);

      await notificarRespostaSolicitacao({
        solicitanteEmail: solicitacao.solicitante_email,
        solicitanteNome: solicitacao.solicitante_nome,
        convidadoNome: solicitacao.socio_nome,
        biaNome: solicitacao.bia_nome || solicitacao.bia_id,
        papel: solicitacao.papel,
        aceito: false,
      });

      res.json({ success: true, status: "recusado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== FLUXO DE CAIXA (from Directus) ==========
  await ensureFluxoCaixaHistoricoTable().catch((err: any) => {
    console.warn(`[fluxo_historico] Tabela de historico nao sincronizada: ${err.message}`);
  });

  await ensureFluxoPagamentoFields().catch((err: any) => {
    console.warn(`[fluxo_pagamento] Campos de pagamento nao sincronizados: ${err.message}`);
  });

  const fluxoBiaId = (item: any): string | null => directusRelationId(item?.bia || item?.bia_id);

  async function requireFluxoAccess(req: any, res: any, fluxoId: string, required: "view" | "edit") {
    if (!(req.session as any).directusUserId) {
      res.status(401).json({ error: "Nao autenticado" });
      return null;
    }
    const snapshot = await fetchFluxoSnapshot(fluxoId).catch(() => null);
    if (!snapshot) {
      res.status(404).json({ error: "Lancamento nao encontrado" });
      return null;
    }
    const biaId = fluxoBiaId(snapshot);
    if (!biaId) {
      res.status(403).json({ error: "O lancamento nao esta vinculado a uma BIA autorizada." });
      return null;
    }
    const authorization = await requireBiaModuleAccess(req, res, biaId, "capital_financeiro", required);
    return authorization ? { snapshot, biaId, authorization } : null;
  }

  app.get("/api/fluxo-caixa", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
      const requestedBiaId = req.query.bia_id ? String(req.query.bia_id) : null;
      if (requestedBiaId && !await requireBiaModuleAccess(req, res, requestedBiaId, "capital_financeiro", "view")) return;
      const items = await directusFetch("fluxo_caixa", "fields=*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*,favorecido_id.id,favorecido_id.nome,favorecido_id.Nome_de_usuario,favorecido_id.razao_social");
      let authorizedItems = requestedBiaId
        ? items.filter((item: any) => fluxoBiaId(item) === requestedBiaId)
        : items;
      if (!requestedBiaId && !hasBiaAdminBypass(req)) {
        const uniqueBiaIds = Array.from(new Set<string>(
          (items as any[]).map(fluxoBiaId).filter((id: string | null): id is string => Boolean(id)),
        ));
        const decisions = await Promise.all(uniqueBiaIds.map(async (biaId) => {
          const bia = await resolveBiaByIdOrPublicCode(biaId, "*").catch(() => null);
          if (!bia) return [biaId, false] as const;
          const access = await resolveBiaAccessForRequest(bia, req);
          return [biaId, hasBiaAccess(access.permissions, "capital_financeiro", "view")] as const;
        }));
        const allowedBiaIds = new Set(decisions.filter(([, allowed]) => allowed).map(([biaId]) => biaId));
        authorizedItems = items.filter((item: any) => {
          const biaId = fluxoBiaId(item);
          return Boolean(biaId && allowedBiaIds.has(biaId));
        });
      }
      const mapped = authorizedItems.map((f: any) => {
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
          if (c && typeof c === "object" && c.categorias_id) {
            return c.categorias_id;
          }
          return c;
        });
        const tiposCpp = (f.tipo_de_cpp || []).map((c: any) => {
          if (c && typeof c === "object" && c.tipos_cpp_id && typeof c.tipos_cpp_id === "object") {
            return c.tipos_cpp_id;
          }
          if (c && typeof c === "object" && c.tipos_cpp_id) {
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
          pagamento_provider: f.pagamento_provider || null,
          pagamento_id: f.pagamento_id || null,
          pagamento_url: f.pagamento_url || null,
          pagamento_status: f.pagamento_status || null,
          pagamento_pais: f.pagamento_pais || null,
          pagamento_pagador_nome: f.pagamento_pagador_nome || null,
          pagamento_pagador_email: f.pagamento_pagador_email || null,
          pagamento_pagador_documento: f.pagamento_pagador_documento || null,
          pagamento_gerado_em: f.pagamento_gerado_em || null,
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

  app.get("/api/fluxo-caixa/:id/historico", async (req, res) => {
    try {
      if (!await requireFluxoAccess(req, res, req.params.id, "view")) return;
      const result = await db.execute(sql`
        SELECT
          id,
          fluxo_caixa_id,
          bia_id,
          acao,
          ator_user_id,
          ator_membro_id,
          ator_nome,
          origem,
          dados_antes,
          dados_depois,
          payload,
          anexos,
          criado_em
        FROM fluxo_caixa_historico
        WHERE fluxo_caixa_id = ${req.params.id}
        ORDER BY criado_em DESC
      `);
      res.json(result.rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fluxo-caixa/importar-anexos", upload.single("file"), async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const biaId = String(req.body?.bia_id || "");
      if (!biaId) return res.status(400).json({ error: "Selecione uma BIA antes de analisar o arquivo." });
      if (!await requireBiaModuleAccess(req, res, biaId, "capital_financeiro", "edit")) return;
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const ext = path.extname(file.originalname || "").toLowerCase().replace(".", "");
      const mime = String(file.mimetype || "").toLowerCase();
      const isImageFile = mime.startsWith("image/") && ["png", "jpg", "jpeg", "webp"].includes(ext);
      let textContent = "";

      if (isImageFile) {
        textContent = `Arquivo de imagem: ${file.originalname}. Leia visualmente o comprovante/anexo e extraia os lançamentos financeiros visíveis.`;
      } else if (["xlsx", "xls"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(file.buffer, { type: "buffer" });
        const lines: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          lines.push(`[Planilha: ${sheetName}]\n${csv}`);
        }
        textContent = lines.join("\n\n");
      } else if (ext === "pdf" || mime.includes("pdf")) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: file.buffer });
          const result = await parser.getText();
          textContent = result.text;
        } catch (pdfErr: any) {
          console.error("[fluxo-importar-anexos] pdf error:", pdfErr?.message || pdfErr);
          return res.status(422).json({ error: "Não foi possível ler o PDF. Tente enviar Excel, CSV ou TXT." });
        }
      } else {
        textContent = file.buffer.toString("utf-8");
      }

      if (!textContent.trim()) {
        return res.status(422).json({ error: "Não foi possível extrair texto do arquivo." });
      }
      if (textContent.length > 18000) textContent = textContent.slice(0, 18000) + "\n[... truncado ...]";
      const deterministicLancamentos = extractInstallmentLancamentos(textContent, new Date().toISOString().split("T")[0]).slice(0, 80);

      const [categoriasRaw, tiposCppRaw] = await Promise.all([
        directusFetch("Categorias").catch(() => []),
        directusFetch("Tipos_CPP").catch(() => []),
      ]);
      const categoriaOptions = (categoriasRaw || [])
        .map((c: any) => ({ id: c.id, nome: c.Nome_da_categoria, tipo: c.Tipo_de_categoria || null }))
        .filter((c: any) => c.id && c.nome)
        .slice(0, 140);
      const tipoCppOptions = (tiposCppRaw || [])
        .map((c: any) => ({ id: c.id, nome: c.Nome }))
        .filter((c: any) => c.id && c.nome)
        .slice(0, 80);

      const today = new Date().toISOString().split("T")[0];
      const prompt = `Você é um assistente financeiro da BUILT Alliances.
Analise o arquivo e extraia lançamentos financeiros para o fluxo de caixa de uma BIA.
Retorne SOMENTE JSON válido, sem markdown, neste formato:
{"lancamentos":[{"tipo":"entrada|saida","valor":123.45,"data":"YYYY-MM-DD","data_vencimento":"YYYY-MM-DD|null","data_pagamento":"YYYY-MM-DD|null","status":"pendente|agendado|pago|parcial|vencido|cancelado","descricao":"texto curto","categoria_id":123|null,"categoria_nome":"texto|null","tipo_cpp_id":123|null,"tipo_cpp_nome":"texto|null","observacao":"texto curto|null"}],"observacao":"texto curto"}

Regras:
- Crie um lançamento para cada linha, parcela, nota, boleto, recibo ou item financeiro claro.
- Em arquivos de amortização, boleto parcelado, simulação, carnê ou cronograma, cada linha/parcela é um lançamento separado.
- Todo lançamento parcelado deve ter número da parcela na descrição, por exemplo "Parcela 15/49".
- Toda linha com parcela deve preencher data_vencimento com a data de vencimento/amortização da própria linha.
- Quando houver coluna ou texto de status, identifique se está pago, quitado, baixado, liquidado, realizado, agendado/programado ou pendente.
- Se o arquivo for apenas cronograma futuro/simulação sem indicação de pagamento, use status "agendado" para parcelas futuras e "vencido" para parcelas passadas.
- Valor sempre positivo, com até 2 casas decimais. Use tipo "saida" para despesa/pagamento/custo e "entrada" para receita/aporte/reembolso recebido.
- Se o documento tiver valor negativo, converta para valor positivo e ajuste o tipo.
- "data" deve ser a data da parcela/vencimento quando o arquivo for cronograma de parcelas; se não existir, use "${today}".
- "data_vencimento" é a data de vencimento; se não existir, null.
- "data_pagamento" só deve existir quando o arquivo indicar pagamento realizado.
- Se já está pago/quitado/baixado/realizado, status "pago"; se vencimento é futuro e não pago, "pendente" ou "agendado"; se vencimento anterior a ${today} e não pago, "vencido".
- Use categoria_id/tipo_cpp_id somente quando houver correspondência clara nas listas abaixo; caso contrário null.
- Limite máximo: 80 lançamentos.

Pré-leitura determinística de parcelas encontrada no arquivo.
Use estes itens como base quando fizerem sentido; não descarte parcelas claras com data e valor:
${JSON.stringify(deterministicLancamentos)}

Categorias disponíveis:
${JSON.stringify(categoriaOptions)}

Tipos CPP disponíveis:
${JSON.stringify(tipoCppOptions)}

ARQUIVO:
${textContent}`;

      const userContent: any = isImageFile
        ? [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
              },
            },
          ]
        : prompt;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: userContent }],
        temperature: 0,
        max_tokens: 6000,
      });

      const raw = (response.choices[0]?.message?.content || "").trim();
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("Não foi possível interpretar a resposta da IA. Tente com um arquivo menor ou mais estruturado.");
      }

      const validStatuses = new Set(["pendente", "agendado", "pago", "parcial", "vencido", "cancelado"]);
      const validCategoryIds = new Set(categoriaOptions.map((c: any) => String(c.id)));
      const validTipoCppIds = new Set(tipoCppOptions.map((c: any) => String(c.id)));
      const aiLancamentos = Array.isArray(parsed?.lancamentos) ? parsed.lancamentos : [];
      const sourceLancamentos = deterministicLancamentos.length > aiLancamentos.length
        ? deterministicLancamentos
        : aiLancamentos.length > 0 ? aiLancamentos : deterministicLancamentos;
      const lancamentos = sourceLancamentos
        .slice(0, 80)
        .map((item: any) => {
          const rawValue = Number(item.valor || 0);
          const tipo = item.tipo === "entrada" || item.tipo === "saida"
            ? item.tipo
            : rawValue < 0 ? "saida" : "entrada";
          const categoriaId = item.categoria_id != null && validCategoryIds.has(String(item.categoria_id)) ? item.categoria_id : null;
          const tipoCppId = item.tipo_cpp_id != null && validTipoCppIds.has(String(item.tipo_cpp_id)) ? item.tipo_cpp_id : null;
          const status = validStatuses.has(String(item.status || "")) ? String(item.status) : "pendente";
          const dataVencimento = /^\d{4}-\d{2}-\d{2}$/.test(String(item.data_vencimento || "")) ? item.data_vencimento : null;
          const dataPagamento = /^\d{4}-\d{2}-\d{2}$/.test(String(item.data_pagamento || "")) ? item.data_pagamento : null;
          const data = /^\d{4}-\d{2}-\d{2}$/.test(String(item.data || "")) ? item.data : dataVencimento || today;
          return {
            tipo,
            valor: Math.abs(Number(rawValue.toFixed ? rawValue.toFixed(2) : rawValue) || 0),
            data,
            data_vencimento: dataVencimento,
            data_pagamento: dataPagamento,
            status,
            descricao: String(item.descricao || "Lançamento importado por IA").slice(0, 180),
            categoria_id: categoriaId,
            categoria_nome: item.categoria_nome || null,
            tipo_cpp_id: tipoCppId,
            tipo_cpp_nome: item.tipo_cpp_nome || null,
            observacao: item.observacao ? String(item.observacao).slice(0, 180) : null,
          };
        })
        .filter((item: any) => item.valor > 0);

      res.json({
        success: true,
        arquivo: file.originalname,
        lancamentos,
        observacao: parsed?.observacao || null,
      });
    } catch (error: any) {
      console.error("[fluxo-importar-anexos]", error.message);
      res.status(500).json({ error: "Erro ao analisar arquivo: " + error.message });
    }
  });

  app.post("/api/fluxo-caixa", async (req, res) => {
    try {
      const body = req.body;
      const biaId = String(body.bia || body.bia_id || "");
      if (!biaId) return res.status(400).json({ error: "bia_id e obrigatorio" });
      if (!await requireBiaModuleAccess(req, res, biaId, "capital_financeiro", "edit")) return;
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
      const snapshot = await fetchFluxoSnapshot(String(item.id)).catch(() => item);
      await registrarFluxoHistorico({
        fluxoId: String(item.id),
        acao: "criado",
        req,
        depois: snapshot,
        payload: body,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      const flowAccess = await requireFluxoAccess(req, res, req.params.id, "edit");
      if (!flowAccess) return;
      const antes = flowAccess.snapshot;
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
      const depois = await fetchFluxoSnapshot(req.params.id).catch(() => item);
      await registrarFluxoHistorico({
        fluxoId: req.params.id,
        acao: "editado",
        req,
        antes,
        depois,
        payload: body,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function normalizePaymentText(value: unknown): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function categoriaNameFromRel(rel: any): string {
    if (!rel) return "";
    if (rel.categorias_id && typeof rel.categorias_id === "object") {
      return rel.categorias_id.Nome_da_categoria || "";
    }
    return rel.Nome_da_categoria || "";
  }

  function isFluxoDeibDivisor(item: any): boolean {
    const descricao = normalizePaymentText(item?.descricao);
    const categorias = Array.isArray(item?.Categoria) ? item.Categoria : [];
    const hasDivisor = descricao.startsWith("divisor multiplicador");
    const hasDeib = categorias.some((cat: any) => {
      const name = normalizePaymentText(categoriaNameFromRel(cat));
      return name.includes("direito economico institucional built") && (name.includes("dei-b") || name.includes("built"));
    });
    return hasDivisor && hasDeib;
  }

  function parseMoneyValue(value: unknown): number {
    if (typeof value === "number") return value;
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
    return Number(raw);
  }

  async function fetchFluxoForPayment(id: string) {
    const items = await directusFetchScoped(
      "fluxo_caixa",
      `fields=*,Categoria.categorias_id.*&filter[id][_eq]=${encodeURIComponent(id)}`
    );
    return items[0] || null;
  }

  function getBaseUrl(req: any): string {
    const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null);
    if (rawDomain) return rawDomain.replace(/\/$/, "");
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return `${proto}://${host}`;
  }

  async function markFluxoPagamentoPago(id: string, provider: "asaas" | "stripe", paymentId?: string | null) {
    const antes = await fetchFluxoSnapshot(id).catch(() => null);
    await directusUpdate("fluxo_caixa", id, {
      status: "pago",
      data_pagamento: new Date().toISOString().split("T")[0],
      pagamento_status: "pago",
      pagamento_provider: provider,
      ...(paymentId ? { pagamento_id: paymentId } : {}),
    });
    const depois = await fetchFluxoSnapshot(id).catch(() => null);
    await registrarFluxoHistorico({
      fluxoId: id,
      acao: "pagamento_confirmado",
      origem: `webhook:${provider}`,
      antes,
      depois,
      payload: { provider, paymentId },
    }).catch((err: any) => console.error("[fluxo_historico] pagamento_confirmado:", err.message));
  }

  async function createAsaasBoleto(params: {
    fluxoId: string;
    nome: string;
    email: string;
    documento: string;
    valor: number;
    vencimento?: string | null;
    descricao: string;
  }) {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY nao configurada. Adicione a chave do Asaas no ambiente.");
    }
    const baseUrl = (process.env.ASAAS_API_URL || "https://api.asaas.com/v3").replace(/\/$/, "");
    const headers = {
      "Content-Type": "application/json",
      access_token: apiKey,
    };
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: params.nome,
        email: params.email,
        cpfCnpj: params.documento.replace(/\D/g, ""),
      }),
    });
    if (!customerRes.ok) {
      const text = await customerRes.text().catch(() => "");
      throw new Error(readProviderError(text, `Erro ao criar cliente no Asaas (${customerRes.status})`));
    }
    const customer = await customerRes.json();
    const dueDate = params.vencimento || new Date().toISOString().split("T")[0];
    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customer.id,
        billingType: "BOLETO",
        value: Number(params.valor.toFixed(2)),
        dueDate,
        description: params.descricao,
        externalReference: `fluxo_caixa:${params.fluxoId}`,
      }),
    });
    if (!paymentRes.ok) {
      const text = await paymentRes.text().catch(() => "");
      throw new Error(readProviderError(text, `Erro ao criar cobranÃ§a no Asaas (${paymentRes.status})`));
    }
    const payment = await paymentRes.json();
    return {
      id: payment.id,
      url: payment.bankSlipUrl || payment.invoiceUrl || payment.transactionReceiptUrl,
      status: payment.status || "pendente",
    };
  }

  function readProviderError(text: string, fallback: string): string {
    try {
      const parsed = JSON.parse(text);
      const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
      if (first?.description) return String(first.description);
      if (parsed?.error) return String(parsed.error);
      if (parsed?.message) return String(parsed.message);
    } catch {}
    return fallback;
  }

  app.post("/api/fluxo-caixa/:id/gerar-pagamento", async (req, res) => {
    try {
      if (!await requireFluxoAccess(req, res, req.params.id, "edit")) return;
      const pais = req.body?.pais === "fora" ? "fora" : "brasil";
      const nome = String(req.body?.nome || "").trim();
      const email = String(req.body?.email || "").trim();
      const documento = String(req.body?.documento || "").trim();
      if (!nome || !email || (pais === "brasil" && !documento)) {
        return res.status(400).json({ error: "Informe nome, email e CPF/CNPJ quando o pagamento for do Brasil." });
      }

      const item = await fetchFluxoForPayment(req.params.id);
      if (!item) return res.status(404).json({ error: "Lancamento nao encontrado" });
      if (!isFluxoDeibDivisor(item)) {
        return res.status(400).json({ error: "Pagamento permitido apenas para Divisor Multiplicador DEI-B." });
      }

      const valor = Math.abs(parseMoneyValue(item.valor));
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(400).json({ error: "Valor do lancamento invalido para pagamento." });
      }

      const descricao = `Divisor Multiplicador DEI-B - ${item.descricao || item.id}`;
      let payment: { id: string; url: string; status: string };
      if (pais === "brasil") {
        payment = await createAsaasBoleto({
          fluxoId: req.params.id,
          nome,
          email,
          documento,
          valor,
          vencimento: item.data_vencimento,
          descricao,
        });
      } else {
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
          name: nome,
          email,
          metadata: {
            fluxo_caixa_id: String(item.id),
            pagamento_tipo: "fluxo_caixa_deib",
          },
        });
        const invoice = await stripe.invoices.create({
          customer: customer.id,
          collection_method: "send_invoice",
          days_until_due: 7,
          auto_advance: false,
          metadata: {
            fluxo_caixa_id: String(item.id),
            pagamento_tipo: "fluxo_caixa_deib",
            pagador_nome: nome,
          },
        });
        await stripe.invoiceItems.create({
          customer: customer.id,
          invoice: invoice.id,
          currency: "brl",
          amount: Math.round(valor * 100),
          description: descricao,
        });
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        if (!finalizedInvoice.hosted_invoice_url) {
          return res.status(502).json({ error: "Erro ao obter link da fatura do Stripe." });
        }
        payment = {
          id: finalizedInvoice.id,
          url: finalizedInvoice.hosted_invoice_url,
          status: finalizedInvoice.status || "pendente",
        };
      }

      await directusUpdate("fluxo_caixa", req.params.id, {
        pagamento_provider: pais === "brasil" ? "asaas" : "stripe",
        pagamento_id: payment.id,
        pagamento_url: payment.url,
        pagamento_status: payment.status,
        pagamento_pais: pais,
        pagamento_pagador_nome: nome,
        pagamento_pagador_email: email,
        pagamento_pagador_documento: documento || null,
        pagamento_gerado_em: new Date().toISOString(),
      });
      const depoisPagamento = await fetchFluxoSnapshot(req.params.id).catch(() => null);
      await registrarFluxoHistorico({
        fluxoId: req.params.id,
        acao: "pagamento_gerado",
        req,
        origem: pais === "brasil" ? "asaas" : "stripe",
        antes: item,
        depois: depoisPagamento,
        payload: { pais, nome, email, documento: documento || null, payment },
      });

      res.json({
        provider: pais === "brasil" ? "asaas" : "stripe",
        id: payment.id,
        url: payment.url,
        status: payment.status,
      });
    } catch (error: any) {
      console.error("[fluxo_pagamento] gerar-pagamento error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      const flowAccess = await requireFluxoAccess(req, res, req.params.id, "edit");
      if (!flowAccess) return;
      const antes = flowAccess.snapshot;
      await registrarFluxoHistorico({
        fluxoId: req.params.id,
        acao: "excluido",
        req,
        antes,
        payload: { id: req.params.id },
      });
      // Limpa relaÃ§Ãµes M2M primeiro para evitar violaÃ§Ã£o de foreign key
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
  const PLANO_CONTAS_CATEGORIAS = [
    { nome: "1.1 Venda do ativo / unidades", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA DO PRÃ“PRIO NEGÃ“CIO" },
    { nome: "1.2 Receita de locaÃ§Ã£o", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA DO PRÃ“PRIO NEGÃ“CIO" },
    { nome: "1.3 Receita de operaÃ§Ã£o", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA DO PRÃ“PRIO NEGÃ“CIO" },
    { nome: "1.4 Receita extra", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA DO PRÃ“PRIO NEGÃ“CIO" },
    { nome: "2.1 Aporte inicial", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA POR APORTE DOS PARTICIPANTES" },
    { nome: "2.2 Aportes por chamadas de capital", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA POR APORTE DOS PARTICIPANTES" },
    { nome: "2.3 Aporte emergencial", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA POR APORTE DOS PARTICIPANTES" },
    { nome: "2.4 Aporte complementar", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA POR APORTE DOS PARTICIPANTES" },
    { nome: "2.5 Provisionamento de recursos", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA POR APORTE DOS PARTICIPANTES" },
    { nome: "3.1 EmprÃ©stimos e financiamento bancÃ¡rio", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA VIA FUNDING / DÃVIDA" },
    { nome: "3.2 DÃ­vida com investidores", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA VIA FUNDING / DÃVIDA" },
    { nome: "3.3 AntecipaÃ§Ã£o de recebÃ­veis", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA VIA FUNDING / DÃVIDA" },
    { nome: "3.4 Tranches condicionadas", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA VIA FUNDING / DÃVIDA" },
    { nome: "3.5 LiberaÃ§Ãµes por marcos e garantias", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA VIA FUNDING / DÃVIDA" },
    { nome: "4.1 Reembolsos", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "4.2 Estornos e devoluÃ§Ãµes", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "4.3 CrÃ©ditos e bÃ´nus de fornecedores", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "4.4 RecuperaÃ§Ã£o e ressarcimento", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "4.5 Receitas financeiras", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "4.6 Ajustes e regularizaÃ§Ãµes financeiras", tipo: "Entrada", grupo: "ENTRADAS DE CAIXA OPERACIONAIS E AJUSTES" },
    { nome: "5.1 Taxas internas do veÃ­culo", tipo: "Entrada", grupo: "ENTRADAS LIGADAS Ã€ GOVERNANÃ‡A / MÃ‰TODO BUILT" },
    { nome: "5.2 Multas contratuais recebidas", tipo: "Entrada", grupo: "ENTRADAS LIGADAS Ã€ GOVERNANÃ‡A / MÃ‰TODO BUILT" },
    { nome: "5.3 Penalidades e recomposiÃ§Ãµes financeiras", tipo: "Entrada", grupo: "ENTRADAS LIGADAS Ã€ GOVERNANÃ‡A / MÃ‰TODO BUILT" },
    { nome: "6.1 IntegralizaÃ§Ã£o de ativo", tipo: "Entrada", grupo: "ENTRADAS PATRIMONIAIS NÃƒO-CAIXA" },
    { nome: "6.2 Aportes em bens", tipo: "Entrada", grupo: "ENTRADAS PATRIMONIAIS NÃƒO-CAIXA" },
    { nome: "6.3 Aportes em direitos e cessÃµes", tipo: "Entrada", grupo: "ENTRADAS PATRIMONIAIS NÃƒO-CAIXA" },
    { nome: "6.4 EsforÃ§o multiplicador convertido em CPP", tipo: "Entrada", grupo: "ENTRADAS PATRIMONIAIS NÃƒO-CAIXA" },
    { nome: "1.1 Valor de Origem", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.2 Due diligence e validaÃ§Ã£o do ativo", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.3 EstruturaÃ§Ã£o jurÃ­dica da origem", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.4 FormalizaÃ§Ã£o da BIA", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.5 Direito EconÃ´mico Institucional BUILT", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.6 Direito EconÃ´mico Institucional do Aliado", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "1.7 Direito EconÃ´mico por LideranÃ§a de AlianÃ§a", tipo: "SaÃ­da", grupo: "ORIGINAÃ‡ÃƒO E ESTRUTURAÃ‡ÃƒO DO ATIVO" },
    { nome: "2.1 Estudos e viabilidade", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.2 Projetos e CompatibilizaÃ§Ã£o", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.3 AprovaÃ§Ãµes e legalizaÃ§Ã£o", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.4 Consultorias tÃ©cnicas", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.5 JurÃ­dico e Auditoria", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.6 Treinamentos tÃ©cnicos", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.7 DocumentaÃ§Ã£o tÃ©cnica e regularizaÃ§Ã£o final", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "2.8 Direito EconÃ´mico por LideranÃ§a TÃ©cnica", tipo: "SaÃ­da", grupo: "NÃšCLEO TÃ‰CNICO" },
    { nome: "3.1 GestÃ£o e acompanhamento da obra", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.2 Despesas Preliminares", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.3 FundaÃ§Ãµes e Estrutura", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.4 VedaÃ§Ãµes e coberturas", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.5 InstalaÃ§Ãµes e automaÃ§Ã£o", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.6 Acabamentos", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.7 UrbanizaÃ§Ã£o e Ã¡reas externas", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.8 Entrega tÃ©cnica, testes e ajustes finais", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.9 ServiÃ§os recorrentes de operaÃ§Ãµes e facilities", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.10 ReposiÃ§Ã£o por garantia", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.11 Medicina e seguranÃ§a do trabalho", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.12 Treinamentos operacionais", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.13 LogÃ­stica, suprimentos e equipamentos", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.14 Qualidade e controle tecnolÃ³gico", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "3.15 Direito EconÃ´mico por LideranÃ§a de Obra", tipo: "SaÃ­da", grupo: "NÃšCLEO DE OBRA" },
    { nome: "4.1 Branding e posicionamento", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.2 Marketing direto", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.3 Vendas", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.4 LocaÃ§Ã£o", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.5 Networking e relacionamento com o mercado", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.6 SAC e pÃ³s-venda", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.7 Custos de plataformas e canais", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.8 Treinamentos comerciais", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.9 InteligÃªncia comercial e precificaÃ§Ã£o", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "4.10 Direito EconÃ´mico por LideranÃ§a Comercial", tipo: "SaÃ­da", grupo: "NÃšCLEO COMERCIAL" },
    { nome: "5.1 CaptaÃ§Ã£o de recursos", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.2 GestÃ£o financeira", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.3 GestÃ£o contÃ¡bil", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.4 CondomÃ­nio e despesas recorrentes do ativo", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.5 Tributos patrimoniais e fiscais", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.6 Seguros e garantias", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.7 ContingÃªncia e passivos", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.8 DistribuiÃ§Ã£o e encerramento patrimonial", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
    { nome: "5.9 Direito EconÃ´mico por LideranÃ§a de Capital", tipo: "SaÃ­da", grupo: "NÃšCLEO DE CAPITAL" },
  ];

  const PLANO_CONTAS_NOMES = new Set(PLANO_CONTAS_CATEGORIAS.map((c) => c.nome));

  async function ensureCategoriaBiaField() {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/Categorias`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "bia_id",
          type: "string",
          meta: { interface: "input", display: "raw", hidden: false, note: "BIA vinculada para categorias customizadas" },
          schema: { is_nullable: true },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.errors?.[0]?.extensions?.code;
        if (code !== "RECORD_NOT_UNIQUE" && code !== "FORBIDDEN") {
          console.warn(`[categorias] Field bia_id response: ${res.status}`);
        }
      }
    } catch (err: any) {
      console.warn(`[categorias] bia_id field not ensured: ${err.message}`);
    }
  }

  async function ensurePlanoContasCategorias() {
    const items = await directusFetch("Categorias");
    const byName = new Map<string, any>();
    for (const item of items) {
      const name = String(item.Nome_da_categoria || "").trim();
      if (name) byName.set(name, item);
    }
    for (const cat of PLANO_CONTAS_CATEGORIAS) {
      const existing = byName.get(cat.nome);
      const payload = {
        Nome_da_categoria: cat.nome,
        Tipo_de_categoria: cat.tipo,
        Descricao_das_categorias: cat.grupo,
      };
      if (existing) {
        if (existing.Tipo_de_categoria !== cat.tipo || existing.Descricao_das_categorias !== cat.grupo) {
          await directusUpdate("Categorias", existing.id, payload);
        }
      } else {
        await directusCreate("Categorias", payload);
      }
    }
  }

  await ensurePlanoContasCategorias().catch((err: any) => {
    console.warn(`[categorias] Plano de contas nÃ£o sincronizado: ${err.message}`);
  });

  await ensureCategoriaBiaField();

  app.get("/api/categorias", async (req, res) => {
    try {
      const biaId = typeof req.query.bia_id === "string" ? req.query.bia_id : "";
      const items = await directusFetch("Categorias");
      const mapped = items.map((c: any) => ({ id: c.id, Nome_da_categoria: c.Nome_da_categoria, Descricao_das_categorias: c.Descricao_das_categorias, Tipo_de_categoria: c.Tipo_de_categoria || null, bia_id: c.bia_id || null }));
      const sortCategorias = (a: any, b: any) =>
        String(a.Tipo_de_categoria || "").localeCompare(String(b.Tipo_de_categoria || ""), "pt-BR") ||
        String(a.Nome_da_categoria || "").localeCompare(String(b.Nome_da_categoria || ""), "pt-BR", { numeric: true });
      const plano = mapped.filter((c: any) => PLANO_CONTAS_NOMES.has(c.Nome_da_categoria)).sort(sortCategorias);
      const customDaBia = mapped.filter((c: any) => !PLANO_CONTAS_NOMES.has(c.Nome_da_categoria) && c.bia_id === biaId).sort(sortCategorias);
      res.json(plano.length > 0 ? [...plano, ...customDaBia] : mapped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categorias", async (req, res) => {
    try {
      const item = await directusCreate("Categorias", {
        Nome_da_categoria: req.body.nome || req.body.Nome_da_categoria,
        Descricao_das_categorias: req.body.descricao || req.body.Descricao_das_categorias || "Categorias da BIA",
        Tipo_de_categoria: req.body.tipo || req.body.Tipo_de_categoria || null,
        bia_id: req.body.bia_id || null,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== OPORTUNIDADES (from Directus: tipos_oportunidades) ==========
  function fixMojibakeText(value: unknown): string | undefined {
    if (typeof value !== "string" || !value) return undefined;
    const cleanReplacementChars = (text: string) => text
      .replace(/Veï¿½neto/gi, "Veneto")
      .replace(/Eleï¿½trico/gi, "ElÃ©trico")
      .replace(/Climatizaï¿½ï¿½o/gi, "ClimatizaÃ§Ã£o")
      .replace(/\uFFFD+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!/[ÃƒÃ‚ÃŒÃÃŽÃ]|[\u0080-\u009F]/.test(value)) return cleanReplacementChars(value.normalize("NFC"));
    try {
      return cleanReplacementChars(Buffer.from(value, "latin1").toString("utf8").normalize("NFC"));
    } catch {
      return cleanReplacementChars(value.normalize("NFC"));
    }
  }

  function resolveOpaLocation(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return fixMojibakeText(value) || value;
    if (typeof value === "object") {
      const location = value as Record<string, any>;
      return fixMojibakeText(location.display_name)
        || fixMojibakeText(location.localizacao)
        || fixMojibakeText(location.label)
        || fixMojibakeText(location.address)
        || null;
    }
    return String(value);
  }

  async function canAccessProtectedOpaActions(req: Request): Promise<boolean> {
    const role = (req.session as any)?.role;
    if (role === "admin" || role === "manager" || role === "superadmin" || role === "aliado" || role === "membro") return true;

    const membroId = (req.session as any)?.membroId as string | undefined;
    if (!membroId) return false;

    const membro = await directusFetchOne(
      "cadastro_geral",
      membroId,
      "fields=em_membros_built",
    ).catch(() => null);

    return membro?.em_membros_built === true;
  }

  function resolveAnexosOpa(items: any[], includeAnexos = true): any[] {
    return items.map((o: any) => ({
      id: o.id,
      nome_oportunidade: o.nome_oportunidade,
      tipo: o.tipo,
      ramo_atuacao: o.ramo_atuacao || null,
      bia: o.bia,
      bia_id: o.bia,
      valor_origem_opa: o.valor_origem_opa,
      Minimo_esforco_multiplicador: o.Minimo_esforco_multiplicador,
      objetivo_alianca: o.objetivo_alianca,
      nucleo_alianca: o.nucleo_alianca,
      pais: o.pais,
      descricao: o.descricao,
      perfil_aliado: o.perfil_aliado,
      imagem_directus_id: o.imagem_directus_id || null,
      imagem_url: assetApiUrl(o.imagem_directus_id),
      status: o.status || "ativa",
      motivo_encerramento: o.motivo_encerramento || null,
      date_created: o.date_created || null,
      user_created: directusRelationId(o.user_created) || o.user_created || null,
      criado_por_user_id: o.criado_por_user_id || null,
      criado_por_membro_id: o.criado_por_membro_id || null,
      localizacao: resolveOpaLocation(o.localizacao),
      latitude: o.latitude ?? null,
      longitude: o.longitude ?? null,
      Anexos: includeAnexos ? (o.anexos || []).map((a: any) => {
        const f = a?.directus_files_id;
        if (!f || typeof f !== "object") return null;
        const filename = fixMojibakeText(f.filename_download) || fixMojibakeText(f.title) || f.id;
        const title = fixMojibakeText(f.title) || filename;
        return {
          id: f.id,
          title,
          filename,
          url: assetApiUrl(f.id),
          size: f.filesize ? `${Math.round(f.filesize / 1024)} KB` : null,
        };
      }).filter(Boolean) : [],
    }));
  }

  app.get("/api/oportunidades", async (req, res) => {
    try {
      const items = await directusFetch("tipos_oportunidades", "fields=*,anexos.directus_files_id.*");
      const canSeeAnexos = await canAccessProtectedOpaActions(req);
      res.json(resolveAnexosOpa(items, canSeeAnexos));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function normalizeChamadaCapitalPayload(body: Record<string, any>): Record<string, any> {
    const numberText = (value: any) => {
      if (value === null || value === undefined || value === "") return null;
      const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? String(parsed) : null;
    };

    const textOrNull = (value: any) => {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text || null;
    };

    return {
      nome_oportunidade: textOrNull(body.nome_oportunidade || body.titulo),
      tipo: textOrNull(body.tipo),
      ramo_atuacao: textOrNull(body.ramo_atuacao),
      bia_id: textOrNull(body.bia_id || body.bia),
      valor_origem_opa: numberText(body.valor_origem_opa),
      Minimo_esforco_multiplicador: numberText(body.Minimo_esforco_multiplicador),
      objetivo_alianca: textOrNull(body.objetivo_alianca),
      nucleo_alianca: textOrNull(body.nucleo_alianca),
      pais: textOrNull(body.pais) || "Brasil",
      localizacao: textOrNull(body.localizacao),
      descricao: textOrNull(body.descricao),
      perfil_aliado: textOrNull(body.perfil_aliado),
      status: textOrNull(body.status) || "ativa",
      imagem_directus_id: textOrNull(body.imagem_directus_id),
      imagem_url: textOrNull(body.imagem_url),
    };
  }

  const chamadasCapitalFile = path.join(process.cwd(), "data", "chamadas-capital.json");

  function readChamadasCapitalFile(): any[] {
    try {
      if (!fs.existsSync(chamadasCapitalFile)) return [];
      const raw = fs.readFileSync(chamadasCapitalFile, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeChamadasCapitalFile(items: any[]) {
    fs.mkdirSync(path.dirname(chamadasCapitalFile), { recursive: true });
    fs.writeFileSync(chamadasCapitalFile, JSON.stringify(items, null, 2), "utf8");
  }

  app.get("/api/chamadas-capital", async (_req, res) => {
    try {
      const items = readChamadasCapitalFile()
        .sort((a, b) => String(b.date_created || b.created_at || "").localeCompare(String(a.date_created || a.created_at || "")));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chamadas-capital/:id", async (req, res) => {
    try {
      const item = readChamadasCapitalFile().find((chamada) => String(chamada.id) === String(req.params.id));
      if (!item) return res.status(404).json({ error: "Chamada de capital nao encontrada" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chamadas-capital", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
      const payload = normalizeChamadaCapitalPayload(req.body);
      if (!payload.nome_oportunidade) {
        return res.status(400).json({ error: "Informe o nome da chamada de capital" });
      }
      const now = new Date().toISOString();
      const item = {
        id: randomUUID(),
        ...payload,
        criado_por_user_id: (req.session as any).directusUserId || null,
        criado_por_membro_id: (req.session as any).membroId || null,
        date_created: now,
        created_at: now,
        updated_at: now,
      };
      const items = readChamadasCapitalFile();
      items.unshift(item);
      writeChamadasCapitalFile(items);
      res.status(201).json(item);
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
    if (typeof data.localizacao === "string") {
      data.localizacao = data.localizacao.trim()
        ? { display_name: data.localizacao.trim() }
        : null;
    }
    if (typeof data.ramo_atuacao === "string") {
      data.ramo_atuacao = data.ramo_atuacao.trim() || null;
    }
    if (data.tipo === "Investimento") {
      data.tipo = "Aporte Financeiro";
    }
    return data;
  }

  async function canManageOpa(req: Request, opaId: string): Promise<boolean> {
    const sessionUserId = (req.session as any).directusUserId as string | undefined;
    const sessionMembroId = (req.session as any).membroId as string | undefined;
    const role = (req.session as any).role;
    if (!sessionUserId) return false;
    if (role === "admin" || role === "manager") return true;

    const opa = await directusFetchOne("tipos_oportunidades", opaId);
    if (!opa) return false;

    const opaCreatorUserId = directusRelationId(opa.user_created) || opa.user_created || opa.criado_por_user_id || null;
    if (opaCreatorUserId && String(opaCreatorUserId) === String(sessionUserId)) return true;
    if (sessionMembroId && opa.criado_por_membro_id && String(opa.criado_por_membro_id) === String(sessionMembroId)) return true;

    const biaId = directusRelationId(opa.bia) || opa.bia || null;
    if (!biaId || !sessionMembroId) return false;
    const bia = await directusFetchOne("bias_projetos", String(biaId), "fields=id,aliado_built");
    return String(directusRelationId(bia?.aliado_built) || bia?.aliado_built || "") === String(sessionMembroId);
  }

  async function ensureCanLinkOpaToBia(req: Request, payload: Record<string, any>) {
    const biaId = directusRelationId(payload.bia) || directusRelationId(payload.bia_id) || null;
    if (!biaId) return;

    const sessionMembroId = (req.session as any).membroId as string | undefined;
    if (!sessionMembroId) {
      const error: any = new Error("Seu perfil nÃ£o estÃ¡ vinculado a um membro para criar OBA nesta BIA.");
      error.statusCode = 403;
      throw error;
    }

    const bia = await directusFetchOne(
      "bias_projetos",
      String(biaId),
      "fields=id,autor_bia,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital,socios_guardioes,socios_multiplicadores,terceiros",
    );
    if (!bia) {
      const error: any = new Error("BIA vinculada nÃ£o encontrada.");
      error.statusCode = 404;
      throw error;
    }
    if (!isUserLinkedToBia(bia, sessionMembroId)) {
      const error: any = new Error("VocÃª sÃ³ pode vincular OBAs a BIAs em que estÃ¡ associado.");
      error.statusCode = 403;
      throw error;
    }
  }

  app.post("/api/oportunidades", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      await ensureOpaMediaFields();
      const payload = prepareOpaPayload(req.body);
      await ensureCanLinkOpaToBia(req, payload);
      payload.criado_por_user_id = (req.session as any).directusUserId || null;
      payload.criado_por_membro_id = (req.session as any).membroId || null;
      let item;
      try {
        item = await directusCreate("tipos_oportunidades", payload);
      } catch (error: any) {
        if (!String(error?.message || "").includes("criado_por_")) throw error;
        delete payload.criado_por_user_id;
        delete payload.criado_por_membro_id;
        item = await directusCreate("tipos_oportunidades", payload);
      }
      res.json(item);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/oportunidades/tipos", async (req, res) => {
    try {
      const r = await fetch(`${DIRECTUS_URL}/fields/tipos_oportunidades/tipo`, {
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
      });
      const d = await r.json();
      const choices: { text: string; value: string }[] = d?.data?.meta?.options?.choices || [];
      res.json(choices.map((choice) => {
        if (choice.text === "Investimento" || choice.value === "Investimento") {
          return { ...choice, text: "Aporte Financeiro", value: "Aporte Financeiro" };
        }
        return choice;
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/oportunidades/:id", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      if (!(await canManageOpa(req, req.params.id))) {
        return res.status(403).json({ error: "Sem permissÃ£o para editar esta OBA" });
      }
      await ensureOpaMediaFields();
      const payload = prepareOpaPayload(req.body);
      await ensureCanLinkOpaToBia(req, payload);
      const item = await directusUpdate("tipos_oportunidades", req.params.id, payload);
      res.json(item);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/oportunidades/:id", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      if (!(await canManageOpa(req, req.params.id))) {
        return res.status(403).json({ error: "Sem permissÃ£o para excluir esta OBA" });
      }
      await directusDelete("tipos_oportunidades", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== OBA INTERESSES ==========
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

  app.patch("/api/oportunidades/:id/interesse/:interesseId", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const allowedStatuses = new Set([
        "interesse_recebido",
        "em_analise",
        "em_tratativa",
        "alianca_firmada",
        "nao_selecionado",
        "em_espera",
      ]);
      const statusCrm = String(req.body.status_crm || "");
      if (!allowedStatuses.has(statusCrm)) {
        return res.status(400).json({ error: "Status invÃ¡lido" });
      }
      const item = await storage.updateOpaInteresse(req.params.interesseId, {
        status_crm: statusCrm,
        observacao_crm: req.body.observacao_crm ? String(req.body.observacao_crm) : null,
      } as any);
      if (!item || item.opa_id !== req.params.id) return res.status(404).json({ error: "ManifestaÃ§Ã£o nÃ£o encontrada" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oportunidades/:id/interesse", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId as string | undefined;
      if (!directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const canManifestar = await canAccessProtectedOpaActions(req);
      if (!canManifestar) {
        return res.status(403).json({
          error: "Para manifestar interesse, conclua sua adesão ao BUILT Alliances.",
        });
      }
      const membroId = (req.session as any).membroId as string | undefined;
      const nome = (req.session as any).nome as string | undefined;
      const { id } = req.params;
      const existing = await storage.getUserInteresseByOpa(id, directusUserId);
      if (existing) return res.status(409).json({ error: "Interesse jÃ¡ registrado" });
      const multiplicador = req.body.multiplicador != null ? String(req.body.multiplicador) : null;
      // Validate submitted multiplicador against OBA minimum
      if (multiplicador != null) {
        const opaFields = await directusFetchOne("tipos_oportunidades", id, "fields=Minimo_esforco_multiplicador");
        const minMult = parseFloat(String(opaFields?.Minimo_esforco_multiplicador || "0")) || 0;
        if (minMult > 0 && parseFloat(multiplicador) < minMult) {
          return res.status(400).json({ error: `O multiplicador deve ser de no mÃ­nimo ${minMult}%.` });
        }
      }
      const item = await storage.createOpaInteresse({
        opa_id: id,
        user_id: directusUserId,
        membro_id: membroId || null,
        membro_nome: nome || directusUserId,
        mensagem: req.body.mensagem || null,
        multiplicador,
      });
      res.json(item);

      // Fire-and-forget: notify Diretor de AlianÃ§a and Aliado BUILT of linked BIA
      (async () => {
        try {
          const { notificarInteresseOpa } = await import("./mailer");
          // Directus stores the BIA link in field 'bia' (not 'bia_id')
          const opa = await directusFetchOne("tipos_oportunidades", id, "fields=nome_oportunidade,bia");
          console.log(`[interesse-opa] OBA fetched: id=${id} nome=${opa?.nome_oportunidade} bia=${opa?.bia}`);
          const rawBiaId = opa?.bia;
          // bia may be a plain UUID string or a Directus M2O object {id:...}
          const biaId: string | null = rawBiaId
            ? (typeof rawBiaId === "object" ? String((rawBiaId as any).id) : String(rawBiaId))
            : null;
          const opaNome = (opa?.nome_oportunidade as string) || "OBA";
          if (!biaId) {
            console.warn(`[interesse-opa] OBA ${id} has no bia linked, skipping email notification`);
            return;
          }
          // Fetch the BIA to get roles and name
          const bia = await directusFetchOne("bias_projetos", biaId, "fields=nome_bia,diretor_alianca,aliado_built");
          console.log(`[interesse-opa] BIA fetched: id=${biaId} nome=${bia?.nome_bia} diretor=${bia?.diretor_alianca} aliado=${bia?.aliado_built}`);
          const biaNome = (bia?.nome_bia as string) || "BIA";
          const rawDiretor = bia?.diretor_alianca;
          const rawAliado = bia?.aliado_built;
          const diretorId: string | null = rawDiretor
            ? (typeof rawDiretor === "object" ? String((rawDiretor as any).id) : String(rawDiretor))
            : null;
          const aliadoId: string | null = rawAliado
            ? (typeof rawAliado === "object" ? String((rawAliado as any).id) : String(rawAliado))
            : null;

          async function fetchMemberEmail(mid: string): Promise<{ email: string; nome: string } | null> {
            try {
              const m = await directusFetchOne("cadastro_geral", mid, "fields=email,nome");
              console.log(`[interesse-opa] fetchMemberEmail id=${mid} email=${m?.email ?? "null"} nome=${m?.nome ?? "null"}`);
              if (m?.email) return { email: m.email as string, nome: (m.nome as string) || mid };
            } catch (e: any) {
              console.error(`[interesse-opa] fetchMemberEmail error id=${mid}:`, e?.message || e);
            }
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
                papel: "Diretor de AlianÃ§a",
                membroNome,
                membroId: membroId || null,
                opaNome,
                biaNome,
                mensagem: msgBody,
                multiplicador,
              });
              console.log(`[interesse-opa] email sent to diretor ${m.email}`);
            } else {
              console.warn(`[interesse-opa] diretor ${diretorId} has no email, skipping`);
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
              console.log(`[interesse-opa] email sent to aliado ${m.email}`);
            } else {
              console.warn(`[interesse-opa] aliado ${aliadoId} has no email, skipping`);
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
      if (!directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const { id } = req.params;
      await storage.deleteOpaInteresse(id, directusUserId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== LAND BANK ASSETS ==========
  function normalizeLandBankAssetRow(row: any) {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    return {
      ...data,
      id: row.local_id || row.id,
      category: row.category,
      bia_id: row.bia_id || data.bia_id || "",
      bia_nome: row.bia_nome || data.bia_nome || "",
      createdAt: row.created_at || row.date_created ? new Date(row.created_at || row.date_created).toISOString() : data.createdAt,
      updatedAt: row.updated_at || row.date_updated ? new Date(row.updated_at || row.date_updated).toISOString() : data.updatedAt,
      created_by: row.created_by || null,
      created_by_membro: row.created_by_membro || null,
      directus_id: row.local_id ? row.id : row.directus_id || null,
    };
  }

  async function fetchLandBankAssetsFromDirectus(category = "") {
    try {
      const params = `${category ? `filter[category][_eq]=${encodeURIComponent(category)}&` : ""}fields=*&sort=-date_created`;
      return (await directusFetchScoped("land_bank_assets", params)).map(normalizeLandBankAssetRow);
    } catch (error: any) {
      console.warn("[land-bank-directus] read skipped:", error?.message || error);
      return [];
    }
  }

  async function findDirectusLandBankByLocalId(localId: string) {
    const items = await directusFetchScoped(
      "land_bank_assets",
      `filter[local_id][_eq]=${encodeURIComponent(localId)}&limit=1&fields=*`
    ).catch(() => []);
    return items[0] || null;
  }

  async function upsertLandBankAssetToDirectus(asset: any, req: Request) {
    const localId = asset.id || asset.local_id;
    if (!localId) return null;
    const payload = {
      local_id: localId,
      category: asset.category || "land-bank",
      bia_id: asset.bia_id || null,
      bia_nome: asset.bia_nome || null,
      data: asset,
      created_by_membro: (req.session as any).membroId || asset.created_by_membro || null,
    };
    try {
      const existing = await findDirectusLandBankByLocalId(localId);
      if (existing?.id) return await directusUpdate("land_bank_assets", existing.id, payload);
      return await directusCreate("land_bank_assets", payload);
    } catch (error: any) {
      console.warn("[land-bank-directus] save skipped:", error?.message || error);
      return null;
    }
  }

  async function deleteLandBankAssetFromDirectus(localId: string) {
    try {
      const existing = await findDirectusLandBankByLocalId(localId);
      if (existing?.id) await directusDelete("land_bank_assets", existing.id);
    } catch (error: any) {
      console.warn("[land-bank-directus] delete skipped:", error?.message || error);
    }
  }

  app.get("/api/land-bank-assets", async (req, res) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const localResult = category
        ? await db.execute(sql`SELECT * FROM land_bank_assets WHERE category = ${category} ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM land_bank_assets ORDER BY created_at DESC`);
      const byId = new Map<string, any>();
      (localResult.rows || []).map(normalizeLandBankAssetRow).forEach((asset: any) => byId.set(asset.id, asset));
      (await fetchLandBankAssetsFromDirectus(category)).forEach((asset: any) => byId.set(asset.id, asset));
      res.json(Array.from(byId.values()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/land-bank-assets/:id", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT * FROM land_bank_assets WHERE id = ${req.params.id} LIMIT 1`);
      const row = result.rows?.[0];
      if (row) return res.json(normalizeLandBankAssetRow(row));
      const directusRow = await findDirectusLandBankByLocalId(req.params.id);
      if (!directusRow) return res.status(404).json({ error: "Ativo não encontrado" });
      res.json(normalizeLandBankAssetRow(directusRow));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/land-bank-assets", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const body = req.body || {};
      const id = body.id || `land-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const category = body.category || "land-bank";
      const data = {
        ...body,
        id,
        category,
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.execute(sql`
        INSERT INTO land_bank_assets (id, category, bia_id, bia_nome, data, created_by, created_by_membro)
        VALUES (
          ${id},
          ${category},
          ${body.bia_id || null},
          ${body.bia_nome || null},
          ${JSON.stringify(data)}::jsonb,
          ${(req.session as any).directusUserId || null},
          ${(req.session as any).membroId || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          bia_id = EXCLUDED.bia_id,
          bia_nome = EXCLUDED.bia_nome,
          data = EXCLUDED.data,
          updated_at = now()
      `);
      await upsertLandBankAssetToDirectus(data, req);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/land-bank-assets/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const currentResult = await db.execute(sql`SELECT * FROM land_bank_assets WHERE id = ${req.params.id} LIMIT 1`);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Ativo não encontrado" });
      const currentData = current.data && typeof current.data === "object" ? current.data : {};
      const data = {
        ...currentData,
        ...req.body,
        id: req.params.id,
        category: req.body.category || current.category,
        updatedAt: new Date().toISOString(),
      };
      await db.execute(sql`
        UPDATE land_bank_assets
        SET category = ${data.category},
            bia_id = ${data.bia_id || null},
            bia_nome = ${data.bia_nome || null},
            data = ${JSON.stringify(data)}::jsonb,
            updated_at = now()
        WHERE id = ${req.params.id}
      `);
      await upsertLandBankAssetToDirectus(data, req);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/land-bank-assets/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      await db.execute(sql`DELETE FROM land_bank_assets WHERE id = ${req.params.id}`);
      await deleteLandBankAssetFromDirectus(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function requireInventoryActor(req: Request) {
    const session = (req.session as any) || {};
    const userId = session.directusUserId || session.userId || null;
    const membroId = session.membroId || null;
    if (!userId && !membroId) {
      const error: any = new Error("Não autenticado");
      error.status = 401;
      throw error;
    }
    return { userId, membroId };
  }

  function normalizeInventarioRow(row: any) {
    const data = row?.data && typeof row.data === "object" ? row.data : {};
    return {
      ...data,
      id: row.id || data.id,
      owner_user_id: row.owner_user_id || data.owner_user_id || null,
      owner_membro_id: row.owner_membro_id || data.owner_membro_id || null,
      createdAt: data.createdAt || row.created_at,
      updatedAt: data.updatedAt || row.updated_at,
    };
  }

  function inventoryOwnerWhere(actor: { userId?: string | null; membroId?: string | null }) {
    if (actor.userId && actor.membroId) {
      return sql`(owner_user_id = ${actor.userId} OR owner_membro_id = ${actor.membroId})`;
    }
    if (actor.userId) return sql`owner_user_id = ${actor.userId}`;
    return sql`owner_membro_id = ${actor.membroId}`;
  }

  async function assertInventarioImovelOwner(imovelId: string, actor: { userId?: string | null; membroId?: string | null }) {
    const result = await db.execute(sql`
      SELECT * FROM inventario_imoveis
      WHERE id = ${imovelId} AND ${inventoryOwnerWhere(actor)}
      LIMIT 1
    `);
    const row = result.rows?.[0];
    if (!row) {
      const error: any = new Error("Imóvel não encontrado");
      error.status = 404;
      throw error;
    }
    return normalizeInventarioRow(row);
  }

  function sanitizeInventarioImovel(body: any, actor: { userId?: string | null; membroId?: string | null }, id: string) {
    const now = new Date();
    const frequenciaPulso = ["mensal", "trimestral", "desativado"].includes(String(body.frequencia_pulso || ""))
      ? String(body.frequencia_pulso)
      : "mensal";
    const proximoPulso = body.proximo_pulso_em || (() => {
      if (frequenciaPulso === "desativado") return null;
      const date = new Date(now);
      date.setMonth(date.getMonth() + (frequenciaPulso === "trimestral" ? 3 : 1));
      return date.toISOString().slice(0, 10);
    })();
    return {
      id,
      nome: String(body.nome || body.qualificacao || "Imóvel").slice(0, 180),
      tipo: String(body.tipo || "").slice(0, 80),
      area_m2: body.area_m2 || body.area || "",
      valor_pago: body.valor_pago || "",
      valor_atual: body.valor_atual || body.valor || "",
      moeda: body.moeda || "BRL",
      descricao: body.descricao || "",
      cep: body.cep || "",
      endereco: body.endereco || "",
      numero: body.numero || "",
      complemento: body.complemento || "",
      bairro: body.bairro || "",
      cidade: body.cidade || "",
      estado: body.estado || "",
      pais: body.pais || "Brasil",
      matricula: body.matricula || body.numero_matricula || "",
      cartorio: body.cartorio || "",
      foto: body.foto || "",
      status: body.status || "ativo",
      ocupacao: body.ocupacao || "desconhecido",
      objetivo: body.objetivo || "indefinido",
      titularidade: Array.isArray(body.titularidade) ? body.titularidade : [],
      divida_saldo: body.divida_saldo || "",
      valor_data_base: body.valor_data_base || now.toISOString().slice(0, 10),
      valor_origem: body.valor_origem || "declarada",
      area_origem: body.area_origem || "declarada",
      ocupacao_origem: body.ocupacao_origem || "declarada",
      dados_origem: body.dados_origem && typeof body.dados_origem === "object"
        ? body.dados_origem
        : {},
      frequencia_pulso: frequenciaPulso,
      proximo_pulso_em: proximoPulso,
      ultima_atualizacao: body.ultima_atualizacao || now.toISOString(),
      owner_user_id: actor.userId || null,
      owner_membro_id: actor.membroId || null,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  function sanitizeInventarioLancamento(body: any, actor: { userId?: string | null; membroId?: string | null }, id: string, imovelId: string) {
    return {
      id,
      imovel_id: imovelId,
      tipo: body.tipo === "receita" ? "receita" : "despesa",
      categoria: String(body.categoria || "").slice(0, 100),
      valor: Number(body.valor || 0),
      data: body.data || new Date().toISOString().slice(0, 10),
      data_vencimento: body.data_vencimento || null,
      data_pagamento: body.data_pagamento || null,
      status: body.status || "pago",
      descricao: String(body.descricao || "Lançamento").slice(0, 220),
      origem: body.origem || "manual",
      anexos: Array.isArray(body.anexos) ? body.anexos : [],
      observacao: body.observacao || "",
      owner_user_id: actor.userId || null,
      owner_membro_id: actor.membroId || null,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  app.get("/api/inventario/imoveis", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const result = await db.execute(sql`
        SELECT * FROM inventario_imoveis
        WHERE ${inventoryOwnerWhere(actor)}
        ORDER BY created_at DESC
      `);
      res.json((result.rows || []).map(normalizeInventarioRow));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/inventario/imoveis", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const id = req.body?.id || `inv-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const data = sanitizeInventarioImovel(req.body || {}, actor, id);
      await db.execute(sql`
        INSERT INTO inventario_imoveis (id, data, owner_user_id, owner_membro_id)
        VALUES (${id}, ${JSON.stringify(data)}::jsonb, ${actor.userId || null}, ${actor.membroId || null})
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          owner_user_id = EXCLUDED.owner_user_id,
          owner_membro_id = EXCLUDED.owner_membro_id,
          updated_at = now()
      `);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/inventario/imoveis/:id", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const current = await assertInventarioImovelOwner(req.params.id, actor);
      const data = sanitizeInventarioImovel({ ...current, ...(req.body || {}) }, actor, req.params.id);
      await db.execute(sql`
        UPDATE inventario_imoveis
        SET data = ${JSON.stringify(data)}::jsonb,
            updated_at = now()
        WHERE id = ${req.params.id} AND ${inventoryOwnerWhere(actor)}
      `);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/inventario/imoveis/:id", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      await assertInventarioImovelOwner(req.params.id, actor);
      await db.execute(sql`DELETE FROM inventario_imoveis WHERE id = ${req.params.id} AND ${inventoryOwnerWhere(actor)}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/inventario/lancamentos", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const imovelId = typeof req.query.imovel_id === "string" ? req.query.imovel_id : "";
      const result = imovelId
        ? await db.execute(sql`
            SELECT * FROM inventario_lancamentos
            WHERE imovel_id = ${imovelId} AND ${inventoryOwnerWhere(actor)}
            ORDER BY COALESCE((data->>'data')::date, created_at::date) DESC, created_at DESC
          `)
        : await db.execute(sql`
            SELECT * FROM inventario_lancamentos
            WHERE ${inventoryOwnerWhere(actor)}
            ORDER BY COALESCE((data->>'data')::date, created_at::date) DESC, created_at DESC
          `);
      res.json((result.rows || []).map(normalizeInventarioRow));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/inventario/lancamentos", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const imovelId = req.body?.imovel_id;
      if (!imovelId) return res.status(400).json({ error: "Selecione um imóvel." });
      await assertInventarioImovelOwner(imovelId, actor);
      const id = req.body?.id || `lan-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const data = sanitizeInventarioLancamento(req.body || {}, actor, id, imovelId);
      await db.execute(sql`
        INSERT INTO inventario_lancamentos (id, imovel_id, data, owner_user_id, owner_membro_id)
        VALUES (${id}, ${imovelId}, ${JSON.stringify(data)}::jsonb, ${actor.userId || null}, ${actor.membroId || null})
      `);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/inventario/lancamentos/:id", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      const currentResult = await db.execute(sql`
        SELECT * FROM inventario_lancamentos
        WHERE id = ${req.params.id} AND ${inventoryOwnerWhere(actor)}
        LIMIT 1
      `);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Lançamento não encontrado" });
      const currentData = normalizeInventarioRow(current);
      await assertInventarioImovelOwner(currentData.imovel_id, actor);
      const data = sanitizeInventarioLancamento({ ...currentData, ...(req.body || {}) }, actor, req.params.id, currentData.imovel_id);
      await db.execute(sql`
        UPDATE inventario_lancamentos
        SET data = ${JSON.stringify(data)}::jsonb,
            updated_at = now()
        WHERE id = ${req.params.id} AND ${inventoryOwnerWhere(actor)}
      `);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/inventario/lancamentos/:id", async (req, res) => {
    try {
      const actor = requireInventoryActor(req);
      await db.execute(sql`DELETE FROM inventario_lancamentos WHERE id = ${req.params.id} AND ${inventoryOwnerWhere(actor)}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  type CarteiraActor = {
    userId: string | null;
    membroId: string | null;
    role: string | null;
    isPlatformAdmin: boolean;
  };

  type CarteiraResolvedAccess = {
    imovel: any;
    nivel: CarteiraAccessLevel;
    isOwner: boolean;
  };

  function requireCarteiraActor(req: Request): CarteiraActor {
    const session = (req.session as any) || {};
    const userId = session.directusUserId || session.userId || null;
    const membroId = session.membroId || null;
    const role = session.role || null;
    if (!userId && !membroId) {
      const error: any = new Error("Não autenticado");
      error.status = 401;
      throw error;
    }
    return {
      userId,
      membroId,
      role,
      isPlatformAdmin: ["admin", "superadmin"].includes(String(role || "").toLowerCase()),
    };
  }

  function carteiraAccessibleWhere(actor: CarteiraActor) {
    if (actor.isPlatformAdmin) return sql`TRUE`;
    return sql`(
      (i.owner_user_id IS NOT NULL AND i.owner_user_id = ${actor.userId})
      OR (i.owner_membro_id IS NOT NULL AND i.owner_membro_id = ${actor.membroId})
      OR EXISTS (
        SELECT 1
        FROM carteira_acessos ca
        WHERE ca.imovel_id = i.id
          AND (
            (ca.user_id IS NOT NULL AND ca.user_id = ${actor.userId})
            OR (ca.membro_id IS NOT NULL AND ca.membro_id = ${actor.membroId})
          )
      )
    )`;
  }

  function carteiraOwnerActor(imovel: any) {
    return {
      userId: imovel.owner_user_id || null,
      membroId: imovel.owner_membro_id || null,
    };
  }

  async function resolveCarteiraAccess(imovelId: string, actor: CarteiraActor): Promise<CarteiraResolvedAccess | null> {
    const imovelResult = await db.execute(sql`
      SELECT *
      FROM inventario_imoveis
      WHERE id = ${imovelId}
      LIMIT 1
    `);
    const row = imovelResult.rows?.[0];
    if (!row) return null;
    const imovel = normalizeInventarioRow(row);
    const isOwner = Boolean(
      (actor.userId && row.owner_user_id && String(actor.userId) === String(row.owner_user_id))
      || (actor.membroId && row.owner_membro_id && String(actor.membroId) === String(row.owner_membro_id)),
    );
    if (isOwner) return { imovel, nivel: "proprietario", isOwner: true };
    if (actor.isPlatformAdmin) return { imovel, nivel: "administracao", isOwner: false };

    const accessResult = await db.execute(sql`
      SELECT nivel
      FROM carteira_acessos
      WHERE imovel_id = ${imovelId}
        AND (
          (user_id IS NOT NULL AND user_id = ${actor.userId})
          OR (membro_id IS NOT NULL AND membro_id = ${actor.membroId})
        )
      ORDER BY CASE nivel
        WHEN 'administracao' THEN 3
        WHEN 'colaboracao' THEN 2
        ELSE 1
      END DESC
      LIMIT 1
    `);
    const nivel = String(accessResult.rows?.[0]?.nivel || "");
    if (!isCarteiraAccessLevel(nivel) || nivel === "proprietario") return null;
    return { imovel, nivel, isOwner: false };
  }

  async function requireCarteiraAccess(
    imovelId: string,
    actor: CarteiraActor,
    required: CarteiraAccessLevel,
  ): Promise<CarteiraResolvedAccess> {
    const resolved = await resolveCarteiraAccess(imovelId, actor);
    if (!resolved) {
      const error: any = new Error("Imóvel não encontrado");
      error.status = 404;
      throw error;
    }
    if (!hasCarteiraAccess(resolved.nivel, required)) {
      const error: any = new Error("Você não possui permissão para esta ação.");
      error.status = 403;
      throw error;
    }
    return resolved;
  }

  async function recordCarteiraEvent(
    imovelId: string,
    actor: CarteiraActor,
    tipo: string,
    titulo: string,
    payload: Record<string, unknown> = {},
    origem = "declarada",
  ) {
    await db.execute(sql`
      INSERT INTO carteira_eventos (
        imovel_id, tipo, origem, titulo, payload, criado_por_user_id, criado_por_membro_id
      )
      VALUES (
        ${imovelId}, ${tipo}, ${origem}, ${titulo}, ${JSON.stringify(payload)}::jsonb,
        ${actor.userId}, ${actor.membroId}
      )
    `);
  }

  async function loadCarteiraContext(imovelId: string) {
    const [imovelResult, lancamentosResult, documentosResult, alertasResult] = await Promise.all([
      db.execute(sql`SELECT * FROM inventario_imoveis WHERE id = ${imovelId} LIMIT 1`),
      db.execute(sql`SELECT * FROM inventario_lancamentos WHERE imovel_id = ${imovelId} ORDER BY created_at DESC`),
      db.execute(sql`SELECT * FROM carteira_documentos WHERE imovel_id = ${imovelId} ORDER BY criado_em DESC`),
      db.execute(sql`SELECT * FROM carteira_alertas WHERE imovel_id = ${imovelId} ORDER BY criado_em DESC`),
    ]);
    const imovelRow = imovelResult.rows?.[0];
    if (!imovelRow) return null;
    return {
      imovel: normalizeInventarioRow(imovelRow),
      lancamentos: (lancamentosResult.rows || []).map(normalizeInventarioRow),
      documentos: documentosResult.rows || [],
      alertas: alertasResult.rows || [],
    };
  }

  async function calculateCarteiraDiagnosis(imovelId: string) {
    const context = await loadCarteiraContext(imovelId);
    if (!context) return null;
    return diagnosticarCarteira(context);
  }

  async function persistCarteiraAnalysis(
    imovelId: string,
    actor: CarteiraActor,
    tipo: string,
    entrada: Record<string, unknown>,
    resultado: Record<string, unknown>,
  ) {
    const insert = await db.execute(sql`
      INSERT INTO carteira_analises (
        imovel_id, tipo, versao_regra, entrada, resultado, criado_por_user_id, criado_por_membro_id
      )
      VALUES (
        ${imovelId}, ${tipo}, 'carteira-v1', ${JSON.stringify(entrada)}::jsonb,
        ${JSON.stringify(resultado)}::jsonb, ${actor.userId}, ${actor.membroId}
      )
      RETURNING *
    `);
    return insert.rows?.[0];
  }

  async function carteiraCardForRow(row: any, actor: CarteiraActor) {
    const imovel = normalizeInventarioRow(row);
    const resolved = await resolveCarteiraAccess(imovel.id, actor);
    const diagnostico = await calculateCarteiraDiagnosis(imovel.id);
    return {
      ...imovel,
      access_level: resolved?.nivel || "leitura",
      is_owner: resolved?.isOwner || false,
      diagnostico,
    };
  }

  app.get("/api/carteira/resumo", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const result = await db.execute(sql`
        SELECT i.*
        FROM inventario_imoveis i
        WHERE ${carteiraAccessibleWhere(actor)}
        ORDER BY i.updated_at DESC
      `);
      const imoveis = await Promise.all((result.rows || []).map((row) => carteiraCardForRow(row, actor)));
      const patrimonioPago = imoveis.reduce((sum, item) => sum + parseMarketValueServer(item.valor_pago), 0);
      const patrimonioAtual = imoveis.reduce((sum, item) => sum + parseMarketValueServer(item.valor_atual), 0);
      const divida = imoveis.reduce((sum, item) => sum + parseMarketValueServer(item.divida_saldo), 0);
      const receitas = imoveis.reduce((sum, item) => sum + Number(item.diagnostico?.indicadores?.receitas || 0), 0);
      const despesas = imoveis.reduce((sum, item) => sum + Number(item.diagnostico?.indicadores?.despesas || 0), 0);
      res.json({
        imoveis,
        totais: {
          patrimonio_total: Number((patrimonioAtual - divida).toFixed(2)),
          patrimonio_pago: Number(patrimonioPago.toFixed(2)),
          patrimonio_atual: Number(patrimonioAtual.toFixed(2)),
          divida: Number(divida.toFixed(2)),
          valorizacao: Number((patrimonioAtual - patrimonioPago).toFixed(2)),
          receitas: Number(receitas.toFixed(2)),
          despesas: Number(despesas.toFixed(2)),
          resultado_liquido: Number((receitas - despesas).toFixed(2)),
          alertas_abertos: imoveis.reduce((sum, item) => sum + Number(item.diagnostico?.indicadores?.alertas_abertos || 0), 0),
        },
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const result = await db.execute(sql`
        SELECT i.*
        FROM inventario_imoveis i
        WHERE ${carteiraAccessibleWhere(actor)}
        ORDER BY i.updated_at DESC
      `);
      res.json(await Promise.all((result.rows || []).map((row) => carteiraCardForRow(row, actor))));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "leitura");
      const diagnostico = await calculateCarteiraDiagnosis(req.params.id);
      res.json({
        ...access.imovel,
        access_level: access.nivel,
        is_owner: access.isOwner,
        diagnostico,
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const id = req.body?.id || `inv-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const data = sanitizeInventarioImovel(req.body || {}, actor, id);
      await db.execute(sql`
        INSERT INTO inventario_imoveis (id, data, owner_user_id, owner_membro_id)
        VALUES (${id}, ${JSON.stringify(data)}::jsonb, ${actor.userId}, ${actor.membroId})
      `);
      await recordCarteiraEvent(id, actor, "imovel_criado", "Imóvel adicionado à Carteira", { depois: data });
      res.status(201).json({ ...data, access_level: "proprietario", is_owner: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/carteira/imoveis/:id", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "administracao");
      const ownerActor = carteiraOwnerActor(access.imovel);
      const data = sanitizeInventarioImovel(
        { ...access.imovel, ...(req.body || {}), owner_user_id: access.imovel.owner_user_id, owner_membro_id: access.imovel.owner_membro_id },
        ownerActor,
        req.params.id,
      );
      await db.execute(sql`
        UPDATE inventario_imoveis
        SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
        WHERE id = ${req.params.id}
      `);
      await recordCarteiraEvent(req.params.id, actor, "imovel_atualizado", "Dados do imóvel atualizados", {
        antes: access.imovel,
        depois: data,
      });
      res.json({ ...data, access_level: access.nivel, is_owner: access.isOwner });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/carteira/imoveis/:id", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "proprietario");
      if (!access.isOwner) return res.status(403).json({ error: "Somente o proprietário pode excluir este imóvel." });
      await db.execute(sql`DELETE FROM inventario_imoveis WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/lancamentos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const imovelId = typeof req.query.imovel_id === "string" ? req.query.imovel_id : "";
      if (imovelId) {
        await requireCarteiraAccess(imovelId, actor, "leitura");
        const result = await db.execute(sql`
          SELECT *
          FROM inventario_lancamentos
          WHERE imovel_id = ${imovelId}
          ORDER BY COALESCE((data->>'data')::date, created_at::date) DESC, created_at DESC
        `);
        return res.json((result.rows || []).map(normalizeInventarioRow));
      }
      const result = await db.execute(sql`
        SELECT l.*
        FROM inventario_lancamentos l
        JOIN inventario_imoveis i ON i.id = l.imovel_id
        WHERE ${carteiraAccessibleWhere(actor)}
        ORDER BY COALESCE((l.data->>'data')::date, l.created_at::date) DESC, l.created_at DESC
      `);
      res.json((result.rows || []).map(normalizeInventarioRow));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/lancamentos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const imovelId = String(req.body?.imovel_id || "");
      if (!imovelId) return res.status(400).json({ error: "Selecione um imóvel." });
      const access = await requireCarteiraAccess(imovelId, actor, "colaboracao");
      const id = req.body?.id || `lan-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const ownerActor = carteiraOwnerActor(access.imovel);
      const data = sanitizeInventarioLancamento(req.body || {}, ownerActor, id, imovelId);
      await db.execute(sql`
        INSERT INTO inventario_lancamentos (id, imovel_id, data, owner_user_id, owner_membro_id)
        VALUES (
          ${id}, ${imovelId}, ${JSON.stringify(data)}::jsonb,
          ${access.imovel.owner_user_id || null}, ${access.imovel.owner_membro_id || null}
        )
      `);
      await recordCarteiraEvent(imovelId, actor, "lancamento_criado", "Lançamento registrado", { lancamento: data }, data.origem || "declarada");
      res.status(201).json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/carteira/lancamentos/:id", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const currentResult = await db.execute(sql`SELECT * FROM inventario_lancamentos WHERE id = ${req.params.id} LIMIT 1`);
      const currentRow = currentResult.rows?.[0];
      if (!currentRow) return res.status(404).json({ error: "Lançamento não encontrado" });
      const current = normalizeInventarioRow(currentRow);
      const access = await requireCarteiraAccess(current.imovel_id, actor, "colaboracao");
      const data = sanitizeInventarioLancamento(
        { ...current, ...(req.body || {}) },
        carteiraOwnerActor(access.imovel),
        req.params.id,
        current.imovel_id,
      );
      await db.execute(sql`
        UPDATE inventario_lancamentos
        SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
        WHERE id = ${req.params.id}
      `);
      await recordCarteiraEvent(current.imovel_id, actor, "lancamento_atualizado", "Lançamento atualizado", {
        antes: current,
        depois: data,
      });
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/carteira/lancamentos/:id", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const currentResult = await db.execute(sql`SELECT * FROM inventario_lancamentos WHERE id = ${req.params.id} LIMIT 1`);
      const currentRow = currentResult.rows?.[0];
      if (!currentRow) return res.status(404).json({ error: "Lançamento não encontrado" });
      const current = normalizeInventarioRow(currentRow);
      await requireCarteiraAccess(current.imovel_id, actor, "colaboracao");
      await db.execute(sql`DELETE FROM inventario_lancamentos WHERE id = ${req.params.id}`);
      await recordCarteiraEvent(current.imovel_id, actor, "lancamento_removido", "Lançamento removido", { antes: current });
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/eventos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const result = await db.execute(sql`
        SELECT *
        FROM carteira_eventos
        WHERE imovel_id = ${req.params.id}
        ORDER BY criado_em DESC
        LIMIT 250
      `);
      res.json(result.rows || []);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/documentos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const result = await db.execute(sql`
        SELECT *
        FROM carteira_documentos
        WHERE imovel_id = ${req.params.id}
        ORDER BY criado_em DESC
      `);
      res.json((result.rows || []).map((row: any) => ({
        ...row,
        file_url: assetApiUrl(row.file_id),
      })));
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/documentos/preview", upload.single("file"), async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(String(req.params.id), actor, "colaboracao");
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Selecione um documento." });
      const textContent = await extractInventarioFileText(file, "Leia este documento de imóvel e transcreva apenas as informações visíveis, preservando datas, identificadores e valores.");
      if (!textContent.trim()) return res.status(422).json({ error: "Não foi possível ler o documento." });
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Extraia metadados do documento de imóvel abaixo. Não invente dados ausentes.
Responda SOMENTE JSON válido no formato:
{"nome":"título curto","tipo":"Matrícula|IPTU / ITR|Escritura|Contrato de locação|Laudo / inspeção|Planta|Fotos|Orçamento|Financiamento|Planilha financeira|Outro","emissao":"YYYY-MM-DD|null","validade":"YYYY-MM-DD|null","observacao":"resumo curto","dados_extraidos":{"campos relevantes":"valores"}}

DOCUMENTO:
${textContent.slice(0, 16000)}`,
        }],
        temperature: 0,
        max_tokens: 1400,
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json({
        preview: {
          nome: String(parsed.nome || file.originalname || "Documento").slice(0, 180),
          tipo: String(parsed.tipo || "Outro").slice(0, 100),
          emissao: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.emissao || "")) ? parsed.emissao : null,
          validade: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.validade || "")) ? parsed.validade : null,
          observacao: parsed.observacao ? String(parsed.observacao).slice(0, 500) : null,
          dados_extraidos: parsed.dados_extraidos && typeof parsed.dados_extraidos === "object"
            ? parsed.dados_extraidos
            : {},
          origem: "extraida",
          status_validacao: "extraido",
        },
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: "Erro ao analisar documento: " + error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/documentos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const fileId = String(req.body?.file_id || "").trim();
      const nome = String(req.body?.nome || "").trim();
      const tipo = String(req.body?.tipo || "Outro").trim();
      if (!fileId || !nome) return res.status(400).json({ error: "Informe o arquivo e o nome do documento." });
      const versionResult = await db.execute(sql`
        SELECT COALESCE(MAX(versao), 0) + 1 AS proxima_versao
        FROM carteira_documentos
        WHERE imovel_id = ${req.params.id} AND lower(tipo) = lower(${tipo})
      `);
      const versao = Number(versionResult.rows?.[0]?.proxima_versao || 1);
      const origem = ["declarada", "extraida", "externa", "validada", "estimada"].includes(String(req.body?.origem || ""))
        ? String(req.body.origem)
        : "declarada";
      const insert = await db.execute(sql`
        INSERT INTO carteira_documentos (
          imovel_id, file_id, nome, tipo, versao, emissao, validade, origem,
          status_validacao, dados_extraidos, observacao, criado_por_user_id, criado_por_membro_id
        )
        VALUES (
          ${req.params.id}, ${fileId}, ${nome}, ${tipo}, ${versao},
          ${req.body?.emissao || null}, ${req.body?.validade || null}, ${origem},
          ${req.body?.status_validacao || "declarado"},
          ${JSON.stringify(req.body?.dados_extraidos || {})}::jsonb,
          ${req.body?.observacao || null}, ${actor.userId}, ${actor.membroId}
        )
        RETURNING *
      `);
      const documento = insert.rows?.[0];
      await recordCarteiraEvent(req.params.id, actor, "documento_adicionado", "Documento adicionado", {
        documento_id: documento?.id,
        nome,
        tipo,
        versao,
      }, origem);
      if (req.body?.validade) {
        const validade = new Date(`${req.body.validade}T12:00:00Z`);
        const dias = Math.ceil((validade.getTime() - Date.now()) / 86400000);
        if (Number.isFinite(dias) && dias <= 30) {
          await db.execute(sql`
            INSERT INTO carteira_alertas (
              imovel_id, tipo, severidade, titulo, descricao, impacto, acao_sugerida, prazo, criado_por_user_id
            )
            VALUES (
              ${req.params.id}, 'documental', ${dias < 0 ? "alta" : "media"},
              ${dias < 0 ? "Documento vencido" : "Documento próximo do vencimento"},
              ${`${nome} · versão ${versao}`},
              'A validade documental pode limitar decisões ou transações relacionadas ao imóvel.',
              'Revisar o documento e providenciar uma versão atualizada.',
              ${req.body.validade}, ${actor.userId}
            )
          `);
        }
      }
      res.status(201).json({ ...documento, file_url: assetApiUrl(fileId) });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/carteira/imoveis/:id/documentos/:documentoId", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const currentResult = await db.execute(sql`
        SELECT *
        FROM carteira_documentos
        WHERE id = ${req.params.documentoId} AND imovel_id = ${req.params.id}
        LIMIT 1
      `);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Documento não encontrado" });
      const next = {
        nome: String(req.body?.nome ?? current.nome),
        tipo: String(req.body?.tipo ?? current.tipo),
        emissao: req.body?.emissao === undefined ? current.emissao : req.body.emissao || null,
        validade: req.body?.validade === undefined ? current.validade : req.body.validade || null,
        origem: String(req.body?.origem ?? current.origem),
        status_validacao: String(req.body?.status_validacao ?? current.status_validacao),
        dados_extraidos: req.body?.dados_extraidos ?? current.dados_extraidos ?? {},
        observacao: req.body?.observacao === undefined ? current.observacao : req.body.observacao || null,
      };
      const updated = await db.execute(sql`
        UPDATE carteira_documentos
        SET nome = ${next.nome}, tipo = ${next.tipo}, emissao = ${next.emissao},
            validade = ${next.validade}, origem = ${next.origem},
            status_validacao = ${next.status_validacao},
            dados_extraidos = ${JSON.stringify(next.dados_extraidos)}::jsonb,
            observacao = ${next.observacao}, atualizado_em = now()
        WHERE id = ${req.params.documentoId} AND imovel_id = ${req.params.id}
        RETURNING *
      `);
      await recordCarteiraEvent(req.params.id, actor, "documento_atualizado", "Documento atualizado", {
        documento_id: req.params.documentoId,
        antes: current,
        depois: next,
      });
      res.json({ ...updated.rows?.[0], file_url: assetApiUrl(current.file_id) });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/carteira/imoveis/:id/documentos/:documentoId", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "administracao");
      const currentResult = await db.execute(sql`
        SELECT *
        FROM carteira_documentos
        WHERE id = ${req.params.documentoId} AND imovel_id = ${req.params.id}
        LIMIT 1
      `);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Documento não encontrado" });
      await db.execute(sql`DELETE FROM carteira_documentos WHERE id = ${req.params.documentoId}`);
      await recordCarteiraEvent(req.params.id, actor, "documento_removido", "Documento removido", { antes: current });
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/alertas", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const result = await db.execute(sql`
        SELECT *
        FROM carteira_alertas
        WHERE imovel_id = ${req.params.id}
        ORDER BY CASE severidade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
                 criado_em DESC
      `);
      res.json(result.rows || []);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/carteira/imoveis/:id/alertas/:alertaId", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const status = ["aberto", "adiado", "delegado", "resolvido"].includes(String(req.body?.status || ""))
        ? String(req.body.status)
        : "aberto";
      const updated = await db.execute(sql`
        UPDATE carteira_alertas
        SET status = ${status},
            prazo = COALESCE(${req.body?.prazo || null}, prazo),
            delegado_para_user_id = ${req.body?.delegado_para_user_id || null},
            atualizado_em = now()
        WHERE id = ${req.params.alertaId} AND imovel_id = ${req.params.id}
        RETURNING *
      `);
      if (!updated.rows?.[0]) return res.status(404).json({ error: "Alerta não encontrado" });
      await recordCarteiraEvent(req.params.id, actor, "alerta_atualizado", "Alerta atualizado", {
        alerta_id: req.params.alertaId,
        status,
      });
      res.json(updated.rows[0]);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/pulso/preview", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const today = new Date().toISOString().slice(0, 10);
      const receita = parseMarketValueServer(req.body?.receita || 0);
      const despesa = parseMarketValueServer(req.body?.despesa || 0);
      const acontecimento = String(req.body?.acontecimento || "").trim();
      const lancamentos: any[] = [];
      if (receita > 0) {
        lancamentos.push({
          tipo: "receita",
          categoria: String(req.body?.receita_categoria || "Receita do imóvel"),
          valor: receita,
          data: req.body?.data_referencia || today,
          status: req.body?.receita_status || "pago",
          descricao: String(req.body?.receita_descricao || "Receita informada no Pulso Patrimonial"),
          origem: "declarada",
        });
      }
      if (despesa > 0) {
        lancamentos.push({
          tipo: "despesa",
          categoria: String(req.body?.despesa_categoria || "Despesa do imóvel"),
          valor: despesa,
          data: req.body?.data_referencia || today,
          status: req.body?.despesa_status || "pago",
          descricao: String(req.body?.despesa_descricao || "Despesa informada no Pulso Patrimonial"),
          origem: "declarada",
        });
      }
      const alertas: any[] = [];
      if (/\b(vazamento|infiltra[cç][aã]o|dano|risco|problema|urgente|inc[eê]ndio|rachadura)\b/i.test(acontecimento)) {
        alertas.push({
          tipo: "tecnico",
          severidade: "alta",
          titulo: "Ocorrência técnica informada no Pulso",
          descricao: acontecimento,
          impacto: "Pode afetar segurança, conservação ou resultado do imóvel.",
          acao_sugerida: "Solicitar inspeção profissional.",
        });
      } else if (acontecimento) {
        alertas.push({
          tipo: "atualizacao",
          severidade: "baixa",
          titulo: "Mudança registrada no Pulso",
          descricao: acontecimento,
          impacto: "A informação pode alterar o diagnóstico patrimonial.",
          acao_sugerida: "Revisar o diagnóstico após confirmar a atualização.",
        });
      }

      let resumoIa = "";
      if (acontecimento.length >= 10) {
        try {
          const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Resuma em uma frase objetiva a atualização patrimonial abaixo. Não dê parecer jurídico, técnico ou financeiro definitivo.\n\n${acontecimento.slice(0, 3000)}`,
            }],
            temperature: 0,
            max_tokens: 180,
          });
          resumoIa = String(response.choices[0]?.message?.content || "").trim();
        } catch (error: any) {
          console.warn("[carteira-pulso-preview] resumo IA indisponivel:", error?.message || error);
        }
      }

      res.json({
        preview: {
          campos: {
            ocupacao: req.body?.ocupacao || null,
            objetivo: req.body?.objetivo || null,
          },
          lancamentos,
          alertas,
          acontecimento,
          resumo: resumoIa || acontecimento || "Atualização periódica da Carteira.",
          data_referencia: req.body?.data_referencia || today,
        },
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/pulsos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const preview = req.body?.preview;
      if (!preview || typeof preview !== "object") return res.status(400).json({ error: "Gere e confirme a prévia antes de salvar." });
      const current = access.imovel;
      const frequencia = String(current.frequencia_pulso || "mensal");
      const now = new Date();
      const nextPulse = frequencia === "desativado" ? null : (() => {
        const date = new Date(now);
        date.setMonth(date.getMonth() + (frequencia === "trimestral" ? 3 : 1));
        return date.toISOString().slice(0, 10);
      })();
      const ownerActor = carteiraOwnerActor(current);
      const updatedData = sanitizeInventarioImovel({
        ...current,
        ocupacao: preview.campos?.ocupacao || current.ocupacao,
        objetivo: preview.campos?.objetivo || current.objetivo,
        ocupacao_origem: preview.campos?.ocupacao ? "declarada" : current.ocupacao_origem,
        ultima_atualizacao: now.toISOString(),
        proximo_pulso_em: nextPulse,
      }, ownerActor, req.params.id);
      await db.execute(sql`
        UPDATE inventario_imoveis
        SET data = ${JSON.stringify(updatedData)}::jsonb, updated_at = now()
        WHERE id = ${req.params.id}
      `);

      const savedLancamentos: any[] = [];
      for (const item of Array.isArray(preview.lancamentos) ? preview.lancamentos : []) {
        const id = `lan-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const data = sanitizeInventarioLancamento(item, ownerActor, id, req.params.id);
        await db.execute(sql`
          INSERT INTO inventario_lancamentos (id, imovel_id, data, owner_user_id, owner_membro_id)
          VALUES (
            ${id}, ${req.params.id}, ${JSON.stringify(data)}::jsonb,
            ${current.owner_user_id || null}, ${current.owner_membro_id || null}
          )
        `);
        savedLancamentos.push(data);
      }

      const savedAlertas: any[] = [];
      for (const item of Array.isArray(preview.alertas) ? preview.alertas : []) {
        const inserted = await db.execute(sql`
          INSERT INTO carteira_alertas (
            imovel_id, tipo, severidade, titulo, descricao, impacto, acao_sugerida, criado_por_user_id
          )
          VALUES (
            ${req.params.id}, ${item.tipo || "atualizacao"}, ${item.severidade || "media"},
            ${String(item.titulo || "Alerta do Pulso").slice(0, 180)},
            ${item.descricao || null}, ${item.impacto || null}, ${item.acao_sugerida || null}, ${actor.userId}
          )
          RETURNING *
        `);
        if (inserted.rows?.[0]) savedAlertas.push(inserted.rows[0]);
      }
      await recordCarteiraEvent(req.params.id, actor, "pulso_confirmado", "Pulso Patrimonial confirmado", {
        resumo: preview.resumo || null,
        acontecimento: preview.acontecimento || null,
        campos: preview.campos || {},
        lancamentos: savedLancamentos.map((item) => item.id),
        alertas: savedAlertas.map((item) => item.id),
      });
      const diagnostico = await calculateCarteiraDiagnosis(req.params.id);
      if (diagnostico) {
        await persistCarteiraAnalysis(req.params.id, actor, "diagnostico", { origem: "pulso" }, diagnostico as any);
      }
      res.status(201).json({
        success: true,
        imovel: updatedData,
        lancamentos: savedLancamentos,
        alertas: savedAlertas,
        diagnostico,
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/diagnostico", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const diagnostico = await calculateCarteiraDiagnosis(req.params.id);
      if (!diagnostico) return res.status(404).json({ error: "Imóvel não encontrado" });
      res.json(diagnostico);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/diagnostico", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const diagnostico = await calculateCarteiraDiagnosis(req.params.id);
      if (!diagnostico) return res.status(404).json({ error: "Imóvel não encontrado" });
      await persistCarteiraAnalysis(req.params.id, actor, "diagnostico", { origem: req.body?.origem || "manual" }, diagnostico as any);
      await recordCarteiraEvent(req.params.id, actor, "diagnostico_atualizado", "Diagnóstico patrimonial atualizado", {
        situacao: diagnostico.situacao,
        confianca: diagnostico.confianca,
      }, "estimada");
      res.json(diagnostico);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/alternativas", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const result = await db.execute(sql`
        SELECT *
        FROM carteira_analises
        WHERE imovel_id = ${req.params.id} AND tipo = 'alternativas'
        ORDER BY criado_em DESC
        LIMIT 1
      `);
      res.json(result.rows?.[0]?.resultado || null);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/alternativas", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "colaboracao");
      const diagnostico = await calculateCarteiraDiagnosis(req.params.id);
      const entrada = {
        capacidade_investimento: req.body?.capacidade_investimento || 0,
        prazo: req.body?.prazo || "médio prazo",
        preferencia: req.body?.preferencia || "equilibrio",
        objetivo: access.imovel.objetivo || null,
      };
      let alternativas = buildCarteiraAlternativas({ ...entrada, diagnostico });
      let explicacaoIa: string | null = null;
      try {
        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `Explique em até 80 palavras, sem prometer resultado, por que a alternativa "${alternativas[0].titulo}" tem melhor aderência.
Objetivo: ${entrada.objetivo || "não informado"}.
Prazo: ${entrada.prazo}.
Preferência: ${entrada.preferencia}.
Situação: ${diagnostico?.situacao || "preliminar"}.
Dados faltantes: ${(diagnostico?.dados_faltantes || []).join(", ") || "nenhum identificado"}.
Deixe claro que premissas precisam de validação profissional.`,
          }],
          temperature: 0.2,
          max_tokens: 220,
        });
        explicacaoIa = String(response.choices[0]?.message?.content || "").trim() || null;
      } catch (error: any) {
        console.warn("[carteira-alternativas] explicacao IA indisponivel:", error?.message || error);
      }
      const resultado = {
        alternativas,
        melhor_alternativa: alternativas[0]?.tipo || null,
        resumo: explicacaoIa || alternativas[0]?.justificativa || "",
        preliminar: true,
        aviso: "Cenários informativos. Valores, prazos e viabilidade dependem de validação profissional.",
        criado_em: new Date().toISOString(),
      };
      await persistCarteiraAnalysis(req.params.id, actor, "alternativas", entrada, resultado);
      await recordCarteiraEvent(req.params.id, actor, "alternativas_analisadas", "Alternativas patrimoniais comparadas", {
        melhor_alternativa: resultado.melhor_alternativa,
        entrada,
      }, "estimada");
      res.json(resultado);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/demandas", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "leitura");
      const result = await db.execute(sql`
        SELECT *
        FROM carteira_demandas
        WHERE imovel_id = ${req.params.id}
        ORDER BY criado_em DESC
      `);
      res.json(result.rows || []);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/demandas", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "administracao");
      const titulo = String(req.body?.titulo || "").trim();
      if (!titulo) return res.status(400).json({ error: "Informe o título da demanda." });
      const tipoResolucao = ["solicitacao", "opa", "bia_sugerida"].includes(String(req.body?.tipo_resolucao || ""))
        ? String(req.body.tipo_resolucao)
        : "solicitacao";
      const insert = await db.execute(sql`
        INSERT INTO carteira_demandas (
          imovel_id, tipo_resolucao, alternativa, titulo, escopo, urgencia,
          especialidades, status, responsavel_user_id, propostas, documentos,
          proximas_etapas, criado_por_user_id, criado_por_membro_id
        )
        VALUES (
          ${req.params.id}, ${tipoResolucao}, ${req.body?.alternativa || null}, ${titulo},
          ${req.body?.escopo || null}, ${req.body?.urgencia || "normal"},
          ${JSON.stringify(Array.isArray(req.body?.especialidades) ? req.body.especialidades : [])}::jsonb,
          'rascunho', ${req.body?.responsavel_user_id || null},
          ${JSON.stringify(Array.isArray(req.body?.propostas) ? req.body.propostas : [])}::jsonb,
          ${JSON.stringify(Array.isArray(req.body?.documentos) ? req.body.documentos : [])}::jsonb,
          ${JSON.stringify(Array.isArray(req.body?.proximas_etapas) ? req.body.proximas_etapas : [])}::jsonb,
          ${actor.userId}, ${actor.membroId}
        )
        RETURNING *
      `);
      const demanda = insert.rows?.[0];
      await recordCarteiraEvent(req.params.id, actor, "demanda_criada", "Demanda criada", {
        demanda_id: demanda?.id,
        titulo,
        tipo_resolucao: tipoResolucao,
      });
      res.status(201).json(demanda);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch("/api/carteira/imoveis/:id/demandas/:demandaId", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "administracao");
      const currentResult = await db.execute(sql`
        SELECT *
        FROM carteira_demandas
        WHERE id = ${req.params.demandaId} AND imovel_id = ${req.params.id}
        LIMIT 1
      `);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Demanda não encontrada" });
      const status = ["rascunho", "aberta", "em_andamento", "aguardando", "concluida", "cancelada"].includes(String(req.body?.status || ""))
        ? String(req.body.status)
        : String(current.status);
      const updated = await db.execute(sql`
        UPDATE carteira_demandas
        SET titulo = ${String(req.body?.titulo ?? current.titulo)},
            escopo = ${req.body?.escopo === undefined ? current.escopo : req.body.escopo || null},
            urgencia = ${String(req.body?.urgencia ?? current.urgencia)},
            status = ${status},
            responsavel_user_id = ${req.body?.responsavel_user_id === undefined ? current.responsavel_user_id : req.body.responsavel_user_id || null},
            propostas = ${JSON.stringify(req.body?.propostas === undefined ? current.propostas || [] : Array.isArray(req.body.propostas) ? req.body.propostas : [])}::jsonb,
            documentos = ${JSON.stringify(req.body?.documentos === undefined ? current.documentos || [] : Array.isArray(req.body.documentos) ? req.body.documentos : [])}::jsonb,
            proximas_etapas = ${JSON.stringify(req.body?.proximas_etapas === undefined ? current.proximas_etapas || [] : Array.isArray(req.body.proximas_etapas) ? req.body.proximas_etapas : [])}::jsonb,
            resultado = ${req.body?.resultado === undefined ? current.resultado : req.body.resultado || null},
            atualizado_em = now()
        WHERE id = ${req.params.demandaId} AND imovel_id = ${req.params.id}
        RETURNING *
      `);
      await recordCarteiraEvent(req.params.id, actor, "demanda_atualizada", "Demanda atualizada", {
        demanda_id: req.params.demandaId,
        status,
      });
      res.json(updated.rows?.[0]);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/demandas/:demandaId/converter-opa", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "administracao");
      const demandResult = await db.execute(sql`
        SELECT *
        FROM carteira_demandas
        WHERE id = ${req.params.demandaId} AND imovel_id = ${req.params.id}
        LIMIT 1
      `);
      const demanda: any = demandResult.rows?.[0];
      if (!demanda) return res.status(404).json({ error: "Demanda não encontrada" });
      if (demanda.opa_id) return res.status(409).json({ error: "Esta demanda já possui uma OBA vinculada.", opa_id: demanda.opa_id });
      const localizacao = [
        access.imovel.endereco,
        access.imovel.bairro,
        access.imovel.cidade,
        access.imovel.estado,
        access.imovel.pais,
      ].filter(Boolean).join(", ");
      const payload = prepareOpaPayload({
        nome_oportunidade: demanda.titulo,
        tipo: "Prestação de Serviço",
        objetivo_alianca: demanda.escopo || `Resolver demanda patrimonial do imóvel ${access.imovel.nome}.`,
        nucleo_alianca: Array.isArray(demanda.especialidades) ? demanda.especialidades[0] || null : null,
        pais: access.imovel.pais || "Brasil",
        localizacao,
        descricao: `${demanda.escopo || ""}\n\nOrigem: Carteira Patrimonial — ${access.imovel.nome}.`.trim(),
        status: "pausada",
      });
      payload.criado_por_user_id = actor.userId;
      payload.criado_por_membro_id = actor.membroId;
      let opa: any;
      try {
        opa = await directusCreate("tipos_oportunidades", payload);
      } catch (error: any) {
        if (!String(error?.message || "").includes("criado_por_")) throw error;
        delete payload.criado_por_user_id;
        delete payload.criado_por_membro_id;
        opa = await directusCreate("tipos_oportunidades", payload);
      }
      await db.execute(sql`
        UPDATE carteira_demandas
        SET tipo_resolucao = 'opa', opa_id = ${opa.id}, status = 'aberta', atualizado_em = now()
        WHERE id = ${req.params.demandaId}
      `);
      await recordCarteiraEvent(req.params.id, actor, "demanda_convertida_opa", "Rascunho de OBA criado", {
        demanda_id: req.params.demandaId,
        opa_id: opa.id,
      });
      res.status(201).json({ success: true, opa, opa_id: opa.id });
    } catch (error: any) {
      res.status(error.status || error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/carteira/imoveis/:id/acessos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "administracao");
      const result = await db.execute(sql`
        SELECT ca.*, u.nome, u.email, u.username, u.membro_directus_id
        FROM carteira_acessos ca
        LEFT JOIN users u ON u.id = ca.user_id
        WHERE ca.imovel_id = ${req.params.id}
        ORDER BY ca.criado_em ASC
      `);
      let owner: any = null;
      if (access.imovel.owner_user_id) {
        const ownerResult = await db.execute(sql`
          SELECT id, nome, email, username, membro_directus_id
          FROM users
          WHERE id = ${access.imovel.owner_user_id}
          LIMIT 1
        `);
        owner = ownerResult.rows?.[0] || { id: access.imovel.owner_user_id };
      } else if (access.imovel.owner_membro_id) {
        owner = { membro_id: access.imovel.owner_membro_id };
      }
      res.json({ owner, acessos: result.rows || [], current_level: access.nivel, is_owner: access.isOwner });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/acessos", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "administracao");
      const nivel = String(req.body?.nivel || "");
      if (!isCarteiraAccessLevel(nivel) || nivel === "proprietario") {
        return res.status(400).json({ error: "Selecione leitura, colaboração ou administração." });
      }
      const identifier = String(req.body?.identificador || req.body?.user_id || "").trim();
      const explicitMembroId = String(req.body?.membro_id || "").trim();
      let target: any = null;
      if (identifier) {
        const targetResult = await db.execute(sql`
          SELECT id, nome, email, username, membro_directus_id
          FROM users
          WHERE id = ${identifier}
             OR lower(COALESCE(email, '')) = lower(${identifier})
             OR lower(username) = lower(${identifier})
             OR membro_directus_id = ${identifier}
          LIMIT 1
        `);
        target = targetResult.rows?.[0] || null;
      }
      const targetUserId = target?.id || null;
      const targetMembroId = target?.membro_directus_id || explicitMembroId || null;
      if (!targetUserId && !targetMembroId) {
        return res.status(404).json({ error: "Usuário não encontrado. Informe o e-mail ou usuário cadastrado na plataforma." });
      }
      if (
        (targetUserId && String(targetUserId) === String(access.imovel.owner_user_id || ""))
        || (targetMembroId && String(targetMembroId) === String(access.imovel.owner_membro_id || ""))
      ) {
        return res.status(400).json({ error: "O proprietário já possui acesso total." });
      }
      const existing = await db.execute(sql`
        SELECT *
        FROM carteira_acessos
        WHERE imovel_id = ${req.params.id}
          AND (
            (${targetUserId} IS NOT NULL AND user_id = ${targetUserId})
            OR (${targetMembroId} IS NOT NULL AND membro_id = ${targetMembroId})
          )
        LIMIT 1
      `);
      let saved: any;
      if (existing.rows?.[0]) {
        const updated = await db.execute(sql`
          UPDATE carteira_acessos
          SET nivel = ${nivel}, user_id = COALESCE(${targetUserId}, user_id),
              membro_id = COALESCE(${targetMembroId}, membro_id), atualizado_em = now()
          WHERE id = ${existing.rows[0].id}
          RETURNING *
        `);
        saved = updated.rows?.[0];
      } else {
        const inserted = await db.execute(sql`
          INSERT INTO carteira_acessos (
            imovel_id, user_id, membro_id, nivel, concedido_por_user_id, concedido_por_membro_id
          )
          VALUES (
            ${req.params.id}, ${targetUserId}, ${targetMembroId}, ${nivel}, ${actor.userId}, ${actor.membroId}
          )
          RETURNING *
        `);
        saved = inserted.rows?.[0];
      }
      await recordCarteiraEvent(req.params.id, actor, "acesso_concedido", "Acesso à Carteira atualizado", {
        acesso_id: saved?.id,
        user_id: targetUserId,
        membro_id: targetMembroId,
        nivel,
      });
      res.status(201).json({ ...saved, ...target });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.delete("/api/carteira/imoveis/:id/acessos/:acessoId", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      await requireCarteiraAccess(req.params.id, actor, "administracao");
      const currentResult = await db.execute(sql`
        SELECT *
        FROM carteira_acessos
        WHERE id = ${req.params.acessoId} AND imovel_id = ${req.params.id}
        LIMIT 1
      `);
      const current = currentResult.rows?.[0];
      if (!current) return res.status(404).json({ error: "Acesso não encontrado" });
      await db.execute(sql`DELETE FROM carteira_acessos WHERE id = ${req.params.acessoId}`);
      await recordCarteiraEvent(req.params.id, actor, "acesso_revogado", "Acesso à Carteira revogado", { antes: current });
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post("/api/carteira/imoveis/:id/transferir-proprietario", async (req, res) => {
    try {
      const actor = requireCarteiraActor(req);
      const access = await requireCarteiraAccess(req.params.id, actor, "proprietario");
      if (!access.isOwner) {
        return res.status(403).json({ error: "Somente o proprietário pode transferir a administração principal." });
      }
      const identifier = String(req.body?.identificador || "").trim();
      if (!identifier) return res.status(400).json({ error: "Informe o e-mail ou usuário do novo proprietário." });
      const targetResult = await db.execute(sql`
        SELECT id, nome, email, username, membro_directus_id
        FROM users
        WHERE id = ${identifier}
           OR lower(COALESCE(email, '')) = lower(${identifier})
           OR lower(username) = lower(${identifier})
           OR membro_directus_id = ${identifier}
        LIMIT 1
      `);
      const target: any = targetResult.rows?.[0];
      if (!target) return res.status(404).json({ error: "Novo proprietário não encontrado na plataforma." });
      const targetUserId = target.id || null;
      const targetMembroId = target.membro_directus_id || null;
      if (
        (targetUserId && String(targetUserId) === String(access.imovel.owner_user_id || ""))
        || (targetMembroId && String(targetMembroId) === String(access.imovel.owner_membro_id || ""))
      ) {
        return res.status(400).json({ error: "Esta pessoa já é a proprietária principal." });
      }

      const previousOwner = {
        user_id: access.imovel.owner_user_id || null,
        membro_id: access.imovel.owner_membro_id || null,
      };
      const updatedData = {
        ...access.imovel,
        owner_user_id: targetUserId,
        owner_membro_id: targetMembroId,
        updatedAt: new Date().toISOString(),
      };

      await db.transaction(async (tx) => {
        await tx.execute(sql`
          DELETE FROM carteira_acessos
          WHERE imovel_id = ${req.params.id}
            AND (
              (${targetUserId} IS NOT NULL AND user_id = ${targetUserId})
              OR (${targetMembroId} IS NOT NULL AND membro_id = ${targetMembroId})
            )
        `);
        await tx.execute(sql`
          UPDATE inventario_imoveis
          SET owner_user_id = ${targetUserId},
              owner_membro_id = ${targetMembroId},
              data = ${JSON.stringify(updatedData)}::jsonb,
              updated_at = now()
          WHERE id = ${req.params.id}
        `);
        await tx.execute(sql`
          UPDATE inventario_lancamentos
          SET owner_user_id = ${targetUserId},
              owner_membro_id = ${targetMembroId},
              updated_at = now()
          WHERE imovel_id = ${req.params.id}
        `);
        if (previousOwner.user_id || previousOwner.membro_id) {
          await tx.execute(sql`
            DELETE FROM carteira_acessos
            WHERE imovel_id = ${req.params.id}
              AND (
                (${previousOwner.user_id} IS NOT NULL AND user_id = ${previousOwner.user_id})
                OR (${previousOwner.membro_id} IS NOT NULL AND membro_id = ${previousOwner.membro_id})
              )
          `);
          await tx.execute(sql`
            INSERT INTO carteira_acessos (
              imovel_id, user_id, membro_id, nivel, concedido_por_user_id, concedido_por_membro_id
            )
            VALUES (
              ${req.params.id}, ${previousOwner.user_id}, ${previousOwner.membro_id},
              'administracao', ${actor.userId}, ${actor.membroId}
            )
          `);
        }
      });
      await recordCarteiraEvent(req.params.id, actor, "proprietario_transferido", "Administração principal transferida", {
        anterior: previousOwner,
        novo: { user_id: targetUserId, membro_id: targetMembroId },
      });
      res.json({
        success: true,
        novo_proprietario: target,
        proprietario_anterior_nivel: "administracao",
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  async function parseInventarioLancamentosFromText(textContent: string, origem: string) {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Extraia lançamentos financeiros de imóvel do texto abaixo.
Retorne SOMENTE JSON válido, sem markdown, no formato:
{"lancamentos":[{"tipo":"receita|despesa","categoria":"IPTU|Condomínio|Aluguel|Manutenção|Imposto de Renda|Financiamento|Seguro|Outros","valor":123.45,"data":"YYYY-MM-DD","data_vencimento":"YYYY-MM-DD|null","data_pagamento":"YYYY-MM-DD|null","status":"pago|pendente|agendado|vencido","descricao":"texto curto","observacao":"texto curto|null"}],"observacao":"texto curto"}
Regras:
- Receita inclui aluguel, venda, reembolso recebido.
- Despesa inclui IPTU, condomínio, manutenção, obra, imposto, financiamento, seguro.
- Valor positivo com 2 casas decimais.
- Se não houver data, use ${today}.
- Máximo 30 lançamentos.

TEXTO:
${textContent.slice(0, 16000)}`;
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const validStatus = new Set(["pago", "pendente", "agendado", "vencido"]);
    return {
      lancamentos: (Array.isArray(parsed.lancamentos) ? parsed.lancamentos : []).slice(0, 30).map((item: any) => ({
        tipo: item.tipo === "receita" ? "receita" : "despesa",
        categoria: String(item.categoria || "Outros").slice(0, 80),
        valor: Math.abs(Number(item.valor || 0)),
        data: /^\d{4}-\d{2}-\d{2}$/.test(String(item.data || "")) ? item.data : today,
        data_vencimento: /^\d{4}-\d{2}-\d{2}$/.test(String(item.data_vencimento || "")) ? item.data_vencimento : null,
        data_pagamento: /^\d{4}-\d{2}-\d{2}$/.test(String(item.data_pagamento || "")) ? item.data_pagamento : null,
        status: validStatus.has(String(item.status || "")) ? item.status : "pendente",
        descricao: String(item.descricao || "Lançamento sugerido por IA").slice(0, 180),
        observacao: item.observacao ? String(item.observacao).slice(0, 180) : null,
        origem,
      })).filter((item: any) => item.valor > 0),
      observacao: parsed.observacao || null,
    };
  }

  async function extractInventarioFileText(file: any, imagePrompt = "Leia este comprovante/documento de imóvel e extraia o texto visível, incluindo datas, valores, categoria e descrição.") {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(".", "");
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/") && ["png", "jpg", "jpeg", "webp"].includes(ext)) {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: imagePrompt },
            { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` } },
          ] as any,
        }],
        temperature: 0,
        max_tokens: 1800,
      });
      return response.choices[0]?.message?.content || "";
    }
    if (["xlsx", "xls"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      return wb.SheetNames.map((sheet) => XLSX.utils.sheet_to_csv(wb.Sheets[sheet])).join("\n\n");
    }
    if (ext === "pdf" || mime.includes("pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: file.buffer });
      return (await parser.getText()).text;
    }
    return file.buffer.toString("utf-8");
  }

  app.post(["/api/inventario/importar-anexos", "/api/carteira/importar-anexos"], upload.single("file"), async (req, res) => {
    try {
      requireInventoryActor(req);
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
      const mime = String(file.mimetype || "").toLowerCase();
      const textContent = await extractInventarioFileText(file);
      if (!textContent.trim()) return res.status(422).json({ error: "Não foi possível ler o arquivo." });
      const parsed = await parseInventarioLancamentosFromText(textContent, mime.startsWith("image/") ? "ia_imagem" : "ia_arquivo");
      res.json({ success: true, arquivo: file.originalname, ...parsed });
    } catch (error: any) {
      console.error("[inventario-importar]", error?.message || error);
      res.status(error.status || 500).json({ error: "Erro ao analisar arquivo: " + error.message });
    }
  });

  app.post(["/api/inventario/transcrever-audio", "/api/carteira/transcrever-audio"], auraAudioUpload.single("audio"), async (req, res) => {
    try {
      requireInventoryActor(req);
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Nenhum áudio enviado" });
      const { toFile } = await import("openai");
      const audioFile = await toFile(
        file.buffer,
        auraAudioFilename(file.originalname, file.mimetype, file.buffer),
        { type: auraAudioMime(file.originalname, file.mimetype, file.buffer) },
      );
      const transcription = await getOpenAI().audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "pt",
      });
      const texto = (transcription.text || "").replace(/\s+/g, " ").trim();
      const parsed = await parseInventarioLancamentosFromText(texto, "ia_voz");
      res.json({ success: true, texto, ...parsed });
    } catch (error: any) {
      console.error("[inventario-audio]", error?.message || error);
      res.status(error.status || 500).json({ error: "Erro ao transcrever áudio: " + error.message });
    }
  });

  function parseAreaM2Server(value: any): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseMarketValueServer(value: any): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    return parsePtBrMoney(String(value ?? ""));
  }

  function extractJsonObject(text: string): any {
    const raw = String(text || "").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {}
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }

  async function analyzeM2WithWebSearch(params: {
    origem: string;
    nome: string;
    tipo: string;
    location: string;
    bairro: string;
    cidade: string;
    valor: number;
    areaM2: number;
    precoM2: number;
    moeda: string;
  }) {
    const areaMin = Math.max(1, params.areaM2 - MARKET_AREA_TOLERANCE_M2);
    const areaMax = params.areaM2 + MARKET_AREA_TOLERANCE_M2;
    const requiredRegion = params.bairro || params.cidade || params.location;
    const prompt = `Pesquise na internet anúncios atuais e individuais de imóveis à venda para comparar um imóvel/BIA.

Dados do ativo:
- Origem: ${params.origem}
- Nome: ${params.nome}
- Tipo/qualificação: ${params.tipo}
- Localização/endereço: ${params.location}
- Região obrigatória: ${requiredRegion}
- Valor total informado: ${params.valor.toFixed(2)} ${params.moeda}
- Área: ${params.areaM2.toFixed(2)} m²
- Faixa de área permitida: ${areaMin.toFixed(2)} a ${areaMax.toFixed(2)} m², inclusive
- Preço informado por m²: ${params.precoM2.toFixed(2)} ${params.moeda}/m²

Instruções:
- Use pesquisa web real e retorne somente anúncios individuais de venda com URL pública direta.
- Não use índices genéricos, médias municipais, relatórios, páginas de busca sem imóvel específico, aluguel ou conhecimento interno.
- Cada anúncio precisa ser do mesmo tipo do ativo, estar em ${requiredRegion} e ter área entre ${areaMin.toFixed(2)} e ${areaMax.toFixed(2)} m².
- Para cada anúncio, extraia o preço total de venda, a área, o tipo, o bairro, a cidade, a localização e a URL.
- Procure até 12 anúncios válidos. Não amplie silenciosamente a região nem a faixa de área.
- Não calcule média, faixa, diferença, confiança ou classificação; o servidor fará esses cálculos.
- Não invente anúncios, URLs, preços, áreas ou localizações. Quando um dado não estiver explícito na fonte, não inclua o anúncio.
- Responda SOMENTE JSON minificado neste formato:
{"comparaveis":[{"titulo":"nome do imóvel","url":"https://...","tipo":"tipo do imóvel","bairro":"bairro","cidade":"cidade","localizacao":"bairro, cidade, estado","area_m2":0,"preco_total":0,"moeda":"BRL","trecho":"preço e área encontrados na fonte"}]}`;

    const client = getOpenAI() as any;
    if (!client.responses?.create) {
      const error: any = new Error("Pesquisa web da OpenAI indisponível neste servidor.");
      error.status = 503;
      throw error;
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Você é um pesquisador de comparáveis imobiliários. Extraia somente anúncios públicos de venda que atendam exatamente ao tipo, à região e à faixa de área solicitados.",
        },
        { role: "user", content: prompt },
      ],
      tools: [{ type: "web_search_preview" }],
      include: ["web_search_call.results"],
      temperature: 0.1,
      max_output_tokens: 2600,
    });

    return extractJsonObject(response.output_text || "");
  }

  app.post("/api/ai/preco-m2", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const body = req.body || {};
      if (String(body.origem || "").toLowerCase() === "bia") {
        if (!body.bia_id) return res.status(400).json({ error: "bia_id e obrigatorio para analisar uma BIA." });
        if (!await requireBiaModuleAccess(req, res, String(body.bia_id), "capital_analises", "edit")) return;
      }
      const areaM2 = parseAreaM2Server(body.area_m2);
      const valor = parseMarketValueServer(body.valor);
      if (areaM2 <= 0 || valor <= 0) {
        return res.status(400).json({ error: "Informe valor e área em m² para analisar o preço por m²." });
      }

      const precoM2 = valor / areaM2;
      const location = [
        body.endereco,
        body.bairro,
        body.cidade,
        body.estado,
        body.pais,
        body.cep ? `CEP ${body.cep}` : "",
      ].filter(Boolean).join(", ") || body.localizacao || "Localização não informada";

      const parsed = await analyzeM2WithWebSearch({
        origem: String(body.origem || "ativo"),
        nome: String(body.nome || "Não informado"),
        tipo: String(body.tipo || body.qualificacao || "Não informado"),
        location,
        bairro: String(body.bairro || ""),
        cidade: String(body.cidade || ""),
        valor,
        areaM2,
        precoM2,
        moeda: String(body.moeda || "BRL"),
      });
      const analysis = buildComparableMarketAnalysis(parsed.comparaveis || parsed.imoveis, {
        tipo: String(body.tipo || body.qualificacao || "Não informado"),
        bairro: String(body.bairro || ""),
        cidade: String(body.cidade || ""),
        localizacao: String(body.localizacao || location),
        areaM2,
        precoM2,
        moeda: String(body.moeda || "BRL"),
      });
      res.json({
        success: true,
        ...analysis,
        preco_m2_informado: Math.round(precoM2),
        valor_total: Math.round(valor),
        area_m2: Number(areaM2.toFixed(2)),
      });
    } catch (error: any) {
      console.error("[ai/preco-m2]", error?.message || error);
      res.status(error?.status || 500).json({ error: error?.message || "Erro ao analisar preço por m²." });
    }
  });

  // ========== AI PARSE PAYMENT SCHEDULE ==========
  app.post("/api/parse-pagamento-file", upload.single("file"), async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
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
          return res.status(422).json({ error: "NÃ£o foi possÃ­vel ler o PDF. Tente um Excel ou CSV." });
        }
      } else {
        textContent = file.buffer.toString("utf-8");
      }

      if (!textContent.trim()) {
        return res.status(422).json({ error: "NÃ£o foi possÃ­vel extrair texto do arquivo." });
      }

      // Truncate to avoid token limits
      if (textContent.length > 15000) textContent = textContent.slice(0, 15000) + "\n[... truncado ...]";

      const prompt = `Analise o documento abaixo e extraia o cronograma de pagamentos/parcelas.
Retorne SOMENTE um JSON minificado (sem espaÃ§os extras, sem quebras de linha) com este formato:
{"numeroParcelas":<int>,"vencimentos":["YYYY-MM-DD",...],"valores":[<float>,...],"observacao":"<texto breve>"}
Regras:
- Valores: mÃ¡ximo 2 casas decimais (ex: 1500.50). Use 0 se nÃ£o houver valor para a parcela.
- Datas: formato YYYY-MM-DD. Array vazio se nÃ£o houver datas.
- Limite de parcelas: mÃ¡ximo 360. Se houver mais, inclua apenas as primeiras 360.
- observacao: mÃ¡ximo 80 caracteres resumindo o tipo de cronograma.
- Sem markdown, sem texto fora do JSON.

DOCUMENTO:
${textContent}`;

      const response = await getOpenAI().chat.completions.create({
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
          throw new Error("NÃ£o foi possÃ­vel interpretar a resposta da IA. Tente com um arquivo menor ou em formato Excel.");
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

      const systemPrompt = `VocÃª Ã© um analista especializado em projetos BIA da Built Alliances.
PROJETO BIA EM ANÃLISE:
- Nome: ${bia.nome_bia}
- Objetivo: ${bia.objetivo_alianca || 'N/A'}
- LocalizaÃ§Ã£o: ${bia.localizacao || 'N/A'}
- Dados: ${JSON.stringify(bia)}
Responda em portuguÃªs brasileiro, de forma clara e objetiva.`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question || "FaÃ§a uma anÃ¡lise completa deste projeto BIA." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      res.json({ success: true, message: response.choices[0]?.message?.content || "NÃ£o foi possÃ­vel analisar.", bia });
    } catch (error: any) {
      console.error("BIA Analysis error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/analyze/oportunidade/:id", async (req, res) => {
    try {
      const { question } = req.body;
      const systemPrompt = `VocÃª Ã© um analista especializado em oportunidades de negÃ³cio da Built Alliances. Responda em portuguÃªs brasileiro.`;
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question || "FaÃ§a uma anÃ¡lise desta oportunidade." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });
      res.json({ success: true, message: response.choices[0]?.message?.content || "NÃ£o foi possÃ­vel analisar." });
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

      const systemPrompt = `VocÃª Ã© o assistente inteligente da Built Alliances, uma plataforma de gestÃ£o de membros, projetos BIA e oportunidades de negÃ³cio.

DADOS ATUAIS DO SISTEMA:
- Total de Membros: ${allMembros.length}
- Total de BIAS (Projetos): ${allBias.length}
- Total de Oportunidades: ${allOportunidades.length}

MEMBROS CADASTRADOS:
${allMembros.slice(0, 20).map((m) => `- ${m.nome} | Empresa: ${m.empresa || 'N/A'} | Cargo: ${m.cargo || 'N/A'}`).join('\n')}

PROJETOS BIA ATIVOS:
${allBias.slice(0, 15).map((b) => `- ${b.nome_bia} | Local: ${b.localizacao || 'N/A'}`).join('\n')}

Responda sempre em portuguÃªs brasileiro, de forma clara e objetiva.`;

      const response = await getOpenAI().chat.completions.create({
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
        message: response.choices[0]?.message?.content || "Desculpe, nÃ£o consegui processar sua solicitaÃ§Ã£o.",
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
        ? `VocÃª Ã© um consultor especialista em construÃ§Ã£o civil e investimentos imobiliÃ¡rios da Built Alliances. Analise as oportunidades de alianÃ§a (OBAs) e forneÃ§a insights estratÃ©gicos em portuguÃªs brasileiro. Seja conciso. MÃ¡ximo 3 parÃ¡grafos.`
        : `VocÃª Ã© um consultor especialista da Built Alliances em BIAs. Analise os projetos de alianÃ§a e forneÃ§a insights. Seja conciso. MÃ¡ximo 3 parÃ¡grafos.`;

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      res.json({ success: true, analysis: response.choices[0]?.message?.content || "AnÃ¡lise nÃ£o disponÃ­vel." });
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== AUTH (Directus-based) ==========

  // â”€â”€ Self-registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.post("/api/register", async (req, res) => {
    try {
      const {
        nome,
        email,
        username,
        password,
        cpf,
        cnpj,
        telefone,
        whatsapp,
        empresa,
        cargo,
        cidade,
        estado,
        pais,
        area_atuacao,
        idiomas,
        link_site,
        foto_perfil,
        logo_empresa,
        convite_token,
        interesses,
        ramo_atuacao,
        segmento,
        perfil_aliado,
        especialidade_livre,
        tipos_alianca,
        nucleos_alianca,
      } = req.body;
      if (!nome || !email || !password)
        return res.status(400).json({ error: "Nome, e-mail e senha sÃ£o obrigatÃ³rios" });
      if (password.length < 4)
        return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
      if (!String(cpf || "").trim()) {
        return res.status(400).json({ error: "CPF Ã© obrigatÃ³rio para concluir o cadastro." });
      }

      // Require a convite_token to register
      if (!convite_token) {
        return res.status(403).json({ error: "Ã‰ necessÃ¡rio um cÃ³digo de convite para se cadastrar. Solicite um convite a um membro da rede BUILT." });
      }
      const conviteLink = await storage.getConviteLinkByToken(convite_token);
      if (!conviteLink || conviteLink.status !== "ativo") {
        return res.status(403).json({ error: "CÃ³digo de convite invÃ¡lido ou jÃ¡ utilizado." });
      }
      if (conviteLink.expires_at && new Date() > new Date(conviteLink.expires_at)) {
        return res.status(403).json({ error: "Este cÃ³digo de convite expirou. Solicite um novo convite ao membro da rede." });
      }

      const finalUsername = username || email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();

      const existingByUsername = await storage.getUserByUsername(finalUsername);
      if (existingByUsername) return res.status(409).json({ error: "Nome de usuÃ¡rio jÃ¡ em uso" });
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) return res.status(409).json({ error: "E-mail jÃ¡ cadastrado" });

      // The inviter chooses the destination when generating the invite link.
      const INTERESSES_VALIDOS = ["vitrine", "capital", "membros"];
      const conviteLinkTipo = INTERESSES_VALIDOS.includes(String((conviteLink as any).tipo || ""))
        ? String((conviteLink as any).tipo)
        : "";
      const fallbackInteresses: string[] = Array.isArray(interesses)
        ? interesses.filter((v: any) => typeof v === "string" && INTERESSES_VALIDOS.includes(v))
        : [];
      const conviteDestino = conviteLinkTipo || fallbackInteresses[0] || "vitrine";
      const interessesArr: string[] = [conviteDestino];
      const naVitrine = interessesArr.includes("vitrine");
      const emBuiltCapital = interessesArr.includes("capital");
      const emMembrosBuilt = interessesArr.includes("membros");
      const rolePorConvite: Record<string, "user" | "investidor" | "membro"> = {
        vitrine: "user",
        capital: "investidor",
        membros: "membro",
      };
      const roleInicial = rolePorConvite[conviteDestino] || "user";
      const selosPorRole: Record<string, string[]> = {
        membro: ["BUILT_PROUD_MEMBER"],
        investidor: ["BUILT_CAPITAL_PARTNER"],
      };
      const selosIniciais = selosPorRole[roleInicial] || [];

      // 1. Create entry in Directus cadastro_geral (mandatory â€” registration fails if this fails)
      const directusPayload: Record<string, any> = {
        Nome_de_usuario: finalUsername,
        nome,
        email,
        na_vitrine: naVitrine,
        em_built_capital: emBuiltCapital,
        em_membros_built: emMembrosBuilt,
      };
      if (selosIniciais.length > 0) {
        directusPayload.Outras_redes_as_quais_pertenco = selosIniciais;
      }
      if (emBuiltCapital) {
        directusPayload.nucleo_alianca = "NÃºcleo de Capital";
        directusPayload.tipo_alianca = "AlianÃ§as de Aporte Financeiro";
        directusPayload.nucleos_alianca = ["NÃºcleo de Capital"];
        directusPayload.tipos_alianca = ["AlianÃ§as de Aporte Financeiro"];
      } else {
        const tiposAlianca = Array.isArray(tipos_alianca)
          ? tipos_alianca.filter((item: any) => typeof item === "string" && item.trim())
          : [];
        const nucleosAlianca = Array.isArray(nucleos_alianca)
          ? nucleos_alianca.filter((item: any) => typeof item === "string" && item.trim())
          : [];
        if (tiposAlianca.length > 0) {
          directusPayload.tipos_alianca = tiposAlianca;
          directusPayload.tipo_alianca = tiposAlianca[0];
        }
        if (nucleosAlianca.length > 0) {
          directusPayload.nucleos_alianca = nucleosAlianca;
          directusPayload.nucleo_alianca = nucleosAlianca[0];
        }
      }
      if (telefone) directusPayload.telefone = telefone;
      if (cpf) directusPayload.cpf = cpf;
      if (cnpj) directusPayload.cnpj = cnpj;
      if (whatsapp) directusPayload.whatsapp = whatsapp;
      if (empresa) directusPayload.empresa = empresa;
      if (cargo) directusPayload.cargo = cargo;
      if (cidade) directusPayload.cidade = cidade;
      if (estado) directusPayload.estado = estado;
      if (pais) directusPayload.pais = pais;
      if (area_atuacao) directusPayload.area_atuacao = area_atuacao;
      if (Array.isArray(idiomas) && idiomas.length > 0) directusPayload.idiomas = idiomas;
      if (link_site) directusPayload.link_site = link_site;
      if (foto_perfil) {
        directusPayload.foto_perfil = foto_perfil;
        directusPayload.foto_posicao_x = 50;
        directusPayload.foto_posicao_y = 50;
      }
      if (logo_empresa) directusPayload.logo_empresa = logo_empresa;
      if (ramo_atuacao) directusPayload.ramo_atuacao = ramo_atuacao;
      if (segmento) directusPayload.segmento = segmento;
      if (perfil_aliado) directusPayload.perfil_aliado = perfil_aliado;
      if (especialidade_livre) directusPayload.especialidade_livre = especialidade_livre;

      const createCadastroGeral = async (payload: Record<string, any>) => {
        const response = await fetch(`${DIRECTUS_URL}/items/cadastro_geral`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          },
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        return {
          response,
          text,
          data: text ? JSON.parse(text) : null,
        };
      };

      const patchCadastroGeralField = async (membroId: string, field: string, value: any) => {
        if (value === undefined || value === null || value === "") return;
        const response = await fetch(`${DIRECTUS_URL}/items/cadastro_geral/${membroId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          },
          body: JSON.stringify({ [field]: value }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          console.warn("[register] Campo opcional ignorado no cadastro_geral:", field, response.status, text.slice(0, 160));
        }
      };

      let directusData: any = null;
      let createdWithMinimalPayload = false;
      const directusAttempt = await createCadastroGeral(directusPayload);
      if (directusAttempt.response.ok) {
        directusData = directusAttempt.data;
      } else {
        console.error("[register] Directus cadastro_geral creation failed:", directusAttempt.response.status, directusAttempt.text.slice(0, 500));

        const minimalPayload = {
          Nome_de_usuario: directusPayload.Nome_de_usuario,
          nome: directusPayload.nome,
          email: directusPayload.email,
        };
        const retryAttempt = await createCadastroGeral(minimalPayload);
        if (!retryAttempt.response.ok) {
          console.error("[register] Directus cadastro_geral minimal creation failed:", retryAttempt.response.status, retryAttempt.text.slice(0, 500));
          return res.status(500).json({ error: "Erro ao criar perfil de membro. Tente novamente." });
        }
        createdWithMinimalPayload = true;
        directusData = retryAttempt.data;
      }
      const membroDirectusId: string = directusData.data?.id;
      if (!membroDirectusId) {
        return res.status(500).json({ error: "Erro ao criar perfil de membro (id ausente). Tente novamente." });
      }
      console.log("[register] Directus cadastro_geral created:", membroDirectusId);

      if (createdWithMinimalPayload) {
        for (const [field, value] of Object.entries(directusPayload)) {
          if (["Nome_de_usuario", "nome", "email"].includes(field)) continue;
          await patchCadastroGeralField(membroDirectusId, field, value);
        }
      }

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
        role: roleInicial,
        permissions: permissionsForRole(roleInicial),
        ativo: true,
      });

      // 4. Mark convite_link as used and create the destination-specific onboarding invite.
      // These steps are mandatory â€” if they fail we roll back both the user creation
      // AND the token consumption so the invite can still be used on retry.
      let tokenConsumed = false;
      let onboardingToken: string | null = null;
      try {
        await storage.updateConviteLink(conviteLink.id, {
          status: "usado",
          usado_por_user_id: user.id,
          usado_em: new Date(),
        });
        tokenConsumed = true;

        const conviteTipo = conviteDestino === "membros" ? "associacao_completa" : conviteDestino;
        const conviteCriado = await storage.createConvite({
          comunidade_id: conviteLink.comunidade_id!,
          candidato_membro_id: membroDirectusId,
          candidato_nome: nome,
          candidato_email: email,
          invitador_membro_id: conviteLink.gerador_membro_id || null,
          status: "termos_pendentes",
          tipo: conviteTipo,
          dados_contratuais: {
            nome_completo: nome,
            email,
            telefone: telefone || whatsapp || null,
            whatsapp: whatsapp || null,
            cpf: cpf || null,
            cnpj: cnpj || null,
            nome_empresa: empresa || null,
            empresa: empresa || null,
            cargo: cargo || null,
            cidade: cidade || null,
            estado: estado || null,
            pais: pais || null,
            interesses: interessesArr,
            origem: "cadastro_inicial",
            convite_link_tipo: conviteDestino,
            termos_aceitos: {},
            termos_versoes: {},
          },
          expires_at: null,
        });
        onboardingToken = conviteCriado.token;
        console.log("[register] onboarding convite created:", conviteCriado.id, "tipo:", conviteTipo);
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

      // Auto-login: set session so the new user is immediately authenticated
      (req.session as any).directusUserId = user.id;
      (req.session as any).membroId = membroDirectusId;
      (req.session as any).nome = nome;
      (req.session as any).email = email;
      (req.session as any).role = "user";
      (req.session as any).permissions = {};

      const { password: _pw, ...safe } = user;
      res.json({
        success: true,
        user: safe,
        ...(onboardingToken ? { onboarding_token: onboardingToken, vitrine_token: onboardingToken } : {}),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/forgot-password â€” send a password reset email
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "E-mail obrigatÃ³rio" });
      const trimmed = email.trim();
      // Always return 200 to avoid user enumeration â€” but log internally
      const user = await storage.getUserByEmail(trimmed);
      if (user) {
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const resetToken = await storage.createPasswordResetToken(user.id, expires);
        const { enviarResetSenha } = await import("./mailer");
        try {
          const mailResult = await enviarResetSenha({ email: user.email || trimmed, nome: user.nome || user.username || "", token: resetToken.token });
          if (!mailResult.ok) {
            return res.status(502).json({ error: "NÃ£o foi possÃ­vel enviar o e-mail de redefiniÃ§Ã£o agora. Tente novamente em instantes." });
          }
          console.log("[forgot-password] Reset email sent to:", user.email || trimmed);
        } catch (mailErr: any) {
          console.error("[forgot-password] Failed to send email:", mailErr.message);
          return res.status(502).json({ error: "NÃ£o foi possÃ­vel enviar o e-mail de redefiniÃ§Ã£o agora. Tente novamente em instantes." });
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

  // POST /api/reset-password â€” verify token and set new password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: "Token e senha sÃ£o obrigatÃ³rios" });
      if (password.length < 4) return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ error: "Token invÃ¡lido ou expirado" });
      if (resetToken.used) return res.status(400).json({ error: "Este link jÃ¡ foi utilizado" });
      if (new Date() > new Date(resetToken.expires_at)) return res.status(400).json({ error: "Link expirado. Solicite um novo." });
      // Pass plain password â€” updateUser handles hashing internally
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
      if (!email || !password) return res.status(400).json({ error: "Email e senha sÃ£o obrigatÃ³rios" });

      const finishLogin = (payload: Record<string, any>) => {
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
        recordUsageEvent(req, "login", { path: "/login", label: "Login" }).catch(() => {});
        req.session.save((error) => {
          if (error) {
            console.error("[login] session save error:", error);
            return res.status(500).json({ error: "Erro ao salvar sessao" });
          }
          return res.json(payload);
        });
      };

      // Authenticate against Directus
      const authRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const authText = await authRes.text();
      const authContentType = authRes.headers.get("content-type") || "";
      let authData: any = null;
      if (authContentType.includes("application/json")) {
        try {
          authData = JSON.parse(authText);
        } catch {
          authData = null;
        }
      }

      if (!authRes.ok || !authData) {
        // Directus auth failed â€” try local-only user auth (for admin-created users)
        try {
          const { comparePasswords } = await import("./storage");
          // Try all users with this email (newest first) â€” handles edge case of duplicate emails
          const localUsers = await storage.getUsersByEmail(email);
          for (const localUser of localUsers) {
            if (!localUser.ativo) continue;
            const valid = await comparePasswords(password, localUser.password);
            if (valid) {
              const employeeAccount = await getCompanyEmployeeByUserId(String(localUser.id)).catch(() => null);
              if (employeeAccount) {
                if (employeeAccount.status !== "ativo" || employeeAccount.employee_ativo === false) {
                  return res.status(403).json({
                    error: "Este acesso de funcionário está suspenso. Fale com o responsável da empresa.",
                    code: "COMPANY_ACCOUNT_SUSPENDED",
                  });
                }
                (req.session as any).directusUserId = localUser.id;
                applyCompanyEmployeeSession(req, employeeAccount, localUser);
                await db.execute(sql`
                  UPDATE company_employee_accounts
                  SET last_login_at = now()
                  WHERE id = ${employeeAccount.id}
                `).catch(() => {});
                return finishLogin({
                  id: localUser.id,
                  nome: localUser.nome,
                  email: localUser.email,
                  membro_directus_id: employeeAccount.owner_membro_id || null,
                  role: "employee",
                  permissions: companyAccessToLegacyPermissions(employeeAccount.permissions),
                  company_employee: true,
                  company_owner_user_id: employeeAccount.owner_user_id,
                  company_owner_membro_id: employeeAccount.owner_membro_id || null,
                  company_owner_nome: employeeAccount.owner_nome || null,
                  company_employee_role: employeeAccount.cargo || null,
                  company_permissions: normalizeCompanyAccess(employeeAccount.permissions),
                });
              }
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
              return finishLogin({
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
        return res.status(401).json({ error: "Credenciais invÃ¡lidas" });
      }

      const accessToken = authData.data?.access_token;
      if (!accessToken) return res.status(401).json({ error: "Erro ao obter token" });

      // Get the Directus user info
      const meRes = await fetch(`${DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,role`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meData = await meRes.json();
      const directusUser = meData.data;
      if (!directusUser) return res.status(401).json({ error: "UsuÃ¡rio nÃ£o encontrado" });

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

      // Check local users table for role + permissions, preferring the exact Directus user/member.
      let role = "user";
      let permissions: Record<string, string> = {};
      try {
        const localUsers = await storage.getUsersByEmail(email);
        const localUser = localUsers.find((u: any) => String(u.id) === String(directusUser.id))
          || (membroId ? localUsers.find((u: any) => String(u.membro_directus_id || "") === String(membroId)) : undefined)
          || localUsers[0];
        if (localUser && localUser.ativo) {
          role = localUser.role || "user";
          permissions = (localUser.permissions as Record<string, string>) || {};
          if (localUser.membro_directus_id) {
            membroId = localUser.membro_directus_id;
            nome = localUser.nome || nome;
          }
        }
      } catch (e: any) {
        console.warn("[login] local user lookup error:", e.message);
      }
      if (isBootstrapSuperAdmin(email)) {
        role = "admin";
        permissions = FULL_ADMIN_PERMISSIONS;
      }
      // Admins always get full permissions regardless of stored value
      if (role === "admin" || role === "manager") {
        permissions = FULL_ADMIN_PERMISSIONS;
      }

      // Store session
      (req.session as any).directusUserId = directusUser.id;
      (req.session as any).membroId = membroId;
      (req.session as any).nome = nome;
      (req.session as any).email = email;
      (req.session as any).role = role;
      (req.session as any).permissions = permissions;

      return finishLogin({
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
    if (!directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    const companyEmployee = await getCompanyEmployeeByUserId(String(directusUserId)).catch(() => null);
    if (companyEmployee && (companyEmployee.status !== "ativo" || companyEmployee.employee_ativo === false)) {
      return res.status(403).json({
        error: "Este acesso de funcionário está suspenso. Fale com o responsável da empresa.",
        code: "COMPANY_ACCOUNT_SUSPENDED",
      });
    }
    if (companyEmployee) {
      applyCompanyEmployeeSession(req, companyEmployee);
    }
    let role = (req.session as any).role || "user";
    let permissions = (req.session as any).permissions || {};
    const email = (req.session as any).email || "";
    // Always re-check local users table to ensure correct role without mixing duplicate e-mails.
    let matchedLocalUser: any | null = null;
    try {
      if (email) {
        const localUsers = await storage.getUsersByEmail(email);
        const sessionMembroId = (req.session as any).membroId;
        matchedLocalUser = localUsers.find((u: any) => String(u.id) === String(directusUserId))
          || (sessionMembroId ? localUsers.find((u: any) => String(u.membro_directus_id || "") === String(sessionMembroId)) : null)
          || localUsers[0]
          || null;
        if (matchedLocalUser && matchedLocalUser.ativo && !companyEmployee) {
          role = matchedLocalUser.role || role;
          if ((matchedLocalUser.permissions as any) && Object.keys(matchedLocalUser.permissions as any).length > 0) {
            permissions = matchedLocalUser.permissions as Record<string, string>;
          }
        }
      }
    } catch (_) {}
    if (isBootstrapSuperAdmin(email)) {
      role = "admin";
      permissions = FULL_ADMIN_PERMISSIONS;
      (req.session as any).role = role;
      (req.session as any).permissions = permissions;
    }
    if ((role === "admin" || role === "manager") && Object.keys(permissions).length === 0) {
      permissions = FULL_ADMIN_PERMISSIONS;
    }
    let membroId = (req.session as any).membroId as string | null;
    try {
      if (
        matchedLocalUser?.membro_directus_id
        && String(matchedLocalUser.membro_directus_id) !== String(membroId || "")
      ) {
        membroId = matchedLocalUser.membro_directus_id;
        (req.session as any).membroId = membroId;
        (req.session as any).nome = matchedLocalUser.nome || (req.session as any).nome;
      }
    } catch (_) {}
    let tipos_alianca: string[] = [];
    let Outras_redes_as_quais_pertenco: string[] = [];
    let fotoPerfil: string | null = null;
    let naVitrine: boolean | null = null;
    let emMembrosBuilt: boolean | null = null;
    let emBuiltCapital: boolean | null = null;
    let vitrineTermoAceitoEm: string | null = null;
    let vitrineTermoVersao: string | null = null;
    let areaAliancasTermoAceitoEm: string | null = null;
    let areaAliancasTermoVersao: string | null = null;
    let builtCapitalTermoAceitoEm: string | null = null;
    let builtCapitalTermoVersao: string | null = null;
    let nomePerfil = (req.session as any).nome || "";
    if (membroId) {
      try {
        const membro = await directusFetchOne("cadastro_geral", membroId, "fields=Nome_de_usuario,nome,tipos_alianca,Outras_redes_as_quais_pertenco,foto_perfil,na_vitrine,em_membros_built,em_built_capital,vitrine_termo_aceito_em,vitrine_termo_versao,area_aliancas_termo_aceito_em,area_aliancas_termo_versao,built_capital_termo_aceito_em,built_capital_termo_versao");
        if (membro) {
          if (!companyEmployee) nomePerfil = membro.Nome_de_usuario || membro.nome || nomePerfil;
          tipos_alianca = Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : [];
          Outras_redes_as_quais_pertenco = Array.isArray(membro.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : [];
          fotoPerfil = membro.foto_perfil || null;
          naVitrine = membro.na_vitrine === true || membro.na_vitrine === 1;
          emMembrosBuilt = membro.em_membros_built === true || membro.em_membros_built === 1;
          emBuiltCapital = membro.em_built_capital === true || membro.em_built_capital === 1;
          vitrineTermoAceitoEm = membro.vitrine_termo_aceito_em || null;
          vitrineTermoVersao = membro.vitrine_termo_versao || null;
          areaAliancasTermoAceitoEm = membro.area_aliancas_termo_aceito_em || null;
          areaAliancasTermoVersao = membro.area_aliancas_termo_versao || null;
          builtCapitalTermoAceitoEm = membro.built_capital_termo_aceito_em || null;
          builtCapitalTermoVersao = membro.built_capital_termo_versao || null;
          if (!companyEmployee) (req.session as any).nome = nomePerfil;
        }
      } catch (_) {}
    }
    if ((role === "admin" || role === "manager") && !vitrineTermoAceitoEm) {
      const acceptedAt = new Date().toISOString();
      vitrineTermoAceitoEm = acceptedAt;
      areaAliancasTermoAceitoEm = areaAliancasTermoAceitoEm || acceptedAt;
      builtCapitalTermoAceitoEm = builtCapitalTermoAceitoEm || acceptedAt;
    }
    // Check for pending or rejected vitrine approval (only for "user" role)
    let pending_vitrine = false;
    let convite_pendente: { token: string; status: string } | null = null;
    let adesao_pendente: { token: string; status: string } | null = null;
    const PENDING_VITRINE_STATUSES = ["termos_pendentes", "termos_aceitos", "aguardando_avaliacao_aura", "candidato", "rejeitado", "expirado"];
    const PENDING_ADESAO_STATUSES = ["termos_pendentes", "termos_aceitos", "pagamento_pendente", "aguardando_avaliacao_aura", "candidato"];
    if (role === "user" && email) {
      try {
        const localUser = await storage.getUserByEmail(email);
        if (localUser?.membro_directus_id) {
          const vitrineConvites = await storage.getConvitesByCandidatoMembro(localUser.membro_directus_id, "vitrine");
          const capitalConvites = await storage.getConvitesByCandidatoMembro(localUser.membro_directus_id, "capital");
          const blocking = [...vitrineConvites, ...capitalConvites].find(c => PENDING_VITRINE_STATUSES.includes(c.status));
          if (blocking) {
            pending_vitrine = true;
            convite_pendente = { token: blocking.token, status: blocking.status };
          }
          const adesaoConvites = await storage.getConvitesByCandidatoMembro(localUser.membro_directus_id, "associacao_completa");
          const adesao = adesaoConvites.find(c => PENDING_ADESAO_STATUSES.includes(c.status));
          if (adesao) {
            adesao_pendente = { token: adesao.token, status: adesao.status };
          }
        }
      } catch (_) {}
    }

    res.json({
      id: directusUserId,
      nome: nomePerfil,
      email,
      membro_directus_id: membroId || null,
      role,
      permissions,
      tipos_alianca,
      Outras_redes_as_quais_pertenco,
      na_vitrine: naVitrine,
      em_membros_built: emMembrosBuilt,
      em_built_capital: emBuiltCapital,
      foto_perfil: assetApiUrl(fotoPerfil),
      vitrine_termo_aceito_em: vitrineTermoAceitoEm,
      vitrine_termo_versao: vitrineTermoVersao,
      area_aliancas_termo_aceito_em: areaAliancasTermoAceitoEm,
      area_aliancas_termo_versao: areaAliancasTermoVersao,
      built_capital_termo_aceito_em: builtCapitalTermoAceitoEm,
      built_capital_termo_versao: builtCapitalTermoVersao,
      pending_vitrine,
      convite_pendente,
      adesao_pendente,
      company_employee: Boolean(companyEmployee),
      company_owner_user_id: companyEmployee?.owner_user_id || null,
      company_owner_membro_id: companyEmployee?.owner_membro_id || null,
      company_owner_nome: companyEmployee?.owner_nome || null,
      company_owner_email: companyEmployee?.owner_email || null,
      company_employee_role: companyEmployee?.cargo || null,
      company_permissions: companyEmployee
        ? normalizeCompanyAccess(companyEmployee.permissions)
        : null,
    });
  });

  app.post("/api/me/password", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId;
      const email = (req.session as any).email || "";
      if (!directusUserId && !email) return res.status(401).json({ error: "NÃ£o autenticado" });

      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Informe a senha atual e a nova senha" });
      }
      if (String(newPassword).length < 4) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 4 caracteres" });
      }

      const localUser = (directusUserId ? await storage.getUser(directusUserId).catch(() => undefined) : undefined)
        || (email ? await storage.getUserByEmail(email) : undefined);
      if (!localUser || !localUser.ativo) {
        return res.status(404).json({ error: "UsuÃ¡rio local nÃ£o encontrado" });
      }

      const { comparePasswords } = await import("./storage");
      const validCurrentPassword = await comparePasswords(String(currentPassword), localUser.password);
      if (!validCurrentPassword) {
        return res.status(400).json({ error: "Senha atual incorreta" });
      }

      await storage.updateUser(localUser.id, { password: String(newPassword) });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao alterar senha" });
    }
  });

  function getDirectusRelationId(value: any): string | null {
    if (!value) return null;
    if (typeof value === "object") return value.id ? String(value.id) : null;
    return String(value);
  }

  async function getMembroComunidadeIds(membroId: string | null | undefined): Promise<Set<string>> {
    if (!membroId) return new Set();
    const col = await getComunidadeCol();
    const allUrl = `${DIRECTUS_URL}/items/${col}?fields=id,nome,sigla,membros.cadastro_geral_id&limit=200`;
    const response = await fetch(allUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
    if (!response.ok) return new Set();
    const data = await response.json();
    const comunidades: any[] = data.data || [];
    const comunidade = comunidades.find((item: any) => {
      const membros: any[] = Array.isArray(item.membros) ? item.membros : [];
      return membros.some((membro: any) => getDirectusRelationId(membro.cadastro_geral_id) === String(membroId));
    });
    if (!comunidade) return new Set();
    return new Set(
      (Array.isArray(comunidade.membros) ? comunidade.membros : [])
        .map((membro: any) => getDirectusRelationId(membro.cadastro_geral_id))
        .filter((id: string | null): id is string => Boolean(id))
    );
  }

  app.get("/api/agenda/membros-disponiveis", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const role = await getEffectiveRole(req);
      const isSuperAdmin = role === "admin";
      const sessionMembroId = (req.session as any).membroId as string | null;
      const allowedMembroIds = isSuperAdmin ? null : await getMembroComunidadeIds(sessionMembroId);

      if (!isSuperAdmin && allowedMembroIds) {
        if (sessionMembroId) allowedMembroIds.add(String(sessionMembroId));
        const biasItems = await directusFetch(
          "bias_projetos",
          "fields=*&limit=500"
        );
        biasItems
          .filter((bia: any) => isUserLinkedToBia(bia, sessionMembroId))
          .forEach((bia: any) => {
            [
              bia.autor_bia,
              bia.aliado_built,
              bia.diretor_alianca,
              bia.diretor_nucleo_tecnico,
              bia.diretor_execucao,
              bia.diretor_comercial,
              bia.diretor_capital,
              ...parseBiaMemberList(bia.socios_guardioes),
              ...parseBiaMemberList(bia.socios_multiplicadores),
              ...parseBiaMemberList(bia.terceiros),
            ]
              .filter(Boolean)
              .forEach((id: any) => allowedMembroIds.add(String(id)));
          });
      }

      const items = await directusFetch(
        "cadastro_geral",
        "fields=*,Especialidades.*.*"
      );
      const filtered = items
        .filter((membro: any) => membro?.id && (isSuperAdmin || allowedMembroIds?.has(String(membro.id))))
        .map((membro: any) => ({
          id: String(membro.id),
          nome: membro.nome || membro.nome_completo || membro.Nome_de_usuario || membro.email || "Membro BUILT",
          Nome_de_usuario: membro.Nome_de_usuario || null,
          email: membro.email || null,
          empresa: membro.empresa || membro.nome_fantasia || null,
          foto_perfil: membro.foto_perfil || null,
          cargo: membro.cargo || null,
          tipo_de_cadastro: membro.tipo_de_cadastro || null,
          tipo_alianca: membro.tipo_alianca || null,
          tipos_alianca: Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : [],
          nucleo_alianca: membro.nucleo_alianca || null,
          nucleos_alianca: Array.isArray(membro.nucleos_alianca) ? membro.nucleos_alianca : [],
        }))
        .sort((a: any, b: any) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao carregar membros disponÃ­veis" });
    }
  });

  app.get("/api/agenda", async (req, res) => {
    try {
      const userId = (req.session as any).directusUserId || (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const tarefas = await storage.getAgendaTarefasByUser(String(userId));
      const origemIds = Array.from(new Set(tarefas.map((t: any) => t.origem_tarefa_id).filter(Boolean)));
      const compartilhamentos = new Map<string, number>();
      for (const origemId of origemIds) {
        const result = await db.execute(sql`
          SELECT count(*)::int AS total
          FROM agenda_tarefas
          WHERE origem_tarefa_id = ${origemId}
        `);
        const total = Number((result as any).rows?.[0]?.total ?? 1);
        compartilhamentos.set(String(origemId), Math.max(0, total - 1));
      }
      res.json(tarefas.map((tarefa: any) => ({
        ...tarefa,
        compartilhada_com: tarefa.origem_tarefa_id ? (compartilhamentos.get(String(tarefa.origem_tarefa_id)) || 0) : 0,
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao carregar agenda" });
    }
  });

  app.post("/api/agenda", async (req, res) => {
    try {
      const userId = (req.session as any).directusUserId || (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const creatorMembroId = (req.session as any).membroId || null;
      const creatorName = (req.session as any).nome || (req.session as any).email || "Membro BUILT";
      const selectedMembroIds = Array.isArray(req.body?.membros_ids)
        ? req.body.membros_ids.map((id: any) => String(id)).filter(Boolean)
        : [];
      const role = await getEffectiveRole(req);
      if (role !== "admin" && selectedMembroIds.length > 0) {
        const allowedMembroIds = await getMembroComunidadeIds(creatorMembroId);
        const hasForbiddenMember = selectedMembroIds.some((id: string) => !allowedMembroIds.has(id));
        if (hasForbiddenMember) {
          return res.status(403).json({ error: "SÃ³ Ã© possÃ­vel adicionar membros da sua comunidade." });
        }
      }
      const { randomUUID } = await import("crypto");
      const origemTarefaId = randomUUID();
      const payload = insertAgendaTarefaSchema.parse({
        ...req.body,
        user_id: String(userId),
        membro_id: creatorMembroId || req.body?.membro_id || null,
        origem_tarefa_id: origemTarefaId,
        atribuido_por_user_id: String(userId),
        atribuido_por_membro_id: creatorMembroId,
        atribuido_por_nome: creatorName,
      });
      const allUsers = selectedMembroIds.length > 0 ? await storage.getAllUsers() : [];
      const targetUsers = allUsers
        .filter(user => user.ativo && user.membro_directus_id && selectedMembroIds.includes(String(user.membro_directus_id)))
        .map(user => ({
          user_id: user.id,
          membro_id: user.membro_directus_id || null,
        }));
      const uniqueTargets = new Map<string, { user_id: string; membro_id: string | null }>();
      uniqueTargets.set(String(userId), { user_id: String(userId), membro_id: creatorMembroId });
      for (const target of targetUsers) uniqueTargets.set(target.user_id, target);

      const created = [];
      for (const target of uniqueTargets.values()) {
        created.push(await storage.createAgendaTarefa({
          ...payload,
          user_id: target.user_id,
          membro_id: target.membro_id,
        }));
      }
      const ownTask = created.find(task => task.user_id === String(userId)) || created[0];
      res.status(201).json({ ...ownTask, compartilhada_com: created.length - 1 });
    } catch (error: any) {
      const message = error?.errors?.[0]?.message || error.message || "Erro ao criar aÃ§Ã£o";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/agenda/:id", async (req, res) => {
    try {
      const userId = (req.session as any).directusUserId || (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const allowedStatuses = new Set(["pendente", "em_andamento", "concluida", "cancelada"]);
      const allowedPrioridades = new Set(["baixa", "media", "alta"]);
      const data: Record<string, any> = {};
      for (const key of ["titulo", "descricao", "data", "hora", "status", "prioridade", "contexto_tipo", "contexto_id"]) {
        if (key in (req.body || {})) data[key] = req.body[key] === "" ? null : req.body[key];
      }
      if (typeof data.titulo === "string" && !data.titulo.trim()) {
        return res.status(400).json({ error: "TÃ­tulo Ã© obrigatÃ³rio" });
      }
      if (data.status && !allowedStatuses.has(String(data.status))) {
        return res.status(400).json({ error: "Status invÃ¡lido" });
      }
      if (data.prioridade && !allowedPrioridades.has(String(data.prioridade))) {
        return res.status(400).json({ error: "Prioridade invÃ¡lida" });
      }
      const tarefa = await storage.updateAgendaTarefa(req.params.id, String(userId), data as any);
      if (!tarefa) return res.status(404).json({ error: "AÃ§Ã£o nÃ£o encontrada" });
      res.json(tarefa);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao atualizar aÃ§Ã£o" });
    }
  });

  app.delete("/api/agenda/:id", async (req, res) => {
    try {
      const userId = (req.session as any).directusUserId || (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const tarefa = await storage.getAgendaTarefa(req.params.id, String(userId));
      if (!tarefa) return res.status(404).json({ error: "AÃ§Ã£o nÃ£o encontrada" });
      const isCreator = tarefa.atribuido_por_user_id && String(tarefa.atribuido_por_user_id) === String(userId);
      if (isCreator && tarefa.origem_tarefa_id) {
        await db.execute(sql`
          DELETE FROM agenda_tarefas
          WHERE origem_tarefa_id = ${tarefa.origem_tarefa_id}
        `);
        return res.json({ success: true, deleted_for_all: true });
      }
      const ok = await storage.deleteAgendaTarefa(req.params.id, String(userId));
      if (!ok) return res.status(404).json({ error: "AÃ§Ã£o nÃ£o encontrada" });
      res.json({ success: true, deleted_for_all: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao excluir aÃ§Ã£o" });
    }
  });

  // ========== USER MANAGEMENT ==========
  app.post("/api/usage-events", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
      const pathValue = typeof req.body?.path === "string" ? req.body.path.slice(0, 500) : null;
      const labelValue = typeof req.body?.label === "string" ? req.body.label.slice(0, 200) : null;
      await recordUsageEvent(req, String(req.body?.event_type || "page_view"), {
        path: pathValue,
        label: labelValue,
        metadata: typeof req.body?.metadata === "object" && req.body.metadata ? req.body.metadata : {},
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/usage-heatmap", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
      if (!isAdminRequest(req)) return res.status(403).json({ error: "Apenas administradores podem acessar este dashboard." });

      const days = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 7), 180);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const allUsers = await storage.getAllUsers().catch(() => []);
      const safeUsers = allUsers.map(({ password, ...u }) => u);

      const [
        dbPageEvents,
        interesses,
        tarefas,
        convites,
        diretorSolicitacoes,
        socioSolicitacoes,
        mouAceites,
        chamadas,
        aura,
      ] = await Promise.all([
        db.select().from(userUsageEvents).where(sql`${userUsageEvents.created_at} >= ${since}`).catch(() => []),
        db.select().from(opaInteresses).where(sql`${opaInteresses.criado_em} >= ${since}`).catch(() => []),
        db.select().from(agendaTarefas).where(sql`${agendaTarefas.criado_em} >= ${since}`).catch(() => []),
        db.select().from(convitesComunidade).where(sql`${convitesComunidade.criado_em} >= ${since}`).catch(() => []),
        db.select().from(biaDiretorSolicitacoes).where(sql`${biaDiretorSolicitacoes.criado_em} >= ${since}`).catch(() => []),
        db.select().from(biaSocioSolicitacoes).where(sql`${biaSocioSolicitacoes.criado_em} >= ${since}`).catch(() => []),
        db.select().from(biaMouAceites).where(sql`${biaMouAceites.aceito_em} >= ${since}`).catch(() => []),
        db.select().from(chamadasAlianca).where(sql`${chamadasAlianca.criado_em} >= ${since}`).catch(() => []),
        db.select().from(auraAvaliacoes).where(sql`${auraAvaliacoes.created_at} >= ${since}`).catch(() => []),
      ]);
      const memoryPageEvents = memoryUsageEvents.filter((event) => {
        const createdAt = event.created_at ? new Date(event.created_at) : null;
        return createdAt && createdAt >= since;
      });
      const pageEvents = [...(dbPageEvents as any[]), ...memoryPageEvents];

      const moduleInfo: Record<string, { label: string; weight: number }> = {
        vitrine: { label: "Vitrine", weight: 1 },
        alliances: { label: "Alliances", weight: 1 },
        capital: { label: "Capital", weight: 1 },
        aura: { label: "Aura", weight: 4 },
        opas: { label: "OBAs", weight: 4 },
        bias: { label: "BIAs", weight: 4 },
        agenda: { label: "Agenda", weight: 3 },
        documentos: { label: "Documentos/MOU", weight: 4 },
        administracao: { label: "Administração", weight: 1 },
      };
      const moduleKeys = Object.keys(moduleInfo);
      const members = new Map<string, any>();

      function ensureMember(id: string | null | undefined, seed: Record<string, any> = {}) {
        const key = id ? String(id) : "";
        if (!key) return null;
        if (!members.has(key)) {
          members.set(key, {
            id: key,
            user_id: null,
            nome: seed.nome || seed.email || "Membro sem nome",
            email: seed.email || null,
            role: seed.role || null,
            total: 0,
            last_activity_at: null,
            modules: Object.fromEntries(moduleKeys.map((module) => [module, 0])),
          });
        }
        const current = members.get(key);
        if (seed.nome && (!current.nome || current.nome === "Membro sem nome")) current.nome = seed.nome;
        if (seed.email && !current.email) current.email = seed.email;
        if (seed.role && !current.role) current.role = seed.role;
        if (seed.user_id && !current.user_id) current.user_id = seed.user_id;
        return current;
      }

      for (const user of safeUsers as any[]) {
        const id = user.membro_directus_id || user.id;
        ensureMember(id, {
          user_id: user.id,
          nome: user.nome || user.username,
          email: user.email,
          role: user.role,
        });
      }

      function touch(id: string | null | undefined, module: string, dateValue: any, points = 1, seed: Record<string, any> = {}) {
        const member = ensureMember(id, seed);
        if (!member || !moduleInfo[module]) return;
        member.modules[module] += points;
        member.total += points;
        const date = dateValue ? new Date(dateValue) : new Date();
        if (!member.last_activity_at || date > new Date(member.last_activity_at)) {
          member.last_activity_at = date.toISOString();
        }
      }

      function moduleFromPath(pathValue: string | null | undefined) {
        const pathText = String(pathValue || "");
        if (pathText.includes("aura")) return "aura";
        if (pathText.includes("built-capital")) return "capital";
        if (pathText.includes("area-aliancas") || pathText.includes("comunidade") || pathText.includes("land-bank")) return "alliances";
        if (pathText.includes("opa")) return "opas";
        if (pathText.includes("bia") || pathText.includes("movimentacao-cotas")) return "bias";
        if (pathText.includes("agenda")) return "agenda";
        if (pathText.includes("documentacao") || pathText.includes("api/files")) return "documentos";
        if (pathText.includes("admin") || pathText.includes("membros")) return "administracao";
        return "vitrine";
      }

      for (const event of pageEvents as any[]) {
        touch(event.membro_id || event.user_id, moduleFromPath(event.path), event.created_at, moduleInfo[moduleFromPath(event.path)].weight, {
          user_id: event.user_id,
          nome: event.nome,
          email: event.email,
        });
      }
      for (const item of interesses as any[]) touch(item.membro_id || item.user_id, "opas", item.criado_em, 8, { nome: item.membro_nome });
      for (const item of tarefas as any[]) touch(item.membro_id || item.user_id, "agenda", item.criado_em, 5);
      for (const item of convites as any[]) {
        touch(item.candidato_membro_id, "alliances", item.criado_em, 6, { nome: item.candidato_nome, email: item.candidato_email });
        touch(item.invitador_membro_id, "alliances", item.criado_em, 4);
      }
      for (const item of diretorSolicitacoes as any[]) {
        touch(item.diretor_membro_id, "bias", item.criado_em, 5, { nome: item.diretor_nome, email: item.diretor_email });
        touch(item.solicitante_membro_id, "bias", item.criado_em, 4, { nome: item.solicitante_nome, email: item.solicitante_email });
        if (item.respondido_em) touch(item.diretor_membro_id, "documentos", item.respondido_em, 5, { nome: item.diretor_nome, email: item.diretor_email });
      }
      for (const item of socioSolicitacoes as any[]) {
        touch(item.socio_membro_id, "bias", item.criado_em, 5, { nome: item.socio_nome, email: item.socio_email });
        touch(item.solicitante_membro_id, "bias", item.criado_em, 4, { nome: item.solicitante_nome, email: item.solicitante_email });
        if (item.respondido_em) touch(item.socio_membro_id, "documentos", item.respondido_em, 5, { nome: item.socio_nome, email: item.socio_email });
      }
      for (const item of mouAceites as any[]) touch(item.membro_id, "documentos", item.aceito_em, 8);
      for (const item of chamadas as any[]) {
        touch(item.criado_por_membro_id, "agenda", item.criado_em, 5, { nome: item.criado_por_nome });
        const destinatarios = Array.isArray(item.destinatarios) ? item.destinatarios : [];
        for (const dest of destinatarios) touch(dest?.id, "agenda", item.criado_em, 2, { nome: dest?.nome, email: dest?.email });
      }
      for (const item of aura as any[]) {
        touch(item.avaliador_membro_id, "aura", item.created_at, 8);
        touch(item.avaliado_membro_id, "aura", item.created_at, 2);
      }

      const rows = [...members.values()].map((member) => ({
        ...member,
        status: member.total >= 40 ? "alta" : member.total >= 15 ? "media" : member.total > 0 ? "baixa" : "sem_uso",
      })).sort((a, b) => b.total - a.total);
      const activeRows = rows.filter((row) => row.total > 0);
      const modules = moduleKeys.map((key) => {
        const total = rows.reduce((sum, row) => sum + Number(row.modules[key] || 0), 0);
        const activeMembers = rows.filter((row) => Number(row.modules[key] || 0) > 0).length;
        return { key, label: moduleInfo[key].label, total, active_members: activeMembers };
      });

      res.json({
        period_days: days,
        generated_at: new Date().toISOString(),
        summary: {
          total_members: rows.length,
          active_members: activeRows.length,
          inactive_members: rows.length - activeRows.length,
          total_events: Math.round(rows.reduce((sum, row) => sum + row.total, 0)),
          high_usage_members: rows.filter((row) => row.status === "alta").length,
        },
        modules,
        members: rows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/monetization", async (req, res) => {
    try {
      if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Nao autenticado" });
      if (!isAdminRequest(req)) return res.status(403).json({ error: "Apenas administradores podem acessar este dashboard." });

      const days = Math.min(Math.max(parseInt(String(req.query.days || "90"), 10) || 90, 30), 365);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const membershipPrice = 3197;
      const paidStatuses = new Set(["paid", "pago", "received", "received_in_cash", "confirmed", "completed", "membro"]);
      const pendingStatuses = new Set(["pending", "pendente", "pagamento_pendente", "awaiting_payment", "overdue"]);
      const normalizedStatus = (value: any) => String(value || "").trim().toLowerCase();
      const isPaid = (value: any) => paidStatuses.has(normalizedStatus(value));
      const isPending = (value: any) => pendingStatuses.has(normalizedStatus(value));
      const asDate = (value: any) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };
      const inPeriod = (value: any) => {
        const parsed = asDate(value);
        return Boolean(parsed && parsed >= since);
      };

      const allUsers = await storage.getAllUsers().catch(() => []);
      const usersById = new Map(
        (allUsers as any[]).map((user) => [
          String(user.id),
          {
            nome: user.nome || user.username || user.email || "Usuario",
            email: user.email || null,
            membro_id: user.membro_directus_id || null,
          },
        ]),
      );
      const usersByMemberId = new Map(
        (allUsers as any[])
          .filter((user) => user.membro_directus_id)
          .map((user) => [
            String(user.membro_directus_id),
            {
              nome: user.nome || user.username || user.email || "Usuario",
              email: user.email || null,
            },
          ]),
      );

      const [allInvites, allAds, bankChargeResult, communities, bias] = await Promise.all([
        db.select().from(convitesComunidade).catch(() => []),
        db.select().from(anuncios).catch(() => []),
        db.execute(sql`
          SELECT *
          FROM bia_bank_charges
          ORDER BY created_at DESC
        `).catch(() => ({ rows: [] } as any)),
        (async () => {
          try {
            const collection = await getComunidadeCol();
            return await directusFetchScoped(collection, "fields=id,nome,sigla&limit=-1");
          } catch {
            return [];
          }
        })(),
        directusFetchScoped("bias_projetos", "fields=id,nome,nome_bia,titulo,codigo_bia&limit=-1").catch(() => []),
      ]);

      const communitiesById = new Map(
        (communities as any[]).map((community) => [
          String(community.id),
          community.nome || community.sigla || `Comunidade ${community.id}`,
        ]),
      );
      const biasById = new Map(
        (bias as any[]).map((bia) => [
          String(bia.id),
          bia.nome_bia || bia.nome || bia.titulo || bia.codigo_bia || `BIA ${bia.id}`,
        ]),
      );

      const membershipTypes = new Set(["associacao_completa", "completo"]);
      const membershipRows = (allInvites as any[])
        .filter((invite) => membershipTypes.has(String(invite.tipo || "").toLowerCase()))
        .map((invite) => {
          const status = normalizedStatus(invite.status);
          const paid = status === "membro";
          const pending = status === "pagamento_pendente";
          const eventDate = invite.atualizado_em || invite.termos_aceitos_em || invite.criado_em;
          return {
            id: String(invite.id),
            member_id: invite.candidato_membro_id ? String(invite.candidato_membro_id) : null,
            name: invite.candidato_nome || invite.candidato_email || "Candidato",
            email: invite.candidato_email || null,
            community_id: invite.comunidade_id ? String(invite.comunidade_id) : null,
            community_name: communitiesById.get(String(invite.comunidade_id)) || `Comunidade ${invite.comunidade_id}`,
            status,
            provider: "asaas/stripe",
            billing_model: "pagamento_unico",
            amount: paid || pending ? membershipPrice : null,
            paid,
            pending,
            created_at: invite.criado_em || null,
            updated_at: eventDate || null,
          };
        })
        .sort((a, b) => Number(asDate(b.updated_at)) - Number(asDate(a.updated_at)));

      const adsRows = (allAds as any[])
        .map((ad) => {
          const member = usersByMemberId.get(String(ad.membro_id));
          const eventDate = ad.publicado_em || ad.pagamento_gerado_em || ad.created_at;
          return {
            id: String(ad.id),
            member_id: ad.membro_id ? String(ad.membro_id) : null,
            name: member?.nome || "Anunciante",
            email: member?.email || null,
            title: ad.titulo || "Anuncio",
            environment: ad.ambiente || "vitrine",
            slot_type: ad.slot_tipo || "padrao",
            provider: ad.pagamento_provider || (ad.pagamento_status === "dispensado" ? "administrativo" : null),
            status: normalizedStatus(ad.pagamento_status || (ad.ativo ? "ativo" : "inativo")),
            amount: null,
            active: Boolean(ad.ativo),
            start_at: ad.data_inicio || null,
            end_at: ad.data_fim || null,
            created_at: eventDate || null,
          };
        })
        .sort((a, b) => Number(asDate(b.created_at)) - Number(asDate(a.created_at)));

      const bankRows = resultRows(bankChargeResult)
        .map((charge: any) => {
          const creator = usersById.get(String(charge.created_by_user_id));
          const amount = charge.valor == null ? null : Number(charge.valor);
          return {
            id: String(charge.id),
            bia_id: charge.bia_id ? String(charge.bia_id) : null,
            bia_name: biasById.get(String(charge.bia_id)) || (charge.bia_id ? `BIA ${charge.bia_id}` : "BIA"),
            user_name: charge.pagador_nome || creator?.nome || "Pagador",
            user_email: charge.pagador_email || creator?.email || null,
            description: charge.descricao || "Cobranca da BIA",
            provider: charge.provider || "pinbank",
            type: charge.type || "boleto",
            status: normalizedStatus(charge.status),
            amount: Number.isFinite(amount) ? amount : null,
            created_at: charge.created_at || null,
            due_at: charge.data_vencimento || null,
          };
        })
        .sort((a: any, b: any) => Number(asDate(b.created_at)) - Number(asDate(a.created_at)));

      const activeMemberships = membershipRows.filter((row) => row.paid);
      const pendingMemberships = membershipRows.filter((row) => row.pending);
      const paidMembershipsInPeriod = activeMemberships.filter((row) => inPeriod(row.updated_at));
      const pendingMembershipsInPeriod = pendingMemberships.filter((row) => inPeriod(row.updated_at));
      const paidAds = adsRows.filter((row) => row.status === "pago");
      const pendingAds = adsRows.filter((row) => row.status === "pendente");
      const activeAds = adsRows.filter((row) => row.active);
      const periodBankRows = bankRows.filter((row: any) => inPeriod(row.created_at));
      const paidBankRows = periodBankRows.filter((row: any) => isPaid(row.status));
      const pendingBankRows = periodBankRows.filter((row: any) => isPending(row.status));
      const sumAmounts = (rows: Array<{ amount: number | null }>) =>
        rows.reduce((sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0), 0);

      const transactions = [
        ...membershipRows
          .filter((row) => (row.paid || row.pending) && inPeriod(row.updated_at))
          .map((row) => ({
            id: `membership:${row.id}`,
            source: "membership",
            label: row.paid ? "Adesao confirmada" : "Adesao aguardando pagamento",
            user_name: row.name,
            user_email: row.email,
            provider: row.provider,
            status: row.status,
            amount: row.amount,
            created_at: row.updated_at,
            reference: row.community_name,
          })),
        ...adsRows
          .filter((row) => inPeriod(row.created_at))
          .map((row) => ({
            id: `ad:${row.id}`,
            source: "ads",
            label: row.title,
            user_name: row.name,
            user_email: row.email,
            provider: row.provider,
            status: row.status,
            amount: null,
            created_at: row.created_at,
            reference: `${row.environment} / ${row.slot_type}`,
          })),
        ...periodBankRows.map((row: any) => ({
          id: `pinbank:${row.id}`,
          source: "pinbank",
          label: row.description,
          user_name: row.user_name,
          user_email: row.user_email,
          provider: row.provider,
          status: row.status,
          amount: row.amount,
          created_at: row.created_at,
          reference: row.bia_name,
        })),
      ]
        .sort((a, b) => Number(asDate(b.created_at)) - Number(asDate(a.created_at)))
        .slice(0, 100);

      res.json({
        period_days: days,
        generated_at: new Date().toISOString(),
        summary: {
          platform_confirmed_revenue: sumAmounts(paidMembershipsInPeriod),
          platform_pending_revenue: sumAmounts(pendingMembershipsInPeriod),
          active_memberships: activeMemberships.length,
          pending_memberships: pendingMemberships.length,
          active_ads: activeAds.length,
          paid_ads: paidAds.length,
          pending_ads: pendingAds.length,
          bia_collections_received: sumAmounts(paidBankRows),
          bia_collections_pending: sumAmounts(pendingBankRows),
        },
        channels: [
          {
            key: "membership",
            label: "Adesões BUILT",
            provider: "Asaas / Stripe",
            billing_model: "Pagamento único",
            tracking: "operational",
            confirmed_amount: sumAmounts(paidMembershipsInPeriod),
            pending_amount: sumAmounts(pendingMembershipsInPeriod),
            paid_count: paidMembershipsInPeriod.length,
            pending_count: pendingMemberships.length,
            active_count: activeMemberships.length,
            note: "O fluxo atual cobra uma taxa única de adesão de R$ 3.197,00.",
          },
          {
            key: "ads",
            label: "Anúncios",
            provider: "Asaas / Stripe",
            billing_model: "Por periodo de exibicao",
            tracking: "partial",
            confirmed_amount: null,
            pending_amount: null,
            paid_count: paidAds.length,
            pending_count: pendingAds.length,
            active_count: activeAds.length,
            note: "O status é rastreado, mas o valor cobrado ainda não é persistido no anúncio.",
          },
          {
            key: "pinbank",
            label: "Cobranças das BIAs",
            provider: "PINBANK",
            billing_model: "Boleto, split e link",
            tracking: "operational",
            confirmed_amount: sumAmounts(paidBankRows),
            pending_amount: sumAmounts(pendingBankRows),
            paid_count: paidBankRows.length,
            pending_count: pendingBankRows.length,
            active_count: periodBankRows.length,
            note: "Valores operacionais das BIAs; não compõem a receita da plataforma.",
          },
          {
            key: "recurring",
            label: "Assinaturas recorrentes",
            provider: null,
            billing_model: "Recorrencia",
            tracking: "not_configured",
            confirmed_amount: null,
            pending_amount: null,
            paid_count: 0,
            pending_count: 0,
            active_count: 0,
            note: "Ainda não existe cobrança recorrente integrada ou persistida na plataforma.",
          },
        ],
        memberships: membershipRows.filter((row) => row.paid || row.pending).slice(0, 100),
        ads: adsRows.slice(0, 100),
        transactions,
      });
    } catch (error: any) {
      console.error("[admin/monetization]", error?.message || error);
      res.status(500).json({ error: error.message });
    }
  });

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

  // GET /api/users/by-email?email=xxx â€” find unlinked user by email (admin only, for linking)
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
      if (!user) return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado" });
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
      if (existing) return res.status(409).json({ error: "Username jÃ¡ existe" });

      if (parsed.email) {
        const existingEmail = await storage.getUserByEmail(parsed.email);
        if (existingEmail) return res.status(409).json({ error: "E-mail jÃ¡ cadastrado em outra conta. Use um e-mail diferente ou edite a conta existente." });
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

  // â”€â”€ NÃºcleo TÃ©cnico Documentos (PostgreSQL local) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function findNucleoTecnicoDoc(id: string) {
    try {
      const [row] = await db.select().from(nucleoTecnicoDocs).where(eq(nucleoTecnicoDocs.id, id)).limit(1);
      if (row) return row;
    } catch {}
    return [...nucleoTecnicoDocsFallback, ...listFallbackDocuments("tecnico")]
      .find((item: any) => String(item.id) === String(id)) || null;
  }

  const aliancaDocumentAccessKey = (modulo: unknown): BiaAccessKey | null => {
    const keys: Record<string, BiaAccessKey> = {
      obra: "documentos_obra",
      comercial: "documentos_comercial",
      capital: "documentos_capital",
    };
    return keys[String(modulo || "")] || null;
  };

  async function findAliancaDoc(id: string) {
    try {
      const [row] = await db.select().from(aliancaDocs).where(eq(aliancaDocs.id, id)).limit(1);
      if (row) return row;
    } catch {}
    return listFallbackDocuments("alianca").find((item: any) => String(item.id) === String(id)) || null;
  }

  app.get("/api/nucleo-tecnico-docs", async (req, res) => {
    try {
      const biaId = String(req.query.bia_id || "");
      if (!biaId) return res.status(400).json({ error: "bia_id e obrigatorio" });
      if (!await requireBiaModuleAccess(req, res, biaId, "documentos_tecnico", "view")) return;
      let rows: any[] = [];
      try {
        rows = await db.select().from(nucleoTecnicoDocs).orderBy(desc(nucleoTecnicoDocs.created_at));
      } catch (error: any) {
        console.warn("[nucleo-tecnico-docs] usando fallback temporario:", error?.message || error);
      }
      const persistedFallback = listFallbackDocuments("tecnico");
      const fallbackRows = [...nucleoTecnicoDocsFallback, ...persistedFallback].filter(
        (item: any, index, items) => items.findIndex((current: any) => String(current.id) === String(item.id)) === index,
      );
      const fallbackIds = new Set(fallbackRows.map((item: any) => item.id));
      const mergedRows = [
        ...fallbackRows,
        ...rows.filter((item: any) => !fallbackIds.has(item.id)),
      ];
      const filtered = mergedRows.filter((r: any) => {
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
    const { arquivos, ...rest } = req.body;
    try {
      if (!rest.bia_id) return res.status(400).json({ error: "bia_id e obrigatorio" });
      if (!await requireBiaModuleAccess(req, res, String(rest.bia_id), "documentos_tecnico", "edit")) return;
      const [item] = await db.insert(nucleoTecnicoDocs).values(rest).returning();
      res.json(item);
    } catch (error: any) {
      const item = upsertFallbackDocument("tecnico", {
        ...rest,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      });
      console.warn("[nucleo-tecnico-docs] documento salvo no fallback local:", error?.message || error);
      res.json({ ...item, fallback: true });
    }
  });

  app.patch("/api/nucleo-tecnico-docs/:id", async (req, res) => {
    const { arquivos, ...rest } = req.body;
    const existing = await findNucleoTecnicoDoc(req.params.id);
    if (!existing) return res.status(404).json({ error: "Documento não encontrado." });
    if (!await requireBiaModuleAccess(req, res, String(existing.bia_id), "documentos_tecnico", "edit")) return;
    let databaseError: any = null;
    try {
      const [item] = await db.update(nucleoTecnicoDocs).set(rest).where(eq(nucleoTecnicoDocs.id, req.params.id)).returning();
      if (item) return res.json(item);
    } catch (error: any) {
      databaseError = error;
    }
    const current = listFallbackDocuments("tecnico").find((item: any) => String(item.id) === String(req.params.id));
    if (current) return res.json(upsertFallbackDocument("tecnico", { ...current, ...rest, id: current.id }));
    if (databaseError) return res.status(503).json({ error: "Banco de documentos indisponível no momento." });
    return res.status(404).json({ error: "Documento não encontrado." });
  });

  app.delete("/api/nucleo-tecnico-docs/:id", async (req, res) => {
    const existing = await findNucleoTecnicoDoc(req.params.id);
    if (!existing) return res.status(404).json({ error: "Documento não encontrado." });
    if (!await requireBiaModuleAccess(req, res, String(existing.bia_id), "documentos_tecnico", "edit")) return;
    let databaseAvailable = true;
    let databaseDeleted = false;
    try {
      const deleted = await db.delete(nucleoTecnicoDocs).where(eq(nucleoTecnicoDocs.id, req.params.id)).returning({ id: nucleoTecnicoDocs.id });
      databaseDeleted = deleted.length > 0;
    } catch {
      databaseAvailable = false;
    }
    const fallbackDeleted = deleteFallbackDocument("tecnico", req.params.id);
    const memoryIndex = nucleoTecnicoDocsFallback.findIndex((item: any) => String(item.id) === String(req.params.id));
    if (memoryIndex >= 0) nucleoTecnicoDocsFallback.splice(memoryIndex, 1);
    if (databaseDeleted || fallbackDeleted || memoryIndex >= 0) return res.json({ success: true });
    if (!databaseAvailable) return res.status(503).json({ error: "Banco de documentos indisponível no momento." });
    return res.status(404).json({ error: "Documento não encontrado." });
  });

  // â”€â”€ Directus Asset Proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/assets/:id", async (req, res) => {
    return proxyDirectusAsset(req, res);
  });

  // â”€â”€ AlianÃ§a Docs (Obra / Comercial / Capital) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/alianca-docs", async (req, res) => {
    try {
      const biaId = String(req.query.bia_id || "");
      const accessKey = aliancaDocumentAccessKey(req.query.modulo);
      if (!biaId || !accessKey) return res.status(400).json({ error: "bia_id e modulo sao obrigatorios" });
      if (!await requireBiaModuleAccess(req, res, biaId, accessKey, "view")) return;
      let rows: any[] = [];
      try {
        rows = await db.select().from(aliancaDocs).orderBy(desc(aliancaDocs.created_at));
      } catch (error: any) {
        console.warn("[alianca-docs] usando fallback local:", error?.message || error);
      }
      const fallbackRows = listFallbackDocuments("alianca");
      const fallbackIds = new Set(fallbackRows.map((item: any) => String(item.id)));
      const mergedRows = [...fallbackRows, ...rows.filter((item: any) => !fallbackIds.has(String(item.id)))];
      const filtered = mergedRows.filter((r: any) => {
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
    const { arquivos, ...rest } = req.body;
    try {
      const accessKey = aliancaDocumentAccessKey(rest.modulo);
      if (!rest.bia_id || !accessKey) return res.status(400).json({ error: "bia_id e modulo sao obrigatorios" });
      if (!await requireBiaModuleAccess(req, res, String(rest.bia_id), accessKey, "edit")) return;
      const [item] = await db.insert(aliancaDocs).values(rest).returning();
      res.json(item);
    } catch (error: any) {
      const item = upsertFallbackDocument("alianca", {
        ...rest,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      });
      console.warn("[alianca-docs] documento salvo no fallback local:", error?.message || error);
      res.json({ ...item, fallback: true });
    }
  });

  app.patch("/api/alianca-docs/:id", async (req, res) => {
    const { arquivos, ...rest } = req.body;
    const existing = await findAliancaDoc(req.params.id);
    if (!existing) return res.status(404).json({ error: "Documento não encontrado." });
    const accessKey = aliancaDocumentAccessKey(existing.modulo);
    if (!accessKey || !await requireBiaModuleAccess(req, res, String(existing.bia_id), accessKey, "edit")) return;
    let databaseError: any = null;
    try {
      const [item] = await db.update(aliancaDocs).set(rest).where(eq(aliancaDocs.id, req.params.id)).returning();
      if (item) return res.json(item);
    } catch (error: any) {
      databaseError = error;
    }
    const current = listFallbackDocuments("alianca").find((item: any) => String(item.id) === String(req.params.id));
    if (current) return res.json(upsertFallbackDocument("alianca", { ...current, ...rest, id: current.id }));
    if (databaseError) return res.status(503).json({ error: "Banco de documentos indisponível no momento." });
    return res.status(404).json({ error: "Documento não encontrado." });
  });

  app.delete("/api/alianca-docs/:id", async (req, res) => {
    const existing = await findAliancaDoc(req.params.id);
    if (!existing) return res.status(404).json({ error: "Documento não encontrado." });
    const accessKey = aliancaDocumentAccessKey(existing.modulo);
    if (!accessKey || !await requireBiaModuleAccess(req, res, String(existing.bia_id), accessKey, "edit")) return;
    let databaseAvailable = true;
    let databaseDeleted = false;
    try {
      const deleted = await db.delete(aliancaDocs).where(eq(aliancaDocs.id, req.params.id)).returning({ id: aliancaDocs.id });
      databaseDeleted = deleted.length > 0;
    } catch {
      databaseAvailable = false;
    }
    const fallbackDeleted = deleteFallbackDocument("alianca", req.params.id);
    if (databaseDeleted || fallbackDeleted) return res.json({ success: true });
    if (!databaseAvailable) return res.status(503).json({ error: "Banco de documentos indisponível no momento." });
    return res.status(404).json({ error: "Documento não encontrado." });
  });

  // â”€â”€ Estudos de Viabilidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      if (!req.params.id || req.params.id === "undefined" || req.params.id === "null") {
        return res.status(400).json({ error: "Conta de acesso nÃ£o encontrada para este membro." });
      }
      const parsed = updateUserSchema.parse(req.body);
      // Strip undefined values â€” only include explicitly provided fields
      const updateData: any = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v !== undefined)
      );
      if (parsed.email === "") updateData.email = null;
      if (parsed.membro_directus_id === "") updateData.membro_directus_id = null;
      if (parsed.password === "") delete updateData.password;

      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado" });
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
      if (!ok) return res.status(404).json({ error: "UsuÃ¡rio nÃ£o encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TRANSFERÃŠNCIA DE COTAS ==========
  await db.execute(sql`ALTER TABLE transferencias_cotas ADD COLUMN IF NOT EXISTS anexos text[] DEFAULT '{}'::text[]`)
    .catch((err: any) => {
      console.warn(`[transferencias_cotas] Campo anexos nao sincronizado: ${err.message}`);
    });

  app.get("/api/transferencia-cotas", async (req, res) => {
    try {
      const directusUserId = (req.session as any).directusUserId;
      if (!directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const biaId = req.query.bia_id as string;
      if (!biaId) return res.status(400).json({ error: "bia_id Ã© obrigatÃ³rio" });
      if (!await requireBiaModuleAccess(req, res, biaId, "capital_financeiro", "view")) return;
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
      if (!sessionDirectusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
      const { bia_id, membro_origem_id, membro_destino_id, valor_total, percentual_transferencia, observacoes, anexos } = req.body;
      if (!bia_id || !membro_origem_id || !membro_destino_id) {
        return res.status(400).json({ error: "Campos obrigatÃ³rios: bia_id, membro_origem_id, membro_destino_id" });
      }
      if (!await requireBiaModuleAccess(req, res, String(bia_id), "capital_financeiro", "edit")) return;
      const observacao = typeof observacoes === "string" ? observacoes.trim() : "";
      if (!observacao) {
        return res.status(400).json({ error: "ObservaÃ§Ã£o Ã© obrigatÃ³ria" });
      }
      const safeAnexos = Array.isArray(anexos)
        ? anexos.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      // Fetch the BIA to check roles
      const bia = await directusFetchOne("bias_projetos", bia_id, "fields=diretor_alianca,aliado_built");
      const biaDiretorAlianca = bia?.diretor_alianca as string | null | undefined;
      const biaAliadoBuilt = bia?.aliado_built as string | null | undefined;
      const isOrigem = sessionMembroId && sessionMembroId === membro_origem_id;
      const isDiretorAlianca = sessionMembroId && biaDiretorAlianca && sessionMembroId === biaDiretorAlianca;
      const isAliadoBuilt = sessionMembroId && biaAliadoBuilt && sessionMembroId === biaAliadoBuilt;
      // Origem, diretor_alianca, aliado_built e admin podem solicitar transferÃªncia de qualquer cota
      if (sessionRole !== "admin" && !isOrigem && !isDiretorAlianca && !isAliadoBuilt) {
        return res.status(403).json({ error: "VocÃª nÃ£o tem permissÃ£o para solicitar esta transferÃªncia" });
      }
      if (membro_origem_id === membro_destino_id) {
        return res.status(400).json({ error: "Origem e destino nÃ£o podem ser o mesmo membro" });
      }
      const item = await storage.createTransferenciaCotas({
        bia_id,
        membro_origem_id,
        membro_destino_id,
        valor_total: valor_total != null ? String(valor_total) : null,
        percentual_transferencia: percentual_transferencia != null ? String(percentual_transferencia) : null,
        status: "pendente",
        solicitado_por: sessionDirectusUserId,
        observacoes: observacao,
        anexos: safeAnexos,
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
      if (!sessionDirectusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });

      const { action, motivo_rejeicao, membro_destino_id, valor_total, percentual_transferencia, observacoes, anexos } = req.body;
      if (!action || !["aceitar", "rejeitar", "editar"].includes(action)) {
        return res.status(400).json({ error: "action deve ser 'aceitar', 'rejeitar' ou 'editar'" });
      }

      const transfer = await storage.getTransferenciaCotas(req.params.id);
      if (!transfer) return res.status(404).json({ error: "SolicitaÃ§Ã£o nÃ£o encontrada" });
      if (!transfer.bia_id || !await requireBiaModuleAccess(req, res, String(transfer.bia_id), "capital_financeiro", "edit")) return;
      if (transfer.status !== "pendente") {
        return res.status(400).json({ error: "SolicitaÃ§Ã£o jÃ¡ foi processada" });
      }

      // Fetch the BIA to get diretor_alianca and aliado_built
      const bia = await directusFetchOne("bias_projetos", transfer.bia_id!, "fields=diretor_alianca,aliado_built");
      const biaDiretorAlianca = bia?.diretor_alianca as string | null | undefined;
      const biaAliadoBuilt = bia?.aliado_built as string | null | undefined;

      if (action === "editar") {
        const canEdit =
          sessionRole === "admin" ||
          (sessionMembroId && sessionMembroId === transfer.membro_origem_id) ||
          sessionDirectusUserId === transfer.solicitado_por;
        if (!canEdit) {
          return res.status(403).json({ error: "Sem permissÃ£o para editar esta solicitaÃ§Ã£o" });
        }
        const destino = membro_destino_id || transfer.membro_destino_id;
        if (!destino) {
          return res.status(400).json({ error: "Membro destinatÃ¡rio Ã© obrigatÃ³rio" });
        }
        if (transfer.membro_origem_id === destino) {
          return res.status(400).json({ error: "Origem e destino nÃ£o podem ser o mesmo membro" });
        }
        const observacao = typeof observacoes === "string" ? observacoes.trim() : "";
        if (!observacao) {
          return res.status(400).json({ error: "ObservaÃ§Ã£o Ã© obrigatÃ³ria" });
        }
        const safeAnexos = Array.isArray(anexos)
          ? anexos.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
          : [];
        const updated = await storage.updateTransferenciaCotas(req.params.id, {
          membro_destino_id: destino,
          valor_total: valor_total != null ? String(valor_total) : transfer.valor_total,
          percentual_transferencia: percentual_transferencia != null ? String(percentual_transferencia) : transfer.percentual_transferencia,
          observacoes: observacao,
          anexos: safeAnexos,
        });
        return res.json(updated);
      }

      // Membro de origem cannot accept/reject their own transfer request
      if (sessionMembroId && sessionMembroId === transfer.membro_origem_id) {
        return res.status(403).json({ error: "O membro de origem nÃ£o pode aceitar ou rejeitar a prÃ³pria solicitaÃ§Ã£o" });
      }
      // Only diretor_alianca, aliado_built, or admin can approve/reject
      const canProcess =
        sessionRole === "admin" ||
        (sessionMembroId && biaDiretorAlianca && sessionMembroId === biaDiretorAlianca) ||
        (sessionMembroId && biaAliadoBuilt && sessionMembroId === biaAliadoBuilt);
      if (!canProcess) {
        return res.status(403).json({ error: "Sem permissÃ£o para processar esta solicitaÃ§Ã£o" });
      }

      if (action === "rejeitar") {
        const updated = await storage.updateTransferenciaCotas(req.params.id, {
          status: "rejeitada",
          motivo_rejeicao: motivo_rejeicao || null,
        });
        return res.json(updated);
      }

      // action === "aceitar": a transferÃªncia Ã© parcial e deve ser aplicada no MAP,
      // sem alterar os lanÃ§amentos financeiros originais do Directus.
      const updated = await storage.updateTransferenciaCotas(req.params.id, {
        status: "aceita",
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== COMUNIDADES ==========
  // Explicit fields list â€” excludes legacy aliado_id/membros_ids/bias_ids; expands M2O (aliado) and M2M (membros, bias)
  const COMUNIDADE_FIELDS =
    "fields=id,nome,sigla,pais,sigla_pais,territorio,sigla_territorio,codigo_sequencial,status,date_created," +
    "aliado.id,aliado.nome,aliado.email,aliado.foto_perfil,aliado.cargo,aliado.empresa,aliado.tipo_de_cadastro,aliado.tipo_alianca,aliado.tipos_alianca,aliado.nucleo_alianca,aliado.nucleos_alianca,aliado.Outras_redes_as_quais_pertenco,aliado.em_built_capital,aliado.na_vitrine," +
    "membros.cadastro_geral_id.id,membros.cadastro_geral_id.nome,membros.cadastro_geral_id.email,membros.cadastro_geral_id.foto_perfil,membros.cadastro_geral_id.cargo,membros.cadastro_geral_id.empresa,membros.cadastro_geral_id.tipo_de_cadastro,membros.cadastro_geral_id.tipo_alianca,membros.cadastro_geral_id.tipos_alianca,membros.cadastro_geral_id.nucleo_alianca,membros.cadastro_geral_id.nucleos_alianca,membros.cadastro_geral_id.Outras_redes_as_quais_pertenco,membros.cadastro_geral_id.em_built_capital,membros.cadastro_geral_id.na_vitrine," +
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const col = await getComunidadeCol();
      const all: any[] = await directusFetch(col, COMUNIDADE_FIELDS);
      const membroId = req.query.membro_id as string | undefined;

      let items = all;
      if (membroId) {
        const storedComunidadeMae = await getStoredMembroComunidadeMae(membroId);
        const comunidadeMaeId = storedComunidadeMae?.comunidade_id ? String(storedComunidadeMae.comunidade_id) : null;
        items = all.filter((c: any) => {
          if (comunidadeMaeId && String(c.id) === comunidadeMaeId) return true;
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
        if (comunidadeMaeId) {
          const membrosMae = await getMembroIdsDaComunidadeMae(comunidadeMaeId);
          items = items.map((comunidade: any) => {
            if (String(comunidade?.id) !== comunidadeMaeId) return comunidade;
            const membrosExistentes = Array.isArray(comunidade.membros) ? comunidade.membros : [];
            const idsExistentes = new Set(
              membrosExistentes
                .map((m: any) => directusRelationId(m?.cadastro_geral_id))
                .filter(Boolean)
                .map(String)
            );
            const membrosLocais = membrosMae
              .filter((id) => !idsExistentes.has(String(id)))
              .map((id) => ({ cadastro_geral_id: { id } }));
            return { ...comunidade, membros: [...membrosExistentes, ...membrosLocais] };
          });
        }
      }

      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comunidades/proximo-codigo", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const col = await getComunidadeCol();
      const url = `${DIRECTUS_URL}/items/${col}/${req.params.id}?${COMUNIDADE_FIELDS}`;
      const r = await fetch(url, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
      if (!r.ok) return res.status(404).json({ error: "NÃ£o encontrado" });
      const d = await r.json();
      const comunidade = d.data;
      const relationId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === "object") return value.id ? String(value.id) : null;
        return String(value);
      };
      const normalize = (value: any) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const biasIds = new Set(
        (Array.isArray(comunidade.bias) ? comunidade.bias : [])
          .map((item: any) => relationId(item?.bias_projetos_id))
          .filter(Boolean)
      );
      const opas = biasIds.size > 0
        ? await directusFetch("tipos_oportunidades", "fields=id,bia,tipo,nucleo_alianca,objetivo_alianca,localizacao,pais,status").catch(() => [])
        : [];
      const opasComunidade = (opas as any[]).filter((opa: any) => {
        const biaId = relationId(opa.bia) || relationId(opa.bia_id);
        return !!biaId && biasIds.has(biaId);
      });
      const classifyAbrangencia = (opa: any) => {
        const text = normalize([opa.tipo, opa.nucleo_alianca, opa.objetivo_alianca, opa.localizacao, opa.pais].join(" "));
        if (/(global|internacional|exterior|fora do brasil|outside brazil)/.test(text)) return "Global";
        if (/(nacional|brasil|brazil)/.test(text)) return "Nacional";
        return "Regional";
      };
      const opasPorAbrangencia = ["Regional", "Nacional", "Global"].map((name) => ({
        name,
        value: opasComunidade.filter((opa: any) => classifyAbrangencia(opa) === name).length,
      }));
      const membros = (Array.isArray(comunidade.membros) ? comunidade.membros : [])
        .map((item: any) => item?.cadastro_geral_id)
        .filter((item: any) => item && typeof item === "object");
      const memberText = (membro: any) => normalize([
        membro.tipo_de_cadastro,
        membro.tipo_alianca,
        ...(Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : []),
        membro.nucleo_alianca,
        ...(Array.isArray(membro.nucleos_alianca) ? membro.nucleos_alianca : []),
        ...(Array.isArray(membro.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : []),
      ].join(" "));
      const isCapital = (membro: any) => membro.em_built_capital === true || memberText(membro).includes("capital");
      const isAreaAliancas = (membro: any) => /(alianca|lideranca|diretoria|built)/.test(memberText(membro));
      const isMercado = (membro: any) => !isCapital(membro) && !isAreaAliancas(membro);
      const analytics = {
        opas_total: opasComunidade.length,
        opas_por_abrangencia: opasPorAbrangencia,
        composicao: {
          parceiros_mercado: membros.filter(isMercado).length,
          area_aliancas: membros.filter(isAreaAliancas).length,
          parceiros_capital: membros.filter(isCapital).length,
        },
      };
      res.json({ ...comunidade, analytics });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comunidades", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
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
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const col = await getComunidadeCol();
      const updated = await directusUpdate(col, req.params.id, toComunidadePayload(req.body));
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comunidades/:id", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const col = await getComunidadeCol();
      await directusUpdate(col, req.params.id, {
        aliado: null,
        membros: [],
        bias: [],
      }).catch((clearError: any) => {
        console.warn(`[comunidades DELETE ${req.params.id}] Nao foi possivel limpar vinculos antes de remover:`, clearError?.message || clearError);
      });
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
    notificarInvitadorAvaliarAura,
    notificarAliadoAposAuraInvitador,
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

  async function findMemberCommunityForAdesao(membroId: string) {
    const col = await getComunidadeCol();
    const fields = "id,nome,pais,territorio,aliado.id,aliado.nome,aliado.email,membros.cadastro_geral_id";
    const byMemberUrl = `${DIRECTUS_URL}/items/${col}?fields=${fields}&filter[membros][cadastro_geral_id][_eq]=${encodeURIComponent(membroId)}&limit=1`;
    const memberRes = await fetch(byMemberUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
    if (memberRes.ok) {
      const data = await memberRes.json();
      if (data.data?.[0]) return data.data[0];
    }

    const byAliadoUrl = `${DIRECTUS_URL}/items/${col}?fields=${fields}&filter[aliado][_eq]=${encodeURIComponent(membroId)}&limit=1`;
    const aliadoRes = await fetch(byAliadoUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
    if (aliadoRes.ok) {
      const data = await aliadoRes.json();
      if (data.data?.[0]) return data.data[0];
    }

    return null;
  }

  function getPublicAppBaseUrl(): string {
    const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://app.builtalliances.com");
    return rawDomain.replace(/\/$/, "");
  }

  function isBrazilPaymentContext(value?: string | null): boolean {
    const normalized = String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return normalized === "br" || normalized === "brasil" || normalized === "brazil";
  }

  function buildAsaasAdesaoCheckoutUrl(token: string): string {
    const url = new URL("https://www.asaas.com/c/og75ioogsdf4khkj");
    url.searchParams.set("externalReference", token);
    return url.toString();
  }

  async function createAsaasAdesaoPaymentLinkUrl(convite: any, comunidade: any): Promise<string> {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) return buildAsaasAdesaoCheckoutUrl(convite.token);

    const baseUrl = (process.env.ASAAS_API_URL || "https://api.asaas.com/v3").replace(/\/$/, "");
    const appUrl = getPublicAppBaseUrl();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);

    const response = await fetch(`${baseUrl}/paymentLinks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
      },
      body: JSON.stringify({
        name: "Adesao BUILT Alliances",
        description: `Adesao a ${comunidade?.nome || "BUILT Alliances"}`,
        endDate: endDate.toISOString().slice(0, 10),
        value: 3197,
        billingType: "UNDEFINED",
        chargeType: "DETACHED",
        externalReference: convite.token,
        notificationEnabled: true,
        callback: {
          successUrl: `${appUrl}/pagamento/${convite.token}?payment_success=true`,
          autoRedirect: true,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[asaas/adesao] payment link creation failed:", response.status, text);
      return buildAsaasAdesaoCheckoutUrl(convite.token);
    }

    const paymentLink = await response.json();
    return paymentLink.url || paymentLink.invoiceUrl || buildAsaasAdesaoCheckoutUrl(convite.token);
  }

  async function createStripeAdesaoCheckoutUrl(convite: any): Promise<string> {
    const stripe = getStripeClient();
    const baseUrl = getPublicAppBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: 319700,
            product_data: {
              name: "Taxa de AdesÃ£o BUILT Alliances",
              description: `AdesÃ£o Ã  comunidade ${convite.candidato_nome ? "- " + convite.candidato_nome : ""}`.trim(),
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
      success_url: `${baseUrl}/pagamento/${convite.token}?payment_success=true`,
      cancel_url: `${baseUrl}/pagamento/${convite.token}`,
    });

    if (!session.url) throw new Error("Erro ao obter link de pagamento. Tente novamente.");
    return session.url;
  }

  async function buildAdesaoCheckout(convite: any, comunidade: any) {
    const pais = comunidade?.pais || comunidade?.territorio || "";
    if (isBrazilPaymentContext(pais) || !pais) {
      return {
        provider: "asaas",
        checkout_url: await createAsaasAdesaoPaymentLinkUrl(convite, comunidade),
      };
    }

    return {
      provider: "stripe",
      checkout_url: await createStripeAdesaoCheckoutUrl(convite),
    };
  }

  // POST /api/opa/solicitar-adesao â€” non-members request the Proud Member flow from an OBA
  app.post("/api/opa/solicitar-adesao", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const membroId = (req.session as any).membroId as string | undefined;
      if (!membroId) return res.status(400).json({ error: "Seu perfil ainda nÃ£o estÃ¡ vinculado ao cadastro de membro." });

      if (await canAccessProtectedOpaActions(req)) {
        return res.json({ alreadyMember: true });
      }

      const candidato = await getDirectusMembro(membroId);
      const candidatoEmail = candidato?.email || (req.session as any).email;
      const candidatoNome = candidato?.nome || (req.session as any).nome || "Membro BUILT";
      if (!candidatoEmail) {
        return res.status(400).json({ error: "Seu cadastro nÃ£o possui e-mail para receber o convite de adesÃ£o." });
      }

      const allConvites = await storage.getConvitesByCandidatoMembro(membroId);
      const existingAdesao = allConvites.find((c) => {
        if (c.tipo !== "associacao_completa") return false;
        return !["rejeitado", "expirado", "membro", "cancelado"].includes(c.status);
      });

      let comunidade: any = null;
      if (existingAdesao?.comunidade_id) {
        const col = await getComunidadeCol();
        const cr = await fetch(`${DIRECTUS_URL}/items/${col}/${existingAdesao.comunidade_id}?fields=id,nome,pais,territorio,aliado.id,aliado.nome,aliado.email,membros.cadastro_geral_id`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        });
        comunidade = cr.ok ? (await cr.json()).data : null;
      }
      if (!comunidade) comunidade = await findMemberCommunityForAdesao(membroId);

      if (!comunidade?.id) {
        return res.status(400).json({
          error: "VocÃª precisa estar associado a uma comunidade para iniciar a adesÃ£o. Use o convite recebido originalmente ou fale com quem te convidou.",
        });
      }

      const origemConvite = allConvites.find((c) => c.invitador_membro_id) || null;
      const aliadoId = typeof comunidade.aliado === "object" && comunidade.aliado !== null
        ? comunidade.aliado.id
        : comunidade.aliado;
      const invitadorId = existingAdesao?.invitador_membro_id || origemConvite?.invitador_membro_id || aliadoId || null;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      let convite = existingAdesao || null;
      if (convite) {
        convite = await storage.updateConvite(convite.id, { status: "pagamento_pendente", expires_at: expiresAt }) || convite;
      } else {
        convite = await storage.createConvite({
          comunidade_id: comunidade.id,
          candidato_membro_id: membroId,
          candidato_nome: candidatoNome,
          candidato_email: candidatoEmail,
          invitador_membro_id: invitadorId,
          status: "pagamento_pendente",
          tipo: "associacao_completa",
          dados_contratuais: null,
          expires_at: expiresAt,
        });
      }

      const checkout = await buildAdesaoCheckout(convite, comunidade);
      const emailResult = await enviarPagamento({
        candidatoEmail,
        candidatoNome,
        comunidadeNome: comunidade.nome || "Comunidade BUILT",
        token: convite.token,
        valor: "R$ 3.197,00",
      }).catch((emailErr: any) => {
        console.error("[adesao/pagamento] email send failed (non-fatal):", emailErr?.message || emailErr);
        return { ok: false, error: emailErr?.message || "erro desconhecido" };
      });
      if (!emailResult?.ok) {
        console.error("[adesao/pagamento] payment email not sent (non-fatal):", emailResult?.error || "erro desconhecido");
      }

      const rawDomain = getPublicAppBaseUrl();
      res.json({
        token: convite.token,
        status: convite.status,
        comunidade_id: convite.comunidade_id,
        comunidade_nome: comunidade.nome || null,
        emailed: Boolean(emailResult?.ok),
        provider: checkout.provider,
        checkout_url: checkout.checkout_url,
        return_url: `${rawDomain}/pagamento/${convite.token}`,
        link: `${rawDomain}/pagamento/${convite.token}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/convites â€” create invite (authenticated, community aliado or admin)
  app.post("/api/convites", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const { comunidade_id, candidato_membro_id } = req.body;
      if (!comunidade_id || !candidato_membro_id) return res.status(400).json({ error: "Campos obrigatÃ³rios: comunidade_id, candidato_membro_id" });

      const invitadorId = (req.session as any).membroId;

      // Get candidato info from Directus
      const candidato = await getDirectusMembro(candidato_membro_id);
      if (!candidato) return res.status(404).json({ error: "Membro candidato nÃ£o encontrado" });
      if (!candidato.email) {
        return res.status(400).json({ error: "Este membro nÃ£o possui e-mail cadastrado. Atualize o cadastro antes de enviar o convite." });
      }

      // Get comunidade info (including membros so isCommunityMember can check membership)
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email,membros.cadastro_geral_id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!cr.ok) return res.status(404).json({ error: "Comunidade nÃ£o encontrada" });
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

      const emailResult = await enviarConvite({
        candidatoEmail: candidato.email,
        candidatoNome: candidato.nome || "Candidato",
        comunidadeNome: comunidade.nome || "Comunidade BUILT",
        invitadorNome: invitadorMembro?.nome || "Membro BUILT",
        token: convite.token,
      });
      if (!emailResult?.ok) {
        return res.status(502).json({
          error: `Convite criado, mas o e-mail nÃ£o foi aceito pelo SMTP/Brevo: ${emailResult?.error || "erro desconhecido"}`,
          convite,
        });
      }

      res.json({ ...convite, email_enviado: true, email_message_id: emailResult.messageId || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convites â€” list (by comunidade_id or candidato) (authenticated)
  app.get("/api/convites", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const { comunidade_id, candidato_membro_id, invitador_membro_id, tipo } = req.query as any;
      let items;
      const enrichConviteCandidato = async (convite: any) => {
        if (!convite?.candidato_membro_id) return convite;
        const membro = await directusFetchOne(
          "cadastro_geral",
          String(convite.candidato_membro_id),
          "fields=id,nome,email,telefone,whatsapp,cpf,cnpj,empresa,cargo,cidade,estado,pais"
        ).catch(() => null);
        if (!membro) return convite;
        const dados = convite.dados_contratuais && typeof convite.dados_contratuais === "object"
          ? convite.dados_contratuais
          : {};
        return {
          ...convite,
          dados_contratuais: {
            ...dados,
            nome_completo: dados.nome_completo || membro.nome || convite.candidato_nome,
            email: dados.email || membro.email || convite.candidato_email,
            telefone: dados.telefone || membro.telefone || membro.whatsapp || null,
            whatsapp: dados.whatsapp || membro.whatsapp || null,
            cpf: dados.cpf || membro.cpf || null,
            cnpj: dados.cnpj || membro.cnpj || null,
            nome_empresa: dados.nome_empresa || membro.empresa || null,
            empresa: dados.empresa || membro.empresa || null,
            cargo: dados.cargo || membro.cargo || null,
            cidade: dados.cidade || membro.cidade || null,
            estado: dados.estado || membro.estado || null,
            pais: dados.pais || membro.pais || null,
          },
        };
      };
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
        items = await Promise.all(items.map(enrichConviteCandidato));
        // Filter by tipo if specified
        if (tipo) {
          items = items.filter((c: any) => c.tipo === tipo);
        }
      } else if (invitador_membro_id) {
        const sessionRole = (req.session as any).role || "user";
        const sessionMembroId = (req.session as any).membroId as string | null;
        if (sessionRole !== "admin" && sessionRole !== "manager" && String(sessionMembroId || "") !== String(invitador_membro_id)) {
          return res.status(403).json({ error: "NÃ£o autorizado a ver convites de outro conector" });
        }
        items = await storage.getConvitesByInvitador(String(invitador_membro_id));
        items = await Promise.all(items.map(enrichConviteCandidato));
        if (tipo) {
          items = items.filter((c: any) => c.tipo === tipo);
        }
      } else if (candidato_membro_id) {
        // Authorization: only the candidato themselves or admin can see their own invites
        const sessionRole = (req.session as any).role || "user";
        const sessionMembroId = (req.session as any).membroId as string | null;
        if (sessionRole !== "admin" && sessionRole !== "manager" && sessionMembroId !== candidato_membro_id) {
          return res.status(403).json({ error: "NÃ£o autorizado a ver convites de outro membro" });
        }
        // Return invites without dados_contratuais (PII) when querying own invites
        const raw = await storage.getConvitesByCandidato(candidato_membro_id);
        items = raw.map(({ dados_contratuais: _dc, ...rest }) => rest);
      } else {
        return res.status(400).json({ error: "Informe comunidade_id, candidato_membro_id ou invitador_membro_id" });
      }
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convites/:token â€” get convite (public)
  app.get("/api/convites/:token", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });

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

  // POST /api/convites/:token/candidatura â€” submit form (public)
  app.post("/api/convites/:token/candidatura", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["convidado"].includes(convite.status)) return res.status(400).json({ error: "Este convite nÃ£o estÃ¡ mais disponÃ­vel para candidatura" });
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

  // PATCH /api/convites/:token/decisao â€” approve/reject (authenticated, aliado/admin)
  app.patch("/api/convites/:token/decisao", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura nÃ£o estÃ¡ em anÃ¡lise" });

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

      const comunidadeNome = comunidade?.nome || "Comunidade BUILT";
      const isVitrine = ["vitrine", "capital"].includes(convite.tipo);

      let newStatus: string;
      let updated: any;

      if (decisao === "aprovado") {
        if (isVitrine) {
          // Vitrine/Capital: direct approval â†’ platform access
          newStatus = "vitrine_ativo";
          updated = await storage.updateConvite(convite.id, { status: newStatus });
          if (convite.candidato_membro_id) {
            const accessPatch: Record<string, any> = convite.tipo === "capital"
              ? {
                  na_vitrine: false,
                  em_built_capital: true,
                  em_membros_built: false,
                }
              : {
                  na_vitrine: true,
                  em_built_capital: false,
                  em_membros_built: false,
                };
            if (convite.tipo === "capital") {
              const candidatoData = await getDirectusMembro(convite.candidato_membro_id);
              const redesAtuais = Array.isArray(candidatoData?.Outras_redes_as_quais_pertenco)
                ? candidatoData.Outras_redes_as_quais_pertenco
                : [];
              accessPatch.Outras_redes_as_quais_pertenco = redesAtuais.includes("BUILT_CAPITAL_PARTNER")
                ? redesAtuais
                : [...redesAtuais, "BUILT_CAPITAL_PARTNER"];
            }
            await directusUpdate("cadastro_geral", convite.candidato_membro_id, accessPatch);
          }

          // Keep the local role aligned with the invite type without unlocking Alliances.
          const allUsers = await storage.getAllUsers();
          const candidatoUser = allUsers.find(u => u.membro_directus_id === convite.candidato_membro_id);
          if (candidatoUser) {
            await storage.updateUser(candidatoUser.id, { role: convite.tipo === "capital" ? "investidor" : "user" });
          }
          if (convite.candidato_email) {
            await enviarAprovacaoVitrine({
              candidatoEmail: convite.candidato_email,
              candidatoNome: convite.candidato_nome || "Candidato",
              comunidadeNome,
            });
          }
          // Also notify invitador
          if (convite.invitador_membro_id) {
            const invitador = await getDirectusMembro(convite.invitador_membro_id);
            if (invitador?.email) {
              const { enviarAprovacaoVitrineInvitador } = await import("./mailer");
              await enviarAprovacaoVitrineInvitador({
                invitadorEmail: invitador.email,
                invitadorNome: invitador.nome || "Membro BUILT",
                candidatoNome: convite.candidato_nome || "Candidato",
                comunidadeNome,
              });
            }
          }
        } else {
          // AssociaÃ§Ã£o Completa: terms + payment flow
          newStatus = "aprovado";
          const newExpiresAt = (() => { const d = new Date(); d.setHours(d.getHours() + 12); return d; })();
          updated = await storage.updateConvite(convite.id, { status: newStatus, expires_at: newExpiresAt });
          if (convite.candidato_email) {
            await enviarAprovacao({
              candidatoEmail: convite.candidato_email,
              candidatoNome: convite.candidato_nome || "Candidato",
              comunidadeNome,
              token: convite.token,
            });
          }
        }
      } else {
        // Rejection: email both candidate and invitador
        newStatus = "rejeitado";
        updated = await storage.updateConvite(convite.id, { status: newStatus });
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

  app.delete("/api/convites/:token", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "Não autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado" });

      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      if (!isCommunityManager(req, comunidade)) {
        return res.status(403).json({ error: "Apenas o Aliado BUILT da comunidade ou admin pode remover este alerta" });
      }

      const updated = await storage.updateConvite(convite.id, { status: "cancelado" });
      res.json({ success: true, convite: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/adesao â€” accept terms (public)
  app.patch("/api/convites/:token/adesao", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["aprovado", "termos_enviados"].includes(convite.status)) return res.status(400).json({ error: "Termos nÃ£o disponÃ­veis para aceite neste momento" });
      // Check expiration
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo para aceitar os termos expirou. Entre em contato com o Aliado da comunidade." });
      }

      // Give 24h for payment after accepting terms; move to explicit pagamento_pendente state
      const paymentExpiry = new Date();
      paymentExpiry.setHours(paymentExpiry.getHours() + 24);
      const now = new Date();
      const body = req.body || {};
      const acceptanceLocation = getCapturedAcceptanceLocation(body.aceite_localizacao);
      if (!acceptanceLocation) {
        return res.status(400).json({ error: ACCEPTANCE_LOCATION_REQUIRED_ERROR });
      }
      const currentDados = convite.dados_contratuais && typeof convite.dados_contratuais === "object"
        ? convite.dados_contratuais as Record<string, any>
        : {};
      const dadosContratuais = {
        ...currentDados,
        termos_aceitos: body.termos_aceitos && typeof body.termos_aceitos === "object" ? body.termos_aceitos : currentDados.termos_aceitos || {},
        termos_versoes: body.termos_versoes && typeof body.termos_versoes === "object" ? body.termos_versoes : currentDados.termos_versoes || {},
        aceito_em: body.aceito_em || now.toISOString(),
        aceite_localizacao: acceptanceLocation,
      };
      const updated = await storage.updateConvite(convite.id, {
        status: "pagamento_pendente",
        expires_at: paymentExpiry,
        termos_aceitos_em: now,
        dados_contratuais: dadosContratuais as any,
      });

      if (convite.candidato_membro_id) {
        await directusUpdate("cadastro_geral", convite.candidato_membro_id, {
          codigo_etica_aceito_em: now.toISOString(),
          codigo_etica_versao: dadosContratuais.termos_versoes?.codigo_etica || "BUILT JUR - 1",
          politicas_participacao_aceito_em: now.toISOString(),
          politicas_participacao_versao: dadosContratuais.termos_versoes?.politicas_participacao_protecao || "BUILT JUR - 1",
        }).catch((err: any) => console.warn("[adesao] Codigo de Etica nao atualizado no cadastro:", err?.message || err));
        for (const [key, accepted] of Object.entries(dadosContratuais.termos_aceitos || {})) {
          if (accepted) await recordTermAcceptanceAudit({
            membroId: convite.candidato_membro_id,
            termoChave: key,
            termoVersao: dadosContratuais.termos_versoes?.[key] || null,
            origem: TERMOS_ACEITE_BUILT[key]?.origem || null,
            aceitoEm: dadosContratuais.aceito_em,
            aceiteLocalizacao: dadosContratuais.aceite_localizacao,
          });
        }
      }

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

  // PATCH /api/convites/:token/aceitar-termos â€” candidate accepts terms (public, new flow)
  app.patch("/api/convites/:token/aceitar-termos", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (convite.status !== "termos_pendentes") return res.status(400).json({ error: "Termos nÃ£o disponÃ­veis para aceite neste momento" });

      const now = new Date();
      const body = req.body || {};
      const acceptanceLocation = getCapturedAcceptanceLocation(body.aceite_localizacao);
      if (!acceptanceLocation) {
        return res.status(400).json({ error: ACCEPTANCE_LOCATION_REQUIRED_ERROR });
      }
      const currentDados = convite.dados_contratuais && typeof convite.dados_contratuais === "object"
        ? convite.dados_contratuais as Record<string, any>
        : {};
      const dadosContratuais = {
        ...currentDados,
        termos_aceitos: body.termos_aceitos && typeof body.termos_aceitos === "object" ? body.termos_aceitos : currentDados.termos_aceitos || {},
        termos_versoes: body.termos_versoes && typeof body.termos_versoes === "object" ? body.termos_versoes : currentDados.termos_versoes || {},
        aceito_em: body.aceito_em || now.toISOString(),
        aceite_localizacao: acceptanceLocation,
      };
      const updated = await storage.updateConvite(convite.id, {
        status: "termos_aceitos",
        termos_aceitos_em: now,
        dados_contratuais: dadosContratuais as any,
      });

      if (convite.candidato_membro_id) {
        await directusUpdate("cadastro_geral", convite.candidato_membro_id, {
          codigo_etica_aceito_em: now.toISOString(),
          codigo_etica_versao: dadosContratuais.termos_versoes?.codigo_etica || "BUILT JUR - 1",
          politicas_participacao_aceito_em: now.toISOString(),
          politicas_participacao_versao: dadosContratuais.termos_versoes?.politicas_participacao_protecao || "BUILT JUR - 1",
        }).catch((err: any) => console.warn("[aceitar-termos] Codigo de Etica nao atualizado no cadastro:", err?.message || err));
        for (const [key, accepted] of Object.entries(dadosContratuais.termos_aceitos || {})) {
          if (accepted) await recordTermAcceptanceAudit({
            membroId: convite.candidato_membro_id,
            termoChave: key,
            termoVersao: dadosContratuais.termos_versoes?.[key] || null,
            origem: TERMOS_ACEITE_BUILT[key]?.origem || null,
            aceitoEm: dadosContratuais.aceito_em,
            aceiteLocalizacao: dadosContratuais.aceite_localizacao,
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/convites/:token/solicitar-acesso â€” candidate requests access after accepting terms (public, new flow)
  app.post("/api/convites/:token/solicitar-acesso", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (convite.status !== "termos_aceitos") return res.status(400).json({ error: "Aceite os termos antes de enviar a solicitaÃ§Ã£o" });

      // Generate a dedicated avaliacao_token so the invitador evaluation page is
      // NOT accessible via the candidate's convite token (security: separate auth)
      const { randomUUID } = await import("crypto");
      const avaliacaoToken = randomUUID();

      const updated = await storage.updateConvite(convite.id, {
        status: "aguardando_avaliacao_aura",
        solicitacao_acesso_em: new Date(),
        avaliacao_token: avaliacaoToken,
      } as any);

      // Get comunidade + invitador info to email the inviting member
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;

      if (convite.invitador_membro_id) {
        const invitador = await getDirectusMembro(convite.invitador_membro_id);
        if (invitador?.email) {
          await notificarInvitadorAvaliarAura({
            invitadorEmail: invitador.email,
            invitadorNome: invitador.nome || "Membro BUILT",
            candidatoNome: convite.candidato_nome || "Candidato",
            comunidadeNome: comunidade?.nome || "Comunidade BUILT",
            avaliacaoToken, // use the dedicated one-time token
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/avaliacao-aura/:avaliacaoToken â€” fetch convite by its dedicated avaliacao_token (public)
  app.get("/api/avaliacao-aura/:avaliacaoToken", async (req, res) => {
    try {
      const convite = await storage.getConviteByAvaliacaoToken(req.params.avaliacaoToken);
      if (!convite) return res.status(404).json({ error: "Link de avaliaÃ§Ã£o invÃ¡lido" });
      if (convite.status !== "aguardando_avaliacao_aura") {
        // Already evaluated or not ready: return status for UI to handle
        return res.json({ status: convite.status, candidato_nome: convite.candidato_nome, comunidade: null });
      }
      // Get comunidade info to display on the evaluation page
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;
      res.json({ status: convite.status, candidato_nome: convite.candidato_nome, candidato_email: convite.candidato_email, comunidade });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const validarAvaliacaoAuraPublica = async (avaliacaoToken: string) => {
    const convite = await storage.getConviteByAvaliacaoToken(avaliacaoToken);
    if (!convite) return { error: "Link de avaliaÃ§Ã£o invÃ¡lido", status: 404 as const };
    if (convite.status !== "aguardando_avaliacao_aura") {
      return { error: "AvaliaÃ§Ã£o de Aura nÃ£o estÃ¡ disponÃ­vel neste momento", status: 400 as const };
    }
    return { convite };
  };

  app.post("/api/avaliacao-aura/:avaliacaoToken/analisar-texto", async (req, res) => {
    try {
      const validacao = await validarAvaliacaoAuraPublica(req.params.avaliacaoToken);
      if ("error" in validacao) return res.status(validacao.status).json({ error: validacao.error });
      const { texto, membro_nome } = req.body;
      if (!texto || typeof texto !== "string" || texto.trim().length < 10) {
        return res.status(400).json({ error: "Texto muito curto. Descreva a pessoa com pelo menos 10 caracteres." });
      }
      const { PALAVRAS_SUGERIDAS: lexico } = await import("./aura-lexico.js");
      const normalizeAuraText = (value: string) =>
        value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const lexicoPorNormalizado = new Map(lexico.map((palavra) => [normalizeAuraText(palavra), palavra]));
      const resolvePalavraLexico = (palavra: string) => lexicoPorNormalizado.get(normalizeAuraText(palavra));
      const pushPalavra = (lista: string[], palavra: string) => {
        const resolvida = resolvePalavraLexico(palavra);
        if (resolvida && !lista.includes(resolvida) && lista.length < 3) lista.push(resolvida);
      };
      const textoNormalizado = normalizeAuraText(texto);
      const inferirPalavrasPorTexto = () => {
        const palavras: string[] = [];
        const regras: Array<{ palavra: string; pistas: string[] }> = [
          { palavra: "LEALDADE", pistas: ["leal", "fiel", "lealdade", "veste a camisa", "vestir a camisa", "parceira leal", "parceiro leal"] },
          { palavra: "COMPROMETIMENTO", pistas: ["comprometida", "comprometido", "trabalhadora", "trabalhador", "dedicada", "dedicado", "entrega", "veste a camisa", "vestir a camisa"] },
          { palavra: "ATENCIOSO", pistas: ["atenciosa", "atencioso", "atencao", "cuidadosa", "cuidadoso", "cuida das pessoas"] },
          { palavra: "EMPATIA", pistas: ["empatica", "empatico", "acolhedora", "acolhedor", "pessoas", "relaciona bem"] },
          { palavra: "LIDERANCA", pistas: ["lidera", "lideranca", "lider", "coordena", "conduz", "comanda", "mobiliza", "empresarios"] },
          { palavra: "PARCEIRO", pistas: ["parceira", "parceiro", "parceria", "aliada", "aliado", "colabora", "cooperativa", "coopera"] },
          { palavra: "COMUNICATIVO", pistas: ["comunicadora", "comunicador", "comunicativa", "comunicativo", "boa comunicacao", "bom comunicador", "boa comunicadora", "comunica bem"] },
          { palavra: "RESOLUTIVO", pistas: ["solucao", "solucoes", "boas solucoes", "resolve", "resolutiva", "resolutivo", "traz solucao", "traz solucoes"] },
          { palavra: "COMPETENTE", pistas: ["competente", "capaz", "bom profissional", "boa profissional"] },
          { palavra: "RESPONSABILIDADE", pistas: ["responsavel", "responsabilidade", "cumpre", "presta contas"] },
          { palavra: "EFICIENTE", pistas: ["eficiente", "produtiva", "produtivo", "agil", "rapida", "rapido"] },
        ];
        for (const regra of regras) {
          if (regra.pistas.some((pista) => textoNormalizado.includes(normalizeAuraText(pista)))) pushPalavra(palavras, regra.palavra);
          if (palavras.length >= 3) break;
        }
        if (palavras.length < 3) {
          for (const palavra of lexico) {
            if (textoNormalizado.includes(normalizeAuraText(palavra))) pushPalavra(palavras, palavra);
            if (palavras.length >= 3) break;
          }
        }
        return palavras;
      };
      try {
        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `VocÃª Ã© um assistente de avaliaÃ§Ã£o de perfil profissional. Dado um texto descritivo sobre uma pessoa, selecione 1 a 3 termos mais relevantes de um lÃ©xico fixo. Um termo pode ser uma palavra ou uma expressÃ£o curta do lÃ©xico. Responda APENAS com um array JSON de strings. LÃ©xico disponÃ­vel: ${lexico.join(", ")}.`,
            },
            {
              role: "user",
              content: `Pessoa avaliada: ${membro_nome || validacao.convite.candidato_nome || "membro"}\n\nDescriÃ§Ã£o: ${texto.trim()}\n\nEscolha de 1 a 3 termos do lÃ©xico, podendo ser palavras ou expressÃµes.`,
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
            for (const p of parsed) if (typeof p === "string") pushPalavra(palavras, p);
          }
        } catch {
          for (const palavra of lexico) {
            if (normalizeAuraText(raw).includes(normalizeAuraText(palavra))) pushPalavra(palavras, palavra);
          }
        }
        if (palavras.length === 0) palavras = inferirPalavrasPorTexto();
        return res.json({ palavras });
      } catch (err: any) {
        console.error("[aura-ai-publica]", err?.message);
        const palavras = inferirPalavrasPorTexto();
        if (palavras.length > 0) return res.json({ palavras });
        return res.status(500).json({ error: "Erro ao analisar texto com IA. Tente novamente." });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/avaliacao-aura/:avaliacaoToken/extrair-arquivo", upload.single("arquivo"), async (req, res) => {
    try {
      const validacao = await validarAvaliacaoAuraPublica(req.params.avaliacaoToken);
      if ("error" in validacao) return res.status(validacao.status).json({ error: validacao.error });
      const file = req.file;
      if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
      const mime = file.mimetype;
      const name = (file.originalname || "").toLowerCase();
      let texto = "";
      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(file.buffer);
        texto = data.text || "";
      } else if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
        texto = file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Tipo de arquivo nÃ£o suportado. Use PDF ou TXT." });
      }
      texto = texto.replace(/\s+/g, " ").trim();
      if (texto.length > 4000) texto = texto.slice(0, 4000) + "...";
      if (texto.length < 5) return res.status(400).json({ error: "NÃ£o foi possÃ­vel extrair texto do arquivo." });
      res.json({ texto });
    } catch (error: any) {
      console.error("[aura-arquivo-publico]", error?.message);
      res.status(500).json({ error: "Erro ao processar o arquivo." });
    }
  });

  app.post("/api/avaliacao-aura/:avaliacaoToken/transcrever-audio", auraAudioUpload.single("audio"), async (req, res) => {
    try {
      const validacao = await validarAvaliacaoAuraPublica(req.params.avaliacaoToken);
      if ("error" in validacao) return res.status(validacao.status).json({ error: validacao.error });
      const file = req.file;
      if (!file) return res.status(400).json({ error: "Nenhum Ã¡udio enviado." });
      const texto = await transcribeAuraAudioFile(file);
      if (texto.length < 3) return res.status(400).json({ error: "NÃ£o foi possÃ­vel entender o Ã¡udio." });
      res.json({ texto: texto.length > 4000 ?texto.slice(0, 4000) + "..." : texto });
    } catch (error: any) {
      console.error("[aura-audio-publico]", error?.message);
      res.status(500).json({ error: "NÃ£o foi possÃ­vel processar o Ã¡udio. Tente novamente." });
    }
  });

  // POST /api/avaliacao-aura/:avaliacaoToken â€” inviting member submits Aura evaluation (public via dedicated one-time token)
  app.post("/api/avaliacao-aura/:avaliacaoToken", async (req, res) => {
    try {
      const convite = await storage.getConviteByAvaliacaoToken(req.params.avaliacaoToken);
      if (!convite) return res.status(404).json({ error: "Link de avaliaÃ§Ã£o invÃ¡lido" });
      if (convite.status !== "aguardando_avaliacao_aura") return res.status(400).json({ error: "AvaliaÃ§Ã£o de Aura nÃ£o estÃ¡ disponÃ­vel neste momento" });
      if (!convite.invitador_membro_id) return res.status(400).json({ error: "Este convite nÃ£o possui um convidador identificado" });
      const { palavras } = req.body;
      if (!Array.isArray(palavras) || palavras.length < 1 || palavras.length > 3) {
        return res.status(400).json({ error: "Informe entre 1 e 3 termos" });
      }
      if (!palavras.every((p: unknown) => typeof p === "string" && p.trim().length > 0)) {
        return res.status(400).json({ error: "Todos os termos devem ser texto nÃ£o vazio" });
      }
      const { classificarPalavra } = await import("./aura-lexico");
      for (const p of palavras) {
        if (!classificarPalavra(p)) return res.status(400).json({ error: `Termo nÃ£o reconhecido no lÃ©xico: ${p}` });
      }
      await storage.upsertAuraAvaliacao(convite.invitador_membro_id, convite.candidato_membro_id, palavras);
      await storage.updateConvite(convite.id, { status: "candidato", aura_invitador_avaliada_em: new Date() });
      const col = await getComunidadeCol();
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      const comunidade = cr.ok ? (await cr.json()).data : null;
      const aliado = comunidade?.aliado;
      let auraScore: number | null = null;
      let auraFaixa: string | null = null;
      try {
        const auraRes = await fetch(`http://localhost:5001/api/aura/${convite.candidato_membro_id}`);
        if (auraRes.ok) { const ad = await auraRes.json(); auraScore = ad.score ?? null; auraFaixa = ad.faixa ?? null; }
      } catch (_) {}
      const invitador = await getDirectusMembro(convite.invitador_membro_id);
      if (aliado?.email) {
        await notificarAliadoAposAuraInvitador({
          aliadoEmail: aliado.email, aliadoNome: aliado.nome || "Aliado",
          candidatoNome: convite.candidato_nome || "Candidato", candidatoEmail: convite.candidato_email || undefined,
          candidatoId: convite.candidato_membro_id, invitadorNome: invitador?.nome || "Membro BUILT",
          auraScore, auraFaixa, auraPalavras: palavras,
          comunidadeNome: comunidade?.nome || "Comunidade BUILT", comunidadeId: convite.comunidade_id,
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/convites/:token/aura-invitador â€” BLOCKED: use /api/avaliacao-aura/:avaliacaoToken instead
  // Kept to prevent accidental self-evaluation by candidates using their own convite token
  app.post("/api/convites/:token/aura-invitador", (_req, res) => {
    res.status(403).json({ error: "Este endpoint foi desativado. Use o link enviado por e-mail para registrar a avaliaÃ§Ã£o de Aura." });
  });

  // PATCH /api/convites/:token/pagamento â€” confirm payment & activate member (authenticated, aliado/admin)
  app.patch("/api/convites/:token/pagamento", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["termos_aceitos", "pagamento_pendente"].includes(convite.status)) return res.status(400).json({ error: "Termos ainda nÃ£o foram aceitos" });

      // Enforce payment window expiry
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo de 24h para confirmaÃ§Ã£o de pagamento expirou. Reenvie o lembrete para reabrir o prazo." });
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
        // Cannot activate without verifying/updating badge â€” fail atomically
        console.error("[pagamento] candidato not found in Directus:", convite.candidato_membro_id);
        return res.status(502).json({ error: "Dados do candidato nÃ£o encontrados no Directus. Verifique o cadastro e tente novamente." });
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
        return res.status(502).json({ error: "Falha ao adicionar membro Ã  comunidade no Directus. Tente novamente." });
      }

      // Only mark membro after both Directus updates succeed
      await storage.updateConvite(convite.id, { status: "membro" });

      // 3. Send final approval email to the candidate + notify community stakeholders
      const candidatoEmail = convite.candidato_email || candidatoData?.email;
      if (candidatoEmail) {
        await enviarAprovacaoVitrine({
          candidatoEmail,
          candidatoNome: convite.candidato_nome || candidatoData?.nome || "Membro BUILT",
          comunidadeNome,
        });
      }

      const notifyEmails: string[] = [];
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

  // POST /api/convites/:token/lembrete â€” send reminder email (authenticated, aliado/admin)
  app.post("/api/convites/:token/lembrete", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });

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

  // POST /api/meu-convite â€” generate a vitrine invite link for the current authenticated member
  app.post("/api/meu-convite", async (req, res) => {
    const sessionUserId = (req.session as any).directusUserId;
    if (!sessionUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const email = (req.session as any).email;
      const localUser = email ? await storage.getUserByEmail(email) : null;
      const userId = localUser?.id || sessionUserId;
      const membroId = (req.session as any).membroId as string | null;
      const nome = (req.session as any).nome as string;

      // Any authenticated member may generate a personal invite link (requires community membership)

      const forceNew = req.body?.force === true;
      const tiposConviteValidos = ["vitrine", "capital"];
      const tipoConvite = tiposConviteValidos.includes(String(req.body?.tipo || ""))
        ? String(req.body.tipo)
        : "vitrine";

      // Check if there's already an active invite (skip if force=true)
      if (!forceNew) {
        const existing = await storage.getActiveConviteLinkByUserId(userId);
        if (existing && new Date() < new Date(existing.expires_at) && ((existing as any).tipo || "vitrine") === tipoConvite) {
          const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://app.builtalliances.com");
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

      // Block invite generation if the member has no community â€” the registration
      // flow requires a valid comunidade_id to create the vitrine candidatura record.
      if (!comunidadeId) {
        return res.status(400).json({
          error: "VocÃª precisa estar associado a uma comunidade para gerar um convite. Entre em contato com seu Aliado BUILT."
        });
      }

      const expires = new Date();
      expires.setDate(expires.getDate() + 1); // Valid for 1 day

      const convite = await storage.createConviteLink({
        gerador_user_id: userId,
        gerador_membro_id: membroId || null,
        gerador_nome: nome || null,
        comunidade_id: comunidadeId || null,
        comunidade_nome: comunidadeNome || null,
        tipo: tipoConvite,
        status: "ativo",
        usado_por_user_id: null,
        expires_at: expires,
      });

      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://app.builtalliances.com");
      res.json({ ...convite, link: `${rawDomain}/login?convite=${convite.token}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/meu-convite â€” get the active, non-expired convite link for the current user
  app.get("/api/meu-convite", async (req, res) => {
    const sessionUserId = (req.session as any).directusUserId;
    if (!sessionUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const email = (req.session as any).email;
      const localUser = email ? await storage.getUserByEmail(email) : null;
      const userId = localUser?.id || sessionUserId;
      const convite = await storage.getActiveConviteLinkByUserId(userId);
      if (!convite) return res.json(null);
      // Validate expiry â€” mark as expirado if past expires_at
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        await storage.updateConviteLink(convite.id, { status: "expirado" }).catch(() => {});
        return res.json(null);
      }
      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://app.builtalliances.com");
      res.json({ ...convite, link: `${rawDomain}/login?convite=${convite.token}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/convite-publico/:token â€” public: validate token and return minimal info
  app.get("/api/convite-publico/:token", async (req, res) => {
    try {
      const convite = await storage.getConviteLinkByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (convite.status !== "ativo") return res.status(400).json({ error: "Este convite jÃ¡ foi utilizado ou expirou." });
      if (new Date() > new Date(convite.expires_at)) return res.status(400).json({ error: "Este convite expirou." });
      res.json({
        gerador_nome: convite.gerador_nome,
        comunidade_nome: convite.comunidade_nome,
        tipo: (convite as any).tipo || "vitrine",
        expires_at: convite.expires_at,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/aprovar-vitrine â€” approve vitrine access (aliado or admin only)
  app.patch("/api/convites/:token/aprovar-vitrine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["vitrine", "capital"].includes(convite.tipo)) return res.status(400).json({ error: "Este endpoint Ã© apenas para convites de vitrine ou capital" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura nÃ£o estÃ¡ em anÃ¡lise" });

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

      if (convite.candidato_membro_id) {
        const accessPatch: Record<string, any> = convite.tipo === "capital"
          ? {
              na_vitrine: false,
              em_built_capital: true,
              em_membros_built: false,
            }
          : {
              na_vitrine: true,
              em_built_capital: false,
              em_membros_built: false,
            };
        if (convite.tipo === "capital") {
          const candidatoData = await getDirectusMembro(convite.candidato_membro_id);
          const redesAtuais = Array.isArray(candidatoData?.Outras_redes_as_quais_pertenco)
            ? candidatoData.Outras_redes_as_quais_pertenco
            : [];
          accessPatch.Outras_redes_as_quais_pertenco = redesAtuais.includes("BUILT_CAPITAL_PARTNER")
            ? redesAtuais
            : [...redesAtuais, "BUILT_CAPITAL_PARTNER"];
        }
        try {
          await directusUpdate("cadastro_geral", convite.candidato_membro_id, accessPatch);
        } catch (err: any) {
          console.error("[aprovar-vitrine] access patch failed:", err?.message || err);
          return res.status(502).json({ error: "Falha ao atualizar permissÃµes no Directus. Tente novamente." });
        }
      }

      // Keep the local role aligned with the invite type without unlocking Alliances.
      const allUsers = await storage.getAllUsers();
      const candidatoUser = allUsers.find(u => u.membro_directus_id === convite.candidato_membro_id);
      if (candidatoUser) {
        await storage.updateUser(candidatoUser.id, { role: convite.tipo === "capital" ? "investidor" : "user" });
      }

      // Send approval email to candidate and notify invitador
      const comunidadeNome = comunidade?.nome || "Comunidade BUILT";
      try {
        if (convite.candidato_email) {
          await enviarAprovacaoVitrine({
            candidatoEmail: convite.candidato_email,
            candidatoNome: convite.candidato_nome || "Candidato",
            comunidadeNome,
          });
        }
        if (convite.invitador_membro_id) {
          const invitador = await getDirectusMembro(convite.invitador_membro_id);
          if (invitador?.email) {
            const { enviarAprovacaoVitrineInvitador } = await import("./mailer");
            await enviarAprovacaoVitrineInvitador({
              invitadorEmail: invitador.email,
              invitadorNome: invitador.nome || "Membro BUILT",
              candidatoNome: convite.candidato_nome || "Candidato",
              comunidadeNome,
            });
          }
        }
      } catch (emailErr) {
        console.warn("[aprovar-vitrine] email failed (non-fatal):", emailErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/convites/:token/rejeitar-vitrine â€” reject vitrine access (aliado or admin only)
  app.patch("/api/convites/:token/rejeitar-vitrine", async (req, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["vitrine", "capital"].includes(convite.tipo)) return res.status(400).json({ error: "Este endpoint Ã© apenas para convites de vitrine ou capital" });
      if (convite.status !== "candidato") return res.status(400).json({ error: "Candidatura nÃ£o estÃ¡ em anÃ¡lise" });

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

      // Send rejection emails to candidate and invitador
      const { enviarRejeicaoVitrine } = await import("./mailer");
      if (convite.candidato_email) {
        let invitadorEmail: string | undefined;
        let invitadorNome: string | undefined;
        if (convite.invitador_membro_id) {
          const invitador = await getDirectusMembro(convite.invitador_membro_id);
          invitadorEmail = invitador?.email || undefined;
          invitadorNome = invitador?.nome || undefined;
        }
        await enviarRejeicaoVitrine({
          candidatoEmail: convite.candidato_email,
          candidatoNome: convite.candidato_nome || "Candidato",
          comunidadeNome: comunidade?.nome || "Comunidade BUILT",
          invitadorEmail,
          invitadorNome,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== STRIPE PAGAMENTO ==========

  // POST /api/convites/:token/checkout â€” create Stripe Checkout Session (public, token is the auth)
  app.post("/api/convites/:token/checkout", async (req, res) => {
    try {
      const convite = await storage.getConviteByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite nÃ£o encontrado" });
      if (!["termos_aceitos", "pagamento_pendente"].includes(convite.status)) {
        return res.status(400).json({ error: "Aceite os termos de adesÃ£o antes de pagar" });
      }

      // Enforce payment window expiry (same rule as the manual confirmation endpoint)
      if (convite.expires_at && new Date() > new Date(convite.expires_at)) {
        return res.status(410).json({ error: "O prazo de pagamento expirou. Solicite um novo lembrete ao seu Aliado BUILT para reabrir o prazo." });
      }

      const stripe = getStripeClient();
      const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null);
      if (!rawDomain) {
        console.error("[stripe/checkout] APP_URL and REPLIT_DOMAINS are both unset â€” cannot build redirect URLs");
        return res.status(500).json({ error: "ConfiguraÃ§Ã£o de URL ausente. Contate o suporte tÃ©cnico." });
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
              unit_amount: 319700,
              product_data: {
                name: "Taxa de AdesÃ£o BUILT Alliances",
                description: `AdesÃ£o Ã  comunidade ${convite.candidato_nome ? "- " + convite.candidato_nome : ""}`.trim(),
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

  // POST /api/stripe/webhook â€” handle Stripe webhook events
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

    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const fluxoCaixaId: string | undefined = invoice.metadata?.fluxo_caixa_id || undefined;
      if (fluxoCaixaId) {
        try {
          await markFluxoPagamentoPago(fluxoCaixaId, "stripe", invoice.id);
          console.log("[stripe/webhook] fluxo_caixa invoice paid:", fluxoCaixaId);
        } catch (err: any) {
          console.error("[stripe/webhook] fluxo_caixa invoice update error:", err.message);
          return res.status(500).json({ error: "Erro interno ao processar fatura do fluxo de caixa" });
        }
        return res.status(200).json({ received: true });
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const fluxoCaixaId: string | undefined = session.metadata?.fluxo_caixa_id || undefined;
      if (fluxoCaixaId) {
        if (session.payment_status !== "paid") {
          console.log("[stripe/webhook] fluxo_caixa session not yet paid (payment_status=%s), skipping: %s", session.payment_status, fluxoCaixaId);
          return res.status(200).json({ received: true });
        }
        try {
          await markFluxoPagamentoPago(fluxoCaixaId, "stripe", session.id);
          console.log("[stripe/webhook] fluxo_caixa payment confirmed:", fluxoCaixaId);
        } catch (err: any) {
          console.error("[stripe/webhook] fluxo_caixa update error:", err.message);
          return res.status(500).json({ error: "Erro interno ao processar pagamento do fluxo de caixa" });
        }
        return res.status(200).json({ received: true });
      }

      const anuncioReference: string | undefined = session.metadata?.anuncio_id
        ? `anuncio:${session.metadata.anuncio_id}`
        : session.client_reference_id || undefined;
      if (anuncioReference?.startsWith("anuncio:")) {
        const anuncioId = anuncioReference.replace("anuncio:", "");
        if (session.payment_status !== "paid") {
          console.log("[stripe/webhook] anuncio session not yet paid (payment_status=%s), skipping: %s", session.payment_status, anuncioId);
          return res.status(200).json({ received: true });
        }
        try {
          await markAnuncioPago(anuncioId, "stripe", session.id);
          console.log("[stripe/webhook] anuncio payment confirmed:", anuncioId);
        } catch (err: any) {
          console.error("[stripe/webhook] anuncio update error:", err.message);
          return res.status(500).json({ error: "Erro interno ao processar pagamento do destaque" });
        }
        return res.status(200).json({ received: true });
      }

      // Support both dynamic checkout sessions (metadata) and Payment Links (client_reference_id)
      const token: string | undefined = session.metadata?.convite_token || session.client_reference_id || undefined;

      if (!token) {
        console.error("[stripe/webhook] missing convite_token in metadata and client_reference_id");
        return res.status(200).json({ received: true });
      }

      // Validate payment is actually settled â€” guard against async payment methods
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
          return res.status(500).json({ error: "Candidato nÃ£o encontrado no Directus â€” webhook serÃ¡ re-tentado" });
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
            return res.status(502).json({ error: "Falha ao atualizar badge no Directus â€” webhook serÃ¡ re-tentado" });
          }
        }

        // 2. Add member to community M2M in Directus (must succeed before marking membro)
        const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?${COMUNIDADE_FIELDS}`;
        const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        if (!cr.ok) {
          console.error("[stripe/webhook] failed to fetch comunidade:", cr.status);
          return res.status(502).json({ error: "Falha ao buscar comunidade no Directus â€” webhook serÃ¡ re-tentado" });
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
          return res.status(502).json({ error: "Falha ao adicionar membro Ã  comunidade no Directus â€” webhook serÃ¡ re-tentado" });
        }

        // 3. Only mark as membro after both Directus updates succeed
        await storage.updateConvite(convite.id, { status: "membro" });
        console.log("[stripe/webhook] convite activated:", token);

        // 4. Send final approval email to the candidate + notify community stakeholders
        const candidatoEmail = convite.candidato_email || candidatoData?.email;
        if (candidatoEmail) {
          enviarAprovacaoVitrine({
            candidatoEmail,
            candidatoNome: convite.candidato_nome || candidatoData?.nome || "Membro BUILT",
            comunidadeNome,
          }).catch((emailErr: any) => {
            console.error("[stripe/webhook] candidate approval email failed (non-fatal):", emailErr.message);
          });
        }

        const notifyEmails: string[] = [];
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
        return res.status(500).json({ error: "Erro interno ao processar webhook â€” serÃ¡ re-tentado" });
      }
    }

    res.status(200).json({ received: true });
  });

  // POST /api/webhooks/asaas â€” handle Asaas payment webhook events
  app.post("/api/webhooks/asaas", async (req, res) => {
    // Mandatory token verification â€” ASAAS_WEBHOOK_TOKEN must be set in env
    const webhookTokens = [process.env.ASAAS_WEBHOOK_TOKEN, process.env.ASAAS_WEBHOOK_SECRET].filter((token): token is string => Boolean(token));
    if (webhookTokens.length === 0) {
      console.error("[asaas/webhook] ASAAS_WEBHOOK_TOKEN not configured â€” rejecting request");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const getHeader = (name: string) => {
      const value = req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };
    const authorization = getHeader("authorization");
    const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : undefined;
    const incomingToken =
      getHeader("asaas-access-token") ||
      getHeader("x-asaas-access-token") ||
      getHeader("asaas_access_token") ||
      bearerToken ||
      (typeof req.query.token === "string" ? req.query.token : undefined) ||
      (typeof req.query.access_token === "string" ? req.query.access_token : undefined);
    if (!incomingToken || !webhookTokens.includes(incomingToken)) {
      console.error("[asaas/webhook] invalid or missing access token");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as any;
    const event: string = body?.event || "";
    const payment = body?.payment || {};

    console.log(`[asaas/webhook] event=${event} paymentId=${payment.id} status=${payment.status}`);

    // Only act on confirmed/received payments
    const ACTIVATION_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
    if (!ACTIVATION_EVENTS.includes(event)) {
      return res.status(200).json({ received: true });
    }

    try {
      // Strategy 1: match by externalReference (set this to the convite token when creating dynamic payments)
      let convite: any = null;
      const extRef: string | null = payment.externalReference || null;
      if (extRef?.startsWith("fluxo_caixa:")) {
        const fluxoCaixaId = extRef.replace("fluxo_caixa:", "");
        try {
          await markFluxoPagamentoPago(fluxoCaixaId, "asaas", payment.id || null);
          console.log("[asaas/webhook] fluxo_caixa payment confirmed:", fluxoCaixaId);
        } catch (err: any) {
          console.error("[asaas/webhook] fluxo_caixa update error:", err.message);
          return res.status(500).json({ error: "Erro interno ao processar pagamento do fluxo de caixa" });
        }
        return res.status(200).json({ received: true });
      }

      if (extRef?.startsWith("anuncio:")) {
        const anuncioId = extRef.replace("anuncio:", "");
        try {
          await markAnuncioPago(anuncioId, "asaas", payment.id || null);
          console.log("[asaas/webhook] anuncio payment confirmed:", anuncioId);
        } catch (err: any) {
          console.error("[asaas/webhook] anuncio update error:", err.message);
          return res.status(500).json({ error: "Erro interno ao processar pagamento do destaque" });
        }
        return res.status(200).json({ received: true });
      }

      if (extRef) {
        convite = await storage.getConviteByToken(extRef);
        if (convite) console.log(`[asaas/webhook] matched convite via externalReference token: ${extRef}`);
      }

      // Strategy 2: match by customer email â€” only match convites in pagamento_pendente status
      // to avoid ambiguity when a customer has multiple convites
      if (!convite) {
        const email: string | null =
          payment.customerEmail ||
          payment.customer?.email ||
          body.customer?.email ||
          null;
        if (email) {
          const all = await storage.getAllConvites();
          const matches = all.filter(
            (c: any) =>
              c.candidato_email?.toLowerCase() === email.toLowerCase() &&
              c.status === "pagamento_pendente"
          );
          // Pick the most recently created match to avoid activating stale convites
          matches.sort((a: any, b: any) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime());
          convite = matches[0] || null;
          if (convite) console.log(`[asaas/webhook] matched convite via email: ${email}`);
          else if (matches.length === 0) console.warn(`[asaas/webhook] no pagamento_pendente convite found for email: ${email}`);
        }
      }

      if (!convite) {
        console.warn(`[asaas/webhook] could not match convite â€” paymentId=${payment.id} externalReference=${extRef}`);
        return res.status(200).json({ received: true });
      }

      // Idempotency: skip if already activated
      if (convite.status === "membro") {
        console.log(`[asaas/webhook] convite already activated, skipping: ${convite.token}`);
        return res.status(200).json({ received: true });
      }

      const col = await getComunidadeCol();

      // 1. Add BUILT_PROUD_MEMBER badge in Directus
      const candidatoData = await getDirectusMembro(convite.candidato_membro_id);
      if (!candidatoData) {
        console.error("[asaas/webhook] candidato not found in Directus:", convite.candidato_membro_id);
        return res.status(500).json({ error: "Candidato nÃ£o encontrado â€” webhook serÃ¡ re-tentado" });
      }
      const redesAtuais: string[] = Array.isArray(candidatoData.Outras_redes_as_quais_pertenco)
        ? candidatoData.Outras_redes_as_quais_pertenco
        : [];
      if (!redesAtuais.includes("BUILT_PROUD_MEMBER")) {
        const badgePatch = await fetch(`${DIRECTUS_URL}/items/cadastro_geral/${convite.candidato_membro_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ Outras_redes_as_quais_pertenco: [...redesAtuais, "BUILT_PROUD_MEMBER"] }),
        });
        if (!badgePatch.ok) {
          const err = await badgePatch.text().catch(() => "");
          console.error("[asaas/webhook] BUILT_PROUD_MEMBER badge update failed:", badgePatch.status, err);
          return res.status(502).json({ error: "Falha ao atualizar badge no Directus â€” webhook serÃ¡ re-tentado" });
        }
      }

      // 2. Add member to community M2M in Directus
      const comunidadeUrl = `${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}?${COMUNIDADE_FIELDS}`;
      const cr = await fetch(comunidadeUrl, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!cr.ok) {
        console.error("[asaas/webhook] failed to fetch comunidade:", cr.status);
        return res.status(502).json({ error: "Falha ao buscar comunidade â€” webhook serÃ¡ re-tentado" });
      }
      const comunidade = (await cr.json()).data;
      const comunidadeNome = comunidade?.nome || "Comunidade BUILT";
      const currentMembros: any[] = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
      const currentIds = currentMembros.map((m: any) => {
        const id = typeof m.cadastro_geral_id === "string" ? m.cadastro_geral_id : m.cadastro_geral_id?.id;
        return id ? { cadastro_geral_id: id } : null;
      }).filter(Boolean);
      if (!currentIds.some((m: any) => m.cadastro_geral_id === convite.candidato_membro_id)) {
        currentIds.push({ cadastro_geral_id: convite.candidato_membro_id });
      }
      const m2mPatch = await fetch(`${DIRECTUS_URL}/items/${col}/${convite.comunidade_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ membros: currentIds }),
      });
      if (!m2mPatch.ok) {
        const err = await m2mPatch.text().catch(() => "");
        console.error("[asaas/webhook] M2M membership update failed:", m2mPatch.status, err);
        return res.status(502).json({ error: "Falha ao adicionar membro Ã  comunidade â€” webhook serÃ¡ re-tentado" });
      }

      // 3. Mark convite as membro
      await storage.updateConvite(convite.id, { status: "membro" });
      console.log(`[asaas/webhook] convite activated: ${convite.token}`);

      // 4. Send final approval email to the candidate + notify community stakeholders
      const candidatoEmail = convite.candidato_email || candidatoData?.email;
      if (candidatoEmail) {
        enviarAprovacaoVitrine({
          candidatoEmail,
          candidatoNome: convite.candidato_nome || candidatoData?.nome || "Membro BUILT",
          comunidadeNome,
        }).catch((emailErr: any) => {
          console.error("[asaas/webhook] candidate approval email failed (non-fatal):", emailErr.message);
        });
      }

      const notifyEmails: string[] = [];
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
          console.error("[asaas/webhook] email send failed (non-fatal):", emailErr.message);
        });
      }
    } catch (err: any) {
      console.error("[asaas/webhook] processing error:", err.message);
      return res.status(500).json({ error: "Erro interno â€” webhook serÃ¡ re-tentado" });
    }

    return res.status(200).json({ received: true });
  });

  // â”€â”€ Aura Percebida â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { calcularAura, classificarPalavra, PALAVRAS_SUGERIDAS } = await import("./aura-lexico.js");
  async function getAuraAccessContext(req: any) {
    const role = (req.session as any).role || "user";
    const membroId = ((req.session as any).membroId as string | null) || null;
    let naVitrine = false;
    let emMembrosBuilt = false;
    let emBuiltCapital = false;
    let redes: string[] = [];

    if (membroId) {
      try {
        const membro = await directusFetchOne(
          "cadastro_geral",
          membroId,
          "fields=na_vitrine,em_membros_built,em_built_capital,Outras_redes_as_quais_pertenco"
        );
        naVitrine = membro?.na_vitrine === true || membro?.na_vitrine === 1;
        emMembrosBuilt = membro?.em_membros_built === true || membro?.em_membros_built === 1;
        emBuiltCapital = membro?.em_built_capital === true || membro?.em_built_capital === 1;
        redes = Array.isArray(membro?.Outras_redes_as_quais_pertenco) ? membro.Outras_redes_as_quais_pertenco : [];
      } catch (_) {
        redes = Array.isArray((req.session as any).Outras_redes_as_quais_pertenco)
          ? (req.session as any).Outras_redes_as_quais_pertenco
          : [];
      }
    }

    const hasMemberSeal =
      redes.includes("BUILT_PROUD_MEMBER") ||
      redes.includes("BUILT_FOUNDING_MEMBER") ||
      redes.includes("BUILT_ALLIANCE_PARTNER");
    const canConsultAura =
      emMembrosBuilt ||
      ["membro", "aliado", "manager", "admin", "superadmin"].includes(role) ||
      hasMemberSeal;
    const canRegisterAura = canConsultAura;
    const isVitrineOnly =
      role === "user" &&
      naVitrine &&
      !emMembrosBuilt &&
      !emBuiltCapital;

    return { membroId, canConsultAura, canRegisterAura, isVitrineOnly };
  }

  async function blockVitrineOnlyAura(req: any, res: any) {
    const access = await getAuraAccessContext(req);
    if (access.isVitrineOnly) {
      res.status(403).json({ error: "UsuÃ¡rios somente da Vitrine podem consultar apenas a prÃ³pria Aura." });
      return true;
    }
    return false;
  }

  async function getAuraLinkedMemberIdsServer(currentMemberId?: string | null): Promise<Set<string>> {
    const ids = new Set<string>();
    const communityIds = new Set<string>();
    if (!currentMemberId) return ids;
    const current = String(currentMemberId);

    try {
      const col = await getComunidadeCol();
      const comunidades = await directusFetchScoped(
        col,
        "fields=id,aliado.id,membros.cadastro_geral_id.id&limit=-1"
      );
      for (const comunidade of comunidades || []) {
        const aliadoId = directusRelationId(comunidade?.aliado);
        const membros = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
        const membroIds = membros
          .map((m: any) => directusRelationId(m?.cadastro_geral_id ?? m))
          .filter(Boolean) as string[];
        if (String(aliadoId || "") === current || membroIds.map(String).includes(current)) {
          if (comunidade?.id != null) communityIds.add(String(comunidade.id));
          if (aliadoId) ids.add(aliadoId);
          for (const id of membroIds) ids.add(id);
        }
      }
    } catch (error: any) {
      console.warn("[aura-vinculos] falha ao carregar comunidades:", error?.message);
    }

    try {
      const storedComunidadeMae = await getStoredMembroComunidadeMae(current);
      if (storedComunidadeMae?.comunidade_id) {
        const comunidadeMaeId = String(storedComunidadeMae.comunidade_id);
        communityIds.add(comunidadeMaeId);
        const membrosMae = await getMembroIdsDaComunidadeMae(comunidadeMaeId);
        for (const id of membrosMae) ids.add(id);
      }
    } catch (error: any) {
      console.warn("[aura-vinculos] falha ao carregar comunidade mae local:", error?.message);
    }

    try {
      const convites = await storage.getAllConvites();
      const inactiveStatuses = new Set([
        "rejeitado",
        "rejeitada",
        "cancelado",
        "cancelada",
        "arquivado",
        "arquivada",
      ]);
      const activeInvites = (convites || []).filter((convite: any) => {
        const status = String(convite?.status || "").trim().toLowerCase();
        return !inactiveStatuses.has(status);
      });

      // A member may belong to more than one community. First collect every
      // community reached by their active memberships/invitations.
      for (const convite of activeInvites) {
        const candidatoId = convite?.candidato_membro_id
          ? String(convite.candidato_membro_id)
          : "";
        const invitadorId = convite?.invitador_membro_id
          ? String(convite.invitador_membro_id)
          : "";
        const comunidadeId = convite?.comunidade_id
          ? String(convite.comunidade_id)
          : "";
        if (comunidadeId && (candidatoId === current || invitadorId === current)) {
          communityIds.add(comunidadeId);
        }
      }

      // Then include every member found in any of those communities, as well
      // as direct inviter/candidate relationships.
      for (const convite of activeInvites) {
        const candidatoId = convite?.candidato_membro_id
          ? String(convite.candidato_membro_id)
          : "";
        const invitadorId = convite?.invitador_membro_id
          ? String(convite.invitador_membro_id)
          : "";
        const comunidadeId = convite?.comunidade_id
          ? String(convite.comunidade_id)
          : "";
        const linkedByInvitation = candidatoId === current || invitadorId === current;
        const linkedByCommunity = Boolean(comunidadeId && communityIds.has(comunidadeId));

        if (!linkedByInvitation && !linkedByCommunity) continue;
        if (candidatoId) ids.add(candidatoId);
        if (invitadorId) ids.add(invitadorId);
      }
    } catch (error: any) {
      console.warn("[aura-vinculos] falha ao carregar convites da comunidade:", error?.message);
    }

    try {
      const bias = await directusFetch(
        "bias_projetos",
        "fields=id,autor_bia,aliado_built,diretor_alianca,diretor_nucleo_tecnico,diretor_execucao,diretor_comercial,diretor_capital,socios_guardioes,socios_multiplicadores,terceiros&limit=-1"
      );
      const singleMemberFields = [
        "autor_bia",
        "aliado_built",
        "diretor_alianca",
        "diretor_nucleo_tecnico",
        "diretor_execucao",
        "diretor_comercial",
        "diretor_capital",
      ];
      for (const bia of bias || []) {
        if (!isUserLinkedToBia(bia, current)) continue;
        for (const field of singleMemberFields) {
          const id = directusRelationId(bia?.[field]);
          if (id) ids.add(id);
        }
        for (const id of parseBiaMemberList(bia?.socios_guardioes)) ids.add(id);
        for (const id of parseBiaMemberList(bia?.socios_multiplicadores)) ids.add(id);
        for (const id of parseBiaMemberList(bia?.terceiros)) ids.add(id);
      }
    } catch (error: any) {
      console.warn("[aura-vinculos] falha ao carregar BIAs:", error?.message);
    }

    ids.delete(current);
    return ids;
  }

  async function requireAuraConsultTarget(req: any, res: any, targetMemberId: string) {
    const access = await getAuraAccessContext(req);
    if (access.isVitrineOnly && targetMemberId !== access.membroId) {
      res.status(403).json({ error: "UsuÃ¡rios somente da Vitrine podem consultar apenas a prÃ³pria Aura." });
      return false;
    }
    if (targetMemberId === access.membroId) return true;
    if (!access.canConsultAura) {
      res.status(403).json({ error: "Apenas membros BUILT podem consultar Aura de terceiros." });
      return false;
    }
    return true;
  }

  async function requireAuraRegisterTarget(req: any, res: any, targetMemberId: string) {
    const access = await getAuraAccessContext(req);
    if (access.isVitrineOnly && targetMemberId !== access.membroId) {
      res.status(403).json({ error: "UsuÃ¡rios somente da Vitrine podem consultar apenas a prÃ³pria Aura." });
      return false;
    }
    if (targetMemberId === access.membroId) {
      res.status(400).json({ error: "VocÃª nÃ£o pode avaliar a si mesmo" });
      return false;
    }
    if (!access.canRegisterAura) {
      res.status(403).json({ error: "Apenas membros BUILT podem registrar Aura de terceiros." });
      return false;
    }
    const linkedIds = await getAuraLinkedMemberIdsServer(access.membroId);
    if (!linkedIds.has(String(targetMemberId))) {
      res.status(403).json({ error: "VocÃª sÃ³ pode registrar Aura de pessoas vinculadas Ã sua comunidade ou BIA." });
      return false;
    }
    return true;
  }

  // GET /api/aura/membros/busca â€” member search for evaluation form
  app.get("/api/aura/membros/busca", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const q = String(req.query.q || "").trim();
    try {
      const access = await getAuraAccessContext(req);
      if (!access.canConsultAura) return res.status(403).json({ error: "Apenas membros BUILT podem consultar Aura de terceiros." });
      const params = new URLSearchParams({
        limit: "100",
        fields: "id,nome,Nome_de_usuario,email,cargo,empresa,foto_perfil",
        sort: "nome",
      });
      if (access.membroId) params.set("filter[id][_neq]", access.membroId);
      if (q.length >= 2) {
        params.set("filter[_or][0][nome][_icontains]", q);
        params.set("filter[_or][1][empresa][_icontains]", q);
        params.set("filter[_or][2][cargo][_icontains]", q);
        params.set("filter[_or][3][Nome_de_usuario][_icontains]", q);
        params.set("filter[_or][4][email][_icontains]", q);
      }
      const url = `${DIRECTUS_URL}/items/cadastro_geral?${params.toString()}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
      if (!r.ok) return res.json([]);
      const json = await r.json();
      const items = (json.data || []).map((m: any) => ({
        id: m.id,
        nome: m.nome || m.Nome_de_usuario || m.email || "Membro BUILT",
        cargo: m.cargo,
        empresa: m.empresa,
        foto: m.foto_perfil || null,
      }));
      return res.json(items);
    } catch {
      return res.json([]);
    }
  });

  // GET /api/aura/vinculos - canonical list used by the UI and write authorization.
  app.get("/api/aura/vinculos", async (req: any, res) => {
    if (!(req.session as any).directusUserId) {
      return res.status(401).json({ error: "Nao autenticado" });
    }
    try {
      const access = await getAuraAccessContext(req);
      if (!access.membroId || !access.canConsultAura) return res.json({ ids: [] });
      const linkedIds = await getAuraLinkedMemberIdsServer(access.membroId);
      return res.json({ ids: Array.from(linkedIds) });
    } catch (error: any) {
      console.error("[aura-vinculos] erro ao montar vinculos:", error?.message || error);
      return res.status(500).json({ error: "Nao foi possivel carregar os vinculos de Aura" });
    }
  });

  // GET /api/aura/lexico â€” keyword list for autocomplete
  app.get("/api/aura/lexico", (_req, res) => {
    res.json(PALAVRAS_SUGERIDAS);
  });

  // GET /api/aura/score/:membroId â€” public score (always calculated if >=1 evaluation)
  app.get("/api/aura/score/:membroId", async (req, res) => {
    try {
      const { membroId } = req.params;
      if ((req.session as any).directusUserId) {
        if (!(await requireAuraConsultTarget(req, res, membroId))) return;
      }
      const avaliacoes = await storage.getAuraAvaliacoesByAvaliado(membroId);
      if (avaliacoes.length === 0) {
        const fallbackBase = process.env.AURA_SCORE_FALLBACK_URL || "https://app.builtalliances.com";
        const requestHost = String(req.headers.host || "").toLowerCase();
        const fallbackHost = new URL(fallbackBase).host.toLowerCase();
        if (fallbackHost && fallbackHost !== requestHost && !requestHost.includes("app.builtalliances.com")) {
          try {
            const fallbackResponse = await fetch(`${fallbackBase.replace(/\/$/, "")}/api/aura/score/${encodeURIComponent(membroId)}`);
            if (fallbackResponse.ok) {
              const fallbackScore = await fallbackResponse.json();
              if (Number(fallbackScore?.n || 0) > 0) {
                return res.json({ ...fallbackScore, fonte: "published_fallback" });
              }
            }
          } catch (fallbackError: any) {
            console.warn("[aura-score-fallback]", fallbackError?.message || fallbackError);
          }
        }
        return res.json({
          score: null,
          T: null,
          R: null,
          C: null,
          aura_plena: 0,
          aura_observada: null,
          aura_publicavel: null,
          cobertura_dimensional: 0,
          teto_cobertura: null,
          teto_confianca: 69,
          teto_curadoria: null,
          motivos_trava: [],
          n: 0,
          faixa: null,
          FR_T: 1,
          FR_R: 1,
          FR_C: 1,
          confianca: "Sem base reputacional",
          confianca_descricao: "Aguardando primeira avaliaÃ§Ã£o",
          total_palavras: 0,
          scores_reputacionais: { T: 0, R: 0, C: 0 },
          scores_ajustados: { T: 0, R: 0, C: 0 },
          pontos_positivos: { T: 0, R: 0, C: 0 },
          penalidades_negativas: { T: 0, R: 0, C: 0 },
          amplitude_reputacional: { T: 0, R: 0, C: 0 },
          convergencia_reputacional: { T: 0, R: 0, C: 0 },
          dimensoes_com_evidencia: [],
          dimensoes_sem_evidencia: ["T", "R", "C"],
          elegivel_aura_suprema: false,
          correspondencia_valores: { T: 0, R: 0, C: 0 },
          redutor_reputacional: 0,
          pontos_atencao_reputacional: [],
          palavras_recebidas: [],
        });
      }
      const result = calcularAura(avaliacoes.map(a => ({ avaliador_membro_id: a.avaliador_membro_id, palavras: a.palavras })));
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/aura/leitura-contextual â€” AI contextual interpretation by alliance nucleus
  app.post("/api/aura/leitura-contextual", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const { membro_nome, nucleo, score, faixa, T, R, C, n, palavras_recebidas } = req.body || {};
    const nucleosPermitidos = new Set(["TÃ©cnico", "Obra", "Comercial", "Capital", "LideranÃ§a"]);
    if (!nucleo || typeof nucleo !== "string" || !nucleosPermitidos.has(nucleo)) {
      return res.status(400).json({ error: "NÃºcleo invÃ¡lido." });
    }

    const palavras = Array.isArray(palavras_recebidas)
      ? palavras_recebidas
        .map((p: any) => ({
          canonico: String(p?.canonico || p?.palavra || "").trim(),
          dimensao: String(p?.dimensao || "").trim(),
          count: Number(p?.count || 0),
        }))
        .filter((p: any) => p.canonico)
        .slice(0, 10)
      : [];

    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "VocÃª Ã© um analista reputacional da BUILT. Gere uma leitura contextual curta, especÃ­fica e acionÃ¡vel para o nÃºcleo informado, usando apenas os dados recebidos. NÃ£o invente fatos. Se houver pouca base amostral, mencione que a leitura Ã© inicial. Responda em portuguÃªs do Brasil, em uma frase ou parÃ¡grafo curto, sem markdown.",
          },
          {
            role: "user",
            content: JSON.stringify({
              membro_nome: membro_nome || "Membro BUILT",
              nucleo,
              score: score ?? null,
              faixa: faixa ?? null,
              dimensoes: {
                tecnica: T ?? 0,
                relacional: R ?? 0,
                comportamental: C ?? 0,
              },
              avaliadores: n ?? 0,
              percepcoes_recebidas: palavras,
              objetivo:
                "Explique como essa Aura se aplica ao nÃºcleo selecionado, destacando forÃ§as e pontos de atenÃ§Ã£o conforme as dimensÃµes e palavras recebidas.",
            }),
          },
        ],
        temperature: 0.25,
        max_tokens: 160,
      });

      const leitura = (completion.choices[0]?.message?.content || "").replace(/\s+/g, " ").trim();
      if (!leitura) return res.status(500).json({ error: "A IA nÃ£o retornou uma leitura." });
      return res.json({ leitura, fonte: "ia" });
    } catch (err: any) {
      console.error("[aura-leitura-contextual]", err?.message);
      return res.status(500).json({ error: "Erro ao gerar leitura contextual com IA." });
    }
  });

  // GET /api/aura/minhas-avaliacoes â€” evaluations received and given by the logged-in member
  app.get("/api/aura/minhas-avaliacoes", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.json({ recebidas: [], dadas: [] });
    const [recebidas, dadas] = await Promise.all([
      storage.getAuraAvaliacoesByAvaliado(membroId),
      storage.getAuraAvaliacoesByAvaliador(membroId),
    ]);

    // Resolve only evaluated member names for evaluations the current user gave.
    // Received evaluations intentionally stay anonymous; the words are visible,
    // but the evaluator identity must not be exposed.
    const allIds = Array.from(new Set(dadas.map(a => a.avaliado_membro_id)));
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
      avaliador_membro_id: null,
      avaliador_nome: null,
    }));

    return res.json({ recebidas: recebidasEnriquecidas, dadas: dadasEnriquecidas });
  });

  // GET /api/aura/avaliacao/:avaliadoId â€” get my evaluation of a specific member
  app.get("/api/aura/avaliacao/:avaliadoId", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.json(null);
    if (!(await requireAuraRegisterTarget(req, res, req.params.avaliadoId))) return;
    const av = await storage.getAuraAvaliacaoByPair(membroId, req.params.avaliadoId);
    return res.json(av ?? null);
  });

  // POST /api/aura/analisar-texto â€” AI analysis: pick up to 3 lexicon words from free text
  app.post("/api/aura/analisar-texto", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const { texto, membro_nome, avaliado_membro_id } = req.body;
    if (!avaliado_membro_id || !(await requireAuraRegisterTarget(req, res, String(avaliado_membro_id)))) return;
    if (!texto || typeof texto !== "string" || texto.trim().length < 10) {
      return res.status(400).json({ error: "Texto muito curto. Descreva o membro com pelo menos 10 caracteres." });
    }
    const { PALAVRAS_SUGERIDAS: lexico } = await import("./aura-lexico.js");
    const normalizeAuraText = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const lexicoPorNormalizado = new Map(lexico.map((palavra) => [normalizeAuraText(palavra), palavra]));
    const resolvePalavraLexico = (palavra: string) => lexicoPorNormalizado.get(normalizeAuraText(palavra));
    const pushPalavra = (lista: string[], palavra: string) => {
      const resolvida = resolvePalavraLexico(palavra);
      if (resolvida && !lista.includes(resolvida) && lista.length < 3) {
        lista.push(resolvida);
      }
    };
    const textoNormalizado = normalizeAuraText(texto);
    const inferirPalavrasPorTexto = () => {
      const palavras: string[] = [];
      const regras: Array<{ palavra: string; pistas: string[] }> = [
        { palavra: "LEALDADE", pistas: ["leal", "fiel", "lealdade", "veste a camisa", "vestir a camisa"] },
        { palavra: "COMPROMETIMENTO", pistas: ["comprometida", "comprometido", "trabalhadora", "trabalhador", "dedicada", "dedicado", "entrega", "veste a camisa", "vestir a camisa"] },
        { palavra: "ATENCIOSO", pistas: ["atenciosa", "atencioso", "atencao", "cuidadosa", "cuidadoso"] },
        { palavra: "EMPATIA", pistas: ["empatica", "empatico", "acolhedora", "acolhedor", "pessoas", "relaciona bem"] },
        { palavra: "LIDERANCA", pistas: ["lidera", "lideranca", "lider", "coordena", "conduz", "comanda", "mobiliza", "empresarios"] },
        { palavra: "PARCEIRO", pistas: ["parceira", "parceiro", "parceria", "aliada", "aliado", "colabora", "cooperativa", "coopera"] },
        { palavra: "COMUNICATIVO", pistas: ["comunicadora", "comunicador", "comunicativa", "comunicativo", "boa comunicacao", "bom comunicador", "boa comunicadora", "comunica bem"] },
        { palavra: "RESOLUTIVO", pistas: ["solucao", "solucoes", "boas solucoes", "resolve", "resolutiva", "resolutivo", "traz solucao", "traz solucoes"] },
        { palavra: "COMPETENTE", pistas: ["competente", "capaz", "bom profissional", "boa profissional"] },
        { palavra: "RESPONSABILIDADE", pistas: ["responsavel", "responsabilidade", "cumpre", "presta contas"] },
        { palavra: "EFICIENTE", pistas: ["eficiente", "produtiva", "produtivo", "agil", "rapida", "rapido"] },
      ];
      for (const regra of regras) {
        if (regra.pistas.some((pista) => textoNormalizado.includes(normalizeAuraText(pista)))) {
          pushPalavra(palavras, regra.palavra);
        }
        if (palavras.length >= 3) break;
      }
      if (palavras.length < 3) {
        for (const palavra of lexico) {
          if (textoNormalizado.includes(normalizeAuraText(palavra))) {
            pushPalavra(palavras, palavra);
          }
          if (palavras.length >= 3) break;
        }
      }
      return palavras;
    };
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `VocÃª Ã© um assistente de avaliaÃ§Ã£o de perfil profissional. Dado um texto descritivo sobre uma pessoa, seu trabalho Ã© selecionar os 1 a 3 termos mais relevantes de um lÃ©xico fixo que melhor representem as caracterÃ­sticas descritas no texto. Um termo pode ser uma palavra ou uma expressÃ£o curta do lÃ©xico. Responda APENAS com um array JSON de strings, sem nenhum texto adicional. Exemplo de resposta vÃ¡lida: ["LideranÃ§a","Bom ouvinte","Trabalha em equipe"]. O lÃ©xico disponÃ­vel Ã©: ${lexico.join(", ")}.`,
          },
          {
            role: "user",
            content: `Pessoa avaliada: ${membro_nome || "membro"}\n\nDescriÃ§Ã£o: ${texto.trim()}\n\nEscolha de 1 a 3 termos do lÃ©xico que melhor descrevem esta pessoa com base no texto acima. Os termos podem ser palavras ou expressÃµes.`,
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
          for (const p of parsed) {
            if (typeof p === "string") pushPalavra(palavras, p);
          }
        }
      } catch {
        // try to extract words from malformed response
        for (const palavra of lexico) {
          if (normalizeAuraText(raw).includes(normalizeAuraText(palavra))) {
            pushPalavra(palavras, palavra);
          }
        }
      }
      if (palavras.length === 0) {
        palavras = inferirPalavrasPorTexto();
      }
      return res.json({ palavras });
    } catch (err: any) {
      console.error("[aura-ai]", err?.message);
      const palavras = inferirPalavrasPorTexto();
      if (palavras.length > 0) return res.json({ palavras });
      return res.status(500).json({ error: "Erro ao analisar texto com IA. Tente novamente." });
    }
  });

  // POST /api/aura/extrair-arquivo â€” extract text from uploaded file (TXT or PDF) for AI analysis
  app.post("/api/aura/extrair-arquivo", upload.single("arquivo"), async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const avaliadoMembroId = String(req.body?.avaliado_membro_id || "");
    if (!avaliadoMembroId) return res.status(400).json({ error: "Informe o membro avaliado para processar o arquivo." });
    if (!(await requireAuraRegisterTarget(req, res, avaliadoMembroId))) return;
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
        return res.status(400).json({ error: "Tipo de arquivo nÃ£o suportado. Use PDF ou TXT." });
      }

      texto = texto.replace(/\s+/g, " ").trim();
      if (texto.length > 4000) texto = texto.slice(0, 4000) + "...";
      if (texto.length < 5) return res.status(400).json({ error: "NÃ£o foi possÃ­vel extrair texto do arquivo." });

      return res.json({ texto });
    } catch (err: any) {
      console.error("[aura-arquivo]", err?.message);
      return res.status(500).json({ error: "Erro ao processar o arquivo." });
    }
  });

  // POST /api/aura/avaliar â€” submit an evaluation (one per pair, no updates)
  app.post("/api/aura/transcrever-audio", auraAudioUpload.single("audio"), async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const avaliadoMembroId = String(req.body?.avaliado_membro_id || "");
    if (!avaliadoMembroId) return res.status(400).json({ error: "Informe o membro avaliado para processar o áudio." });
    if (!(await requireAuraRegisterTarget(req, res, avaliadoMembroId))) return;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum Ã¡udio enviado." });

    try {
      const texto = await transcribeAuraAudioFile(file);
      if (texto.length < 3) return res.status(400).json({ error: "NÃ£o foi possÃ­vel entender o Ã¡udio." });
      return res.json({ texto: texto.length > 4000 ?texto.slice(0, 4000) + "..." : texto });
    } catch (err: any) {
      console.error("[aura-audio]", err?.message);
      return res.status(500).json({ error: "NÃ£o foi possÃ­vel processar o Ã¡udio. Tente novamente." });
    }
  });

  app.post("/api/aura/avaliar", async (req: any, res) => {
    if (!(req.session as any).directusUserId) return res.status(401).json({ error: "NÃ£o autenticado" });
    if (await blockVitrineOnlyAura(req, res)) return;
    const membroId = (req.session as any).membroId as string | null;
    if (!membroId) return res.status(400).json({ error: "Membro nÃ£o encontrado" });

    const { avaliado_membro_id, palavras } = req.body;
    if (!avaliado_membro_id || !Array.isArray(palavras) || palavras.length < 1 || palavras.length > 3) {
      return res.status(400).json({ error: "Informe entre 1 e 3 termos" });
    }
    if (!palavras.every((p: unknown) => typeof p === "string" && p.trim().length > 0)) {
      return res.status(400).json({ error: "Todos os termos devem ser texto nÃ£o vazio" });
    }
    if (avaliado_membro_id === membroId) {
      return res.status(400).json({ error: "VocÃª nÃ£o pode avaliar a si mesmo" });
    }
    if (!(await requireAuraRegisterTarget(req, res, avaliado_membro_id))) return;
    // Block duplicate evaluations
    const existing = await storage.getAuraAvaliacaoByPair(membroId, avaliado_membro_id);
    if (existing) {
      return res.status(409).json({ error: "VocÃª jÃ¡ avaliou este membro e nÃ£o pode repetir a avaliaÃ§Ã£o." });
    }
    // Validate all selected terms are in the lexicon.
    for (const p of palavras) {
      if (!classificarPalavra(p)) return res.status(400).json({ error: `Termo nÃ£o reconhecido: ${p}` });
    }
    const result = await storage.upsertAuraAvaliacao(membroId, avaliado_membro_id, palavras);
    return res.json(result);
  });

  return httpServer;
}

