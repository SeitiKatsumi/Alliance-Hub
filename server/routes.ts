Y��x-���jם��i��+��j[h��ܢ����4��<�wo+^����םimport { canCorrectQuotaTransfer, quotaCorrectionSchema } from "../shared/quota-correction";
﻿import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import type { Response } from "express";
import { hashInviteToken, storage } from "./storage";
import { createUserSchema, updateUserSchema, insertAgendaTarefaSchema, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS, permissionsForRole, nucleoTecnicoDocs, aliancaDocs, biaMouAceites, biaUserPermissions, membroComunidadeMae, userUsageEvents, users as usersTable, opaInteresses, agendaTarefas, convitesComunidade, biaAprovacoes, biaDiretorSolicitacoes, biaSocioSolicitacoes, chamadasAlianca, auraAvaliacoes, anuncios } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { db } from "./db";
import { and, eq, desc, sql } from "drizzle-orm";
import { getStripeClient } from "./stripe";
import { PinbankClient, type PinbankChargePayload, type PinbankChargeQueryPayload, type PinbankCompanyOnboardingPayload, type PinbankDocumentPayload } from "./pinbank-client";
import { registerPinbankRoutes } from "./pinbank/routes";
import { PNG } from "pngjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { deflateSync } from "zlib";
import { buildComparableMarketAnalysis, marketAreaRange, marketDistanceKm, marketLocationCandidates, MARKET_RADIUS_KM } from "./market-comparables";
import { normalizeBiaOriginPatch } from "./bia-origin-value";
import { resolveAuraAudioMetadata } from "./aura-audio";
import {
  assertProtectedValorOrigemEntriesUnchanged,
  isProtectedValorOrigemEntry,
  protectedValorOrigemSnapshot,
  reconcileValorOrigemEntries,
} from "./valor-origem-sync";
import { normalizeCarteiraAlertUpdate } from "./carteira-alertas";
import { biaActivationRequirements, biaDeletionTargets, biaFormalParticipantIds, canCreateObaForBia } from "./bia-lifecycle";
import {
  activeAgendaAlertCount,
  agendaAlertBadge,
  dedupeAgendaAlertItems,
  sortAgendaAlertItems,
  type AgendaAlertGroup,
  type AgendaAlertItem,
} from "./agenda-alerts";
import { acceptQuotaTransfer } from "./quota-transfer";
import { classifyBusinessFeedContext, scoreBusinessFeedCandidate, sortBusinessFeed } from "./member-business-feed";
import { orderedAdesaoCommunityIds, selectMemberCommunityOrigin } from "@shared/member-community";
import { BUILT_MEMBER_ANNUAL_FEE_BRL, calculateMap, calculatePortfolioTotals, convertPortfolioAmountToBrl, isMembershipActive, membershipEndsAt, normalizeFinancingInstallments, type PortfolioExchangeRate } from "@shared/member-portfolio";
import {
  BIA_GOVERNANCE_MONTHLY_CENTS,
  BIA_MINIMUM_RIG_RATE,
  COMPANY_ANNUAL_PRICE_CENTS,
  COMPANY_INCLUDED_SEATS,
  MEMBER_ANNUAL_PRICE_CENTS,
  calculateRigCents,
  companyCheckoutAmount,
  governanceCompetences,
  governanceStartsAt,
  renewalAfterFreeze,
} from "@shared/monetization";
import { getPublicContributionAreas } from "@shared/contribution-areas";
import { PUBLIC_LABELS } from "@shared/public-labels";
import {
  RO_EVENT_TYPE,
  RO_GUEST_TERMS_VERSION,
  normalizeRoGuestPolicy,
  normalizeRoLocationType,
  normalizeRoSchedule,
  normalizeRoTimeZone,
  roAlertCopy,
} from "@shared/ro";
import {
  STRATEGIC_CELL_BUSINESS_TYPES,
  STRATEGIC_CELL_TYPES,
  normalizeStrategicCellPreferences,
} from "@shared/strategic-cells";
import { RAMOS_SEGMENTOS } from "../client/src/lib/ramos-segmentos";
import { buildPropertyOriginAllocations, normalizePropertyPartners, propertyMapIsComplete, PROPERTY_OWNERSHIP_ACCEPTANCE_VERSION, type PropertyPartnerInput } from "@shared/property-ownership";
import { canAccessBuiltEnvironment, canPublishVitrineProfile } from "@shared/environment-access";
import {
  attachObjectToRegistryTraces,
  attachObjectToObjectTraces,
  attachOriginObjectToRegistryTraces,
  attachRegistryToObjectTraces,
  backfillBusinessTraces,
  ensureBusinessTraceTables,
  getOrCreateTraceForRegistry,
  inheritTraceBetweenRegistries,
  recordTraceEventForObject,
  recordTraceEventForRegistry,
  syncTraceResultForRegistry,
  traceObjectTypeForRegistry,
  traceStageLabel,
  type TraceActor,
} from "./business-trace";
import {
  buildDistributionSchedule,
  buildPulseV2Schedule,
  canReadRestrictedOpportunity,
  createDemandCode,
  createEconomicOpportunityCode,
  createLegacyStableCode,
  createMeetingCode,
  createOpaCode,
  isOpportunityEditable,
  isOpportunityPublic,
  normalizeEconomicOpportunityStage,
  normalizeOpportunityStatus,
  normalizeRoDecisionAction,
  normalizeOpportunityVisibility,
  opportunityInviteDestination,
  opportunityInviteDestinationFromJourney,
  opportunityExpiry,
  publicOpportunityRegistryView,
} from "./opportunity-platform";
import {
  demandResolutionError,
  demandStatusAfterProposalAccepted,
  normalizeDemandProposalStatus,
  normalizeDemandResolutionMode,
  normalizeProposalAmount,
} from "./demand-domain";
import {
  applyConfirmedPropertyMarketEstimate,
  hasUsefulPropertyDocumentText,
  isProfessionalPurpose,
  mergePropertyExtraction,
  nextPropertyAssistantStep,
  normalizeAccountPurposes,
  normalizeDemandClosureReason,
  normalizeDemandDistributionMode,
  normalizeDemandKind,
  normalizeJourneySearchText,
  normalizeInitialPropertyJourney,
  normalizePropertyAssistantStep,
  normalizePropertyIntent,
  normalizePropertyMethod,
  resolveAccountPurposesForInvite,
  scorePropertyProfessionalMatch,
} from "./property-journey";
import {
  canRequestBiaStructuring,
  normalizeAssetOrigin,
  normalizeAssetStage,
  normalizeAssetVisibility,
  normalizeInterestStatus,
  privateAssetView,
  publicAssetView,
  publicDemandView,
} from "./network-opportunities";
import {
  buildOnboardingRecommendationPhotoUrl,
  buildInitialOnboardingProfileFields,
  canAccessOnboardingStep,
  firstPendingOnboardingStep,
  isInitialOnboardingApiAllowed,
  isInitialOnboardingStep,
  nextOnboardingStep,
  normalizeAccountPurposeObjectives,
  normalizeOnboardingPurposes,
  resolveInitialOnboardingInviteCompletion,
  validateOnboardingStepPayload,
  INITIAL_ONBOARDING_REQUIRED_TERM_KEYS,
  type InitialOnboardingStep,
} from "@shared/initial-onboarding";
import { shouldStartMembershipPaymentAfterApproval } from "@shared/community-approval";
import {
  buildCarteiraAlternativas,
  canDeleteCarteiraAsset,
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
  isBiaPlatformAdminRole,
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

function sqlTextArray(values: readonly unknown[]) {
  return sql`ARRAY[${sql.join(values.map((value) => sql`${String(value)}`), sql`, `)}]::text[]`;
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
    { field: "nome_completo", type: "string", meta: { interface: "input", display: "raw", hidden: false, note: "Nome civil completo para formalizacao" }, schema: { is_nullable: true } },
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
      signal: AbortSignal.timeout(12_000),
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
      signal: AbortSignal.timeout(12_000),
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

function carteiraDocumentApiUrl(imovelId: any, documentoId: any) {
  if (!imovelId || !documentoId) return null;
  return `/api/carteira/imoveis/${encodeURIComponent(String(imovelId))}/documentos/${encodeURIComponent(String(documentoId))}/arquivo`;
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus bulk patch error ${res.status}: ${body}`);
  }
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus bulk delete error ${res.status}: ${body}`);
  }
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
      employee_membro_id text,
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
  await db.execute(sql`ALTER TABLE company_employee_accounts ADD COLUMN IF NOT EXISTS employee_membro_id text`);
  await db.execute(sql`ALTER TABLE company_employee_accounts ADD COLUMN IF NOT EXISTS updated_by_user_id text`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_company_employee_accounts_owner ON company_employee_accounts (owner_user_id, created_at DESC)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_company_employee_accounts_employee ON company_employee_accounts (employee_user_id)`);
}

async function ensureCompanyPlanSubscriptionsTable() {
  await ensureCompanyEmployeeAccountsTable();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_plan_subscriptions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id text NOT NULL UNIQUE,
      plan_code text NOT NULL DEFAULT 'empresa',
      status text NOT NULL DEFAULT 'disponivel',
      billing_mode text NOT NULL DEFAULT 'annual',
      price_cents integer NOT NULL DEFAULT 383640,
      currency text NOT NULL DEFAULT 'BRL',
      provider text,
      provider_subscription_id text,
      payment_external_id text,
      checkout_type text,
      policy_version integer NOT NULL DEFAULT 1,
      seat_limit integer NOT NULL DEFAULT 3,
      renewal_price_cents integer NOT NULL DEFAULT 383640,
      legacy_free boolean NOT NULL DEFAULT false,
      activated_at timestamp,
      current_period_start timestamp DEFAULT now() NOT NULL,
      current_period_end timestamp,
      billing_suspended boolean NOT NULL DEFAULT false,
      frozen_at timestamp,
      free_until timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS activated_at timestamp`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS payment_external_id text`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS checkout_type text`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS policy_version integer NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS seat_limit integer NOT NULL DEFAULT 3`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS renewal_price_cents integer NOT NULL DEFAULT 383640`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS legacy_free boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS billing_suspended boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ADD COLUMN IF NOT EXISTS frozen_at timestamp`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ALTER COLUMN status SET DEFAULT 'disponivel'`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ALTER COLUMN billing_mode SET DEFAULT 'annual'`);
  await db.execute(sql`ALTER TABLE company_plan_subscriptions ALTER COLUMN price_cents SET DEFAULT 383640`);
  await db.execute(sql`
    UPDATE company_plan_subscriptions
    SET legacy_free = true
    WHERE billing_mode = 'gratuito' AND price_cents = 0
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_company_plan_subscriptions_owner ON company_plan_subscriptions (owner_user_id)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_company_plan_payment_external ON company_plan_subscriptions (provider, payment_external_id) WHERE payment_external_id IS NOT NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_company_plan_subscriptions_status ON company_plan_subscriptions (status)`);
}

async function ensureMonetizationTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS monetization_policies (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL,
      version integer NOT NULL,
      amount_cents integer,
      minimum_rate numeric(8, 6),
      currency text NOT NULL DEFAULT 'BRL',
      effective_from timestamp DEFAULT now() NOT NULL,
      status text NOT NULL DEFAULT 'active',
      approved_by_user_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT monetization_policies_code_version_uniq UNIQUE (code, version)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_billing_terms (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL UNIQUE,
      policy_id text NOT NULL,
      origin_value numeric(16, 2) NOT NULL,
      rig_rate numeric(8, 6) NOT NULL,
      rig_amount_cents integer NOT NULL,
      governance_amount_cents integer NOT NULL DEFAULT 60000,
      institutional_start_at timestamp NOT NULL,
      billing_resume_at timestamp,
      status text NOT NULL DEFAULT 'draft',
      approved_by_user_id text,
      approved_at timestamp,
      snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE bia_billing_terms ADD COLUMN IF NOT EXISTS billing_resume_at timestamp`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bia_billing_charges (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bia_id text NOT NULL,
      terms_id text NOT NULL,
      charge_type text NOT NULL,
      competence text NOT NULL,
      amount_cents integer NOT NULL,
      due_at timestamp NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      provider text,
      provider_external_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT bia_billing_charges_term_type_competence_uniq UNIQUE (terms_id, charge_type, competence),
      CONSTRAINT bia_billing_charges_provider_external_uniq UNIQUE (provider, provider_external_id)
    )
  `);
  const policies = [
    ["MEMBER_ANNUAL", MEMBER_ANNUAL_PRICE_CENTS, null],
    ["COMPANY_ANNUAL", COMPANY_ANNUAL_PRICE_CENTS, null],
    ["BIA_RIG", null, BIA_MINIMUM_RIG_RATE],
    ["BIA_GOVERNANCE_MONTHLY", BIA_GOVERNANCE_MONTHLY_CENTS, null],
  ] as const;
  for (const [code, amount, minimumRate] of policies) {
    await db.execute(sql`
      INSERT INTO monetization_policies (code, version, amount_cents, minimum_rate, currency, status)
      VALUES (${code}, 1, ${amount}, ${minimumRate}, 'BRL', 'active')
      ON CONFLICT (code, version) DO NOTHING
    `);
  }
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bia_billing_charges_due ON bia_billing_charges (status, due_at)`);
}

async function ensureTaxonomyTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS taxonomy_public_labels (
      code text PRIMARY KEY,
      display_name text NOT NULL,
      description text,
      updated_by_user_id text,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contribution_area_segments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      contribution_area_value text NOT NULL,
      segment_code text NOT NULL,
      created_by_user_id text,
      created_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT contribution_area_segments_uniq UNIQUE (contribution_area_value, segment_code)
    )
  `);
}

let strategicCellTablesPromise: Promise<void> | null = null;

function ensureStrategicCellTables() {
  strategicCellTablesPromise ??= ensureStrategicCellTablesInternal().catch((error) => {
    strategicCellTablesPromise = null;
    throw error;
  });
  return strategicCellTablesPromise;
}

async function ensureStrategicCellTablesInternal() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cell_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      public_name text NOT NULL,
      short_description text NOT NULL,
      help_text text,
      icon_key text,
      status text NOT NULL DEFAULT 'ACTIVE',
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cell_markets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      strategic_cell_type_id uuid NOT NULL REFERENCES strategic_cell_types(id) ON DELETE RESTRICT,
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      public_name text NOT NULL,
      short_description text,
      help_text text,
      status text NOT NULL DEFAULT 'ACTIVE',
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cells (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id text NOT NULL,
      strategic_cell_type_id uuid NOT NULL REFERENCES strategic_cell_types(id) ON DELETE RESTRICT,
      name text NOT NULL,
      description text,
      proposal_reason text,
      coordinator_user_id text,
      coordinator_membro_id text,
      status text NOT NULL DEFAULT 'ACTIVE',
      created_by_user_id text NOT NULL,
      created_by_membro_id text,
      approved_by_user_id text,
      approved_by_membro_id text,
      approved_at timestamp,
      decision_reason text,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT strategic_cells_status_check CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'ARCHIVED'))
    )
  `);
  await db.execute(sql`ALTER TABLE strategic_cells ALTER COLUMN status SET DEFAULT 'ACTIVE'`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cell_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      strategic_cell_id uuid NOT NULL REFERENCES strategic_cells(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      membro_id text NOT NULL,
      source text NOT NULL DEFAULT 'manual',
      status text NOT NULL DEFAULT 'INTERESTED',
      joined_at timestamp DEFAULT now() NOT NULL,
      approved_at timestamp,
      approved_by_user_id text,
      approved_by_membro_id text,
      updated_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT strategic_cell_memberships_status_check CHECK (status IN ('INTERESTED', 'PENDING', 'ACTIVE', 'REJECTED', 'LEFT')),
      CONSTRAINT strategic_cell_memberships_cell_user_uniq UNIQUE (strategic_cell_id, user_id)
    )
  `);
  await db.execute(sql`ALTER TABLE strategic_cell_memberships ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cell_preferences (
      user_id text PRIMARY KEY,
      membro_id text NOT NULL,
      cell_type_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
      business_type_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
      source text NOT NULL DEFAULT 'profile',
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS strategic_cell_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      strategic_cell_id uuid NOT NULL REFERENCES strategic_cells(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      actor_user_id text,
      actor_membro_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS strategic_cells_active_type_uniq ON strategic_cells (community_id, strategic_cell_type_id) WHERE status = 'ACTIVE'`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_strategic_cells_community ON strategic_cells (community_id, status, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_strategic_cell_memberships_member ON strategic_cell_memberships (membro_id, status)`);

  for (let index = 0; index < STRATEGIC_CELL_TYPES.length; index += 1) {
    const type = STRATEGIC_CELL_TYPES[index];
    await db.execute(sql`
      INSERT INTO strategic_cell_types (code, name, public_name, short_description, help_text, icon_key, status, display_order)
      VALUES (${type.code}, ${type.name}, ${type.publicName}, ${type.description}, ${type.description}, ${type.iconKey}, 'ACTIVE', ${index + 1})
      ON CONFLICT (code) DO NOTHING
    `);
  }
  const typeRows = (await db.execute(sql`SELECT id::text, code FROM strategic_cell_types`)).rows as Array<{ id: string; code: string }>;
  const typeIds = new Map(typeRows.map((row) => [row.code, row.id]));
  for (let index = 0; index < STRATEGIC_CELL_BUSINESS_TYPES.length; index += 1) {
    const [typeCode, code, name, publicName] = STRATEGIC_CELL_BUSINESS_TYPES[index];
    const typeId = typeIds.get(typeCode);
    if (!typeId) continue;
    await db.execute(sql`
      INSERT INTO strategic_cell_markets (strategic_cell_type_id, code, name, public_name, short_description, status, display_order)
      VALUES (${typeId}, ${code}, ${name}, ${publicName}, ${publicName}, 'ACTIVE', ${index + 1})
      ON CONFLICT (code) DO NOTHING
    `);
  }
  await db.execute(sql`UPDATE strategic_cell_markets SET status = 'ARCHIVED', updated_at = now() WHERE code IN ('REAL_ESTATE_EQUITY', 'CLUB_DEAL')`);
}

async function ensureCommunityStrategicCells(communityId: string) {
  const normalizedCommunityId = String(communityId || "").trim();
  if (!normalizedCommunityId) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`strategic-cells:${normalizedCommunityId}`}))`);
    const activated = await tx.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (c.strategic_cell_type_id) c.id
        FROM strategic_cells c
        WHERE c.community_id = ${normalizedCommunityId}
          AND c.status IN ('DRAFT', 'PENDING_APPROVAL', 'SUSPENDED')
          AND NOT EXISTS (
            SELECT 1 FROM strategic_cells active
            WHERE active.community_id = c.community_id
              AND active.strategic_cell_type_id = c.strategic_cell_type_id
              AND active.status = 'ACTIVE'
          )
        ORDER BY c.strategic_cell_type_id, c.created_at DESC
      )
      UPDATE strategic_cells c
      SET status = 'ACTIVE', approved_at = COALESCE(c.approved_at, now()), updated_at = now()
      FROM latest
      WHERE c.id = latest.id
      RETURNING c.id::text
    `);
    const created = await tx.execute(sql`
      INSERT INTO strategic_cells (
        community_id, strategic_cell_type_id, name, description, status,
        created_by_user_id, approved_at
      )
      SELECT ${normalizedCommunityId}, t.id, t.public_name, t.short_description, 'ACTIVE', 'system', now()
      FROM strategic_cell_types t
      WHERE t.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM strategic_cells c
          WHERE c.community_id = ${normalizedCommunityId}
            AND c.strategic_cell_type_id = t.id
            AND c.status = 'ACTIVE'
        )
      ON CONFLICT DO NOTHING
      RETURNING id::text
    `);
    for (const row of [...(activated.rows || []), ...(created.rows || [])] as any[]) {
      await tx.execute(sql`
        INSERT INTO strategic_cell_events (strategic_cell_id, event_type, metadata)
        VALUES (${String(row.id)}, 'STRUCTURE_ENSURED', ${JSON.stringify({ community_id: normalizedCommunityId })}::jsonb)
      `);
    }
  });
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
      acao_registrada text,
      acao_registrada_em timestamp,
      acao_registrada_por_user_id text,
      ignorado_em timestamp,
      ignorado_por_user_id text,
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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carteira_imovel_socios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
      user_id text,
      membro_id text,
      nome text NOT NULL,
      email text,
      map_percentual numeric(7,4) NOT NULL CHECK (map_percentual > 0 AND map_percentual <= 100),
      status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'revogado')),
      aceite_versao integer NOT NULL DEFAULT 1,
      aceite_evidencias jsonb NOT NULL DEFAULT '{}'::jsonb,
      convite_token_hash text,
      convite_expira_em timestamp,
      aceite_em timestamp,
      recusado_em timestamp,
      convidado_por_user_id text,
      convidado_por_membro_id text,
      criado_em timestamp DEFAULT now() NOT NULL,
      atualizado_em timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`ALTER TABLE carteira_imovel_socios ADD COLUMN IF NOT EXISTS aceite_evidencias jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await db.execute(sq�M��kh��춻�q�^t     return palavras;
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
      await recordMembershipAnnuality(convite, "manual", `manual:${convite.token}`);

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

      if (convite.tipo === "onboarding_inicial" && convite.termos_aceitos_em) {
        const repaired = await completeInitialOnboardingInvite(convite);
        return res.json({ success: true, convite: repaired });
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
      const tiposConviteValidos = ["unificado", "vitrine", "capital"];
      const tipoConvite = tiposConviteValidos.includes(String(req.body?.tipo || ""))
        ? String(req.body.tipo)
        : "unificado";

      // Check if there's already an active invite (skip if force=true)
      if (!forceNew) {
        const existing = await storage.getActiveConviteLinkByUserId(userId);
        if (existing && new Date() < new Date(existing.expires_at) && ((existing as any).tipo || "vitrine") === tipoConvite) {
          const rawDomain = process.env.APP_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://app.builtalliances.com");
          return res.json({ ...existing, link: `${rawDomain}/login?convite=${existing.token}` });
        }
      }

      const preferredCommunityId = req.body?.comunidade_id ? String(req.body.comunidade_id) : null;
      const origin = preferredCommunityId
        ? (await getMembroComunidadesLinks(String(membroId || "")).catch(() => [])).find((item: any) => String(item.id) === preferredCommunityId) || await resolveInviteOrigin(req)
        : await resolveInviteOrigin(req);
      const comunidadeId = origin?.id || null;
      const comunidadeNome = origin?.nome || null;

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
      const sourceType = (convite as any).source_type || null;
      const sourceId = (convite as any).source_id || null;
      const registry = sourceType === "oba" && sourceId ? await getOpportunityRegistry(String(sourceId)) : null;
      if (sourceType === "oba" && !registry) return res.status(404).json({ error: "A OBA deste convite não está mais disponível." });
      res.json({
        gerador_nome: convite.gerador_nome,
        comunidade_nome: convite.comunidade_nome,
        tipo: (convite as any).tipo || "vitrine",
        expires_at: convite.expires_at,
        source_type: sourceType,
        source_id: sourceId,
        source_title: registry?.titulo || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/convite-publico/:token/resgatar", async (req, res) => {
    try {
      const session = (req.session as any) || {};
      if (!session.directusUserId && !session.userId) return res.status(401).json({ error: "Entre na sua conta para abrir a OBA." });
      const convite = await storage.getConviteLinkByToken(req.params.token);
      if (!convite) return res.status(404).json({ error: "Convite não encontrado." });
      if (new Date() > new Date(convite.expires_at)) return res.status(400).json({ error: "Este convite expirou." });
      const destination = opportunityInviteDestination((convite as any).source_type, (convite as any).source_id);
      if (!destination) return res.status(400).json({ error: "Este convite não está vinculado a uma OBA." });
      const localUser = session.email ? await storage.getUserByEmail(String(session.email)) : null;
      const userId = String(localUser?.id || session.directusUserId || session.userId);
      if (convite.status !== "ativo" && !(convite.status === "usado" && String(convite.usado_por_user_id || "") === userId)) {
        return res.status(400).json({ error: "Este convite já foi utilizado." });
      }
      if (convite.status === "ativo") {
        const claim = await db.execute(sql`
          UPDATE convites_link
          SET status = 'usado', usado_por_user_id = ${userId}, usado_em = now()
          WHERE id = ${String(convite.id)} AND status = 'ativo'
          RETURNING id
        `);
        if (!claim.rows?.[0]) return res.status(400).json({ error: "Este convite já foi utilizado." });
        const registry = await getOpportunityRegistry(String((convite as any).source_id));
        if (registry) await recordOpportunityEvent(String(registry.id), req, "convite_externo_utilizado", "Convite externo da OBA utilizado");
      }
      return res.json({ success: true, redirect_url: destination });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
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
      const renewalToken = invoice.metadata?.convite_token
        || invoice.parent?.subscription_details?.metadata?.convite_token
        || invoice.subscription_details?.metadata?.convite_token;
      if (renewalToken) {
        const convite = await storage.getConviteByToken(String(renewalToken)).catch(() => null);
        if (convite) await recordMembershipAnnuality(convite, "stripe", String(invoice.id));
        return res.status(200).json({ received: true });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const token = subscription.metadata?.convite_token;
      if (token) {
        const convite = await storage.getConviteByToken(String(token)).catch(() => null);
        if (convite) {
          await db.execute(sql`
            UPDATE membro_anuidades SET status = 'canceled', updated_at = now()
            WHERE membro_id = ${String(convite.candidato_membro_id)} AND provider = 'stripe' AND status = 'active'
          `);
        }
      }
      return res.status(200).json({ received: true });
    }

    if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
      const charge = event.data.object;
      const paymentId = String(charge.payment_intent || charge.id || "");
      if (paymentId) {
        await db.execute(sql`
          UPDATE company_plan_subscriptions
          SET status = ${event.type === "charge.refunded" ? "reembolsado" : "chargeback"}, updated_at = now()
          WHERE provider = 'stripe' AND payment_external_id = ${paymentId}
        `).catch((error: any) => console.warn("[stripe/webhook] Falha ao revogar Plano Empresa:", error?.message || error));
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const companyOwnerUserId: string | undefined = session.metadata?.company_plan_owner_user_id || undefined;
      if (companyOwnerUserId) {
        if (session.payment_status !== "paid") return res.status(200).json({ received: true });
        try {
          await activateCompanyPlanPayment(
            companyOwnerUserId,
            "stripe",
            String(session.payment_intent || session.id),
            session.metadata?.company_checkout_type || "full",
          );
          return res.status(200).json({ received: true });
        } catch (error: any) {
          console.error("[stripe/webhook] company plan activation error:", error?.message || error);
          return res.status(500).json({ error: "Erro ao ativar o Plano Empresa" });
        }
      }
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
          await recordMembershipAnnuality(convite, "stripe", String(session.id));
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
        await recordMembershipAnnuality(convite, "stripe", String(session.id));
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
    const companyReference = String(payment.externalReference || "");

    console.log(`[asaas/webhook] event=${event} paymentId=${payment.id} status=${payment.status}`);

    // Only act on confirmed/received payments
    const ACTIVATION_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
    if (!ACTIVATION_EVENTS.includes(event)) {
      if (["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"].includes(event)) {
        const status = event === "PAYMENT_REFUNDED" ? "refunded" : "disputed";
        await db.execute(sql`
          UPDATE membro_anuidades SET status = ${status}, ends_at = LEAST(ends_at, now()), updated_at = now()
          WHERE provider = 'asaas' AND external_id = ${String(payment.id || "")}
        `).catch((error: any) => console.warn("[asaas/webhook] Falha ao revogar anuidade:", error?.message || error));
        if (companyReference.startsWith("company_plan:")) {
          const ownerUserId = companyReference.split(":")[1];
          await db.execute(sql`
            UPDATE company_plan_subscriptions
            SET status = ${status === "refunded" ? "reembolsado" : "chargeback"}, updated_at = now()
            WHERE owner_user_id = ${ownerUserId} AND provider = 'asaas'
          `).catch((error: any) => console.warn("[asaas/webhook] Falha ao revogar Plano Empresa:", error?.message || error));
        }
      }
      return res.status(200).json({ received: true });
    }

    try {
      // Strategy 1: match by externalReference (set this to the convite token when creating dynamic payments)
      let convite: any = null;
      const extRef: string | null = payment.externalReference || null;
      if (extRef?.startsWith("company_plan:")) {
        const [, ownerUserId, checkoutType] = extRef.split(":");
        if (!ownerUserId) return res.status(200).json({ received: true });
        await activateCompanyPlanPayment(ownerUserId, "asaas", String(payment.id || extRef), checkoutType || "full");
        return res.status(200).json({ received: true });
      }
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
        await recordMembershipAnnuality(convite, "asaas", String(payment.id || extRef || convite.token));
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
      await recordMembershipAnnuality(convite, "asaas", String(payment.id || extRef || convite.token));
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
