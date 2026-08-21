import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb, timestamp, serial, numeric, date, unique, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { BiaAccessMatrix } from "./bia-access";
import type { CompanyAccessMatrix } from "./company-access";

export const MODULE_KEYS = [
  "oportunidades",
  "bias",
  "calculadora",
  "fluxo_caixa",
  "membros",
  "aura",
  "painel",
  "admin",
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];
export type PermissionLevel = "none" | "view" | "edit";
export type ModulePermissions = Record<ModuleKey, PermissionLevel>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  oportunidades: "Oportunidades",
  bias: "BIAS - Alianças",
  calculadora: "Calculadora DM",
  fluxo_caixa: "Fluxo de Caixa",
  membros: "Membros",
  aura: "AURA Built",
  painel: "Meu Painel",
  admin: "Administração",
};

export const DEFAULT_PERMISSIONS: ModulePermissions = {
  oportunidades: "view",
  bias: "view",
  calculadora: "none",
  fluxo_caixa: "none",
  membros: "view",
  aura: "view",
  painel: "view",
  admin: "none",
};

export const ADMIN_PERMISSIONS: ModulePermissions = {
  oportunidades: "edit",
  bias: "edit",
  calculadora: "edit",
  fluxo_caixa: "edit",
  membros: "edit",
  aura: "edit",
  painel: "edit",
  admin: "edit",
};

export const ROLE_PERMISSIONS: Record<string, ModulePermissions> = {
  user: DEFAULT_PERMISSIONS,
  manager: {
    ...DEFAULT_PERMISSIONS,
    oportunidades: "edit",
    bias: "edit",
    membros: "edit",
    painel: "edit",
  },
  membro: {
    oportunidades: "edit",
    bias: "edit",
    calculadora: "view",
    fluxo_caixa: "edit",
    membros: "view",
    aura: "view",
    painel: "view",
    admin: "none",
  },
  investidor: {
    oportunidades: "view",
    bias: "view",
    calculadora: "view",
    fluxo_caixa: "view",
    membros: "view",
    aura: "view",
    painel: "view",
    admin: "none",
  },
  aliado: {
    oportunidades: "edit",
    bias: "edit",
    calculadora: "view",
    fluxo_caixa: "edit",
    membros: "edit",
    aura: "view",
    painel: "view",
    admin: "none",
  },
  admin: ADMIN_PERMISSIONS,
};

export function permissionsForRole(role?: string | null): ModulePermissions {
  return ROLE_PERMISSIONS[role || "user"] || DEFAULT_PERMISSIONS;
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nome: text("nome").notNull(),
  email: text("email"),
  google_id: text("google_id"),
  membro_directus_id: text("membro_directus_id"),
  role: text("role").notNull().default("user"),
  permissions: jsonb("permissions").$type<ModulePermissions>().notNull().default(DEFAULT_PERMISSIONS),
  ativo: boolean("ativo").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const companyEmployeeAccounts = pgTable("company_employee_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  owner_user_id: text("owner_user_id").notNull(),
  owner_membro_id: text("owner_membro_id"),
  owner_nome: text("owner_nome"),
  owner_email: text("owner_email"),
  employee_user_id: text("employee_user_id").notNull().unique(),
  cargo: text("cargo"),
  permissions: jsonb("permissions").$type<CompanyAccessMatrix>().notNull(),
  status: text("status").notNull().default("ativo"),
  updated_by_user_id: text("updated_by_user_id"),
  last_login_at: timestamp("last_login_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type CompanyEmployeeAccount = typeof companyEmployeeAccounts.$inferSelect;

export const companyPlanSubscriptions = pgTable("company_plan_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  owner_user_id: text("owner_user_id").notNull().unique(),
  plan_code: text("plan_code").notNull().default("empresa"),
  status: text("status").notNull().default("disponivel"),
  billing_mode: text("billing_mode").notNull().default("gratuito"),
  price_cents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("BRL"),
  provider: text("provider"),
  provider_subscription_id: text("provider_subscription_id"),
  activated_at: timestamp("activated_at"),
  current_period_start: timestamp("current_period_start").defaultNow().notNull(),
  current_period_end: timestamp("current_period_end"),
  free_until: timestamp("free_until"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type CompanyPlanSubscription = typeof companyPlanSubscriptions.$inferSelect;

export const userUsageEvents = pgTable("user_usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id"),
  membro_id: text("membro_id"),
  nome: text("nome"),
  email: text("email"),
  event_type: text("event_type").notNull(),
  path: text("path"),
  label: text("label"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  created_at: timestamp("created_at").defaultNow(),
});

export type UserUsageEvent = typeof userUsageEvents.$inferSelect;

export const inventarioImoveis = pgTable("inventario_imoveis", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  owner_user_id: text("owner_user_id"),
  owner_membro_id: text("owner_membro_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const inventarioLancamentos = pgTable("inventario_lancamentos", {
  id: text("id").primaryKey(),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  owner_user_id: text("owner_user_id"),
  owner_membro_id: text("owner_membro_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const carteiraEventos = pgTable("carteira_eventos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  origem: text("origem").notNull().default("declarada"),
  titulo: text("titulo"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const carteiraDocumentos = pgTable("carteira_documentos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  file_id: text("file_id").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  versao: integer("versao").notNull().default(1),
  emissao: date("emissao"),
  validade: date("validade"),
  origem: text("origem").notNull().default("declarada"),
  status_validacao: text("status_validacao").notNull().default("declarado"),
  dados_extraidos: jsonb("dados_extraidos").$type<Record<string, unknown>>().notNull().default({}),
  observacao: text("observacao"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const carteiraAnalises = pgTable("carteira_analises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  versao_regra: text("versao_regra").notNull().default("carteira-v1"),
  entrada: jsonb("entrada").$type<Record<string, unknown>>().notNull().default({}),
  resultado: jsonb("resultado").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const carteiraAlertas = pgTable("carteira_alertas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  severidade: text("severidade").notNull().default("media"),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  impacto: text("impacto"),
  acao_sugerida: text("acao_sugerida"),
  prazo: date("prazo"),
  status: text("status").notNull().default("aberto"),
  delegado_para_user_id: text("delegado_para_user_id"),
  acao_registrada: text("acao_registrada"),
  acao_registrada_em: timestamp("acao_registrada_em"),
  acao_registrada_por_user_id: text("acao_registrada_por_user_id"),
  ignorado_em: timestamp("ignorado_em"),
  ignorado_por_user_id: text("ignorado_por_user_id"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const carteiraDemandas = pgTable("carteira_demandas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  bia_id: text("bia_id"),
  codigo: text("codigo").unique(),
  autor_tipo: text("autor_tipo").notNull().default("usuario"),
  autor_user_id: text("autor_user_id"),
  autor_membro_id: text("autor_membro_id"),
  tipo_resolucao: text("tipo_resolucao").notNull().default("solicitacao"),
  alternativa: text("alternativa"),
  titulo: text("titulo").notNull(),
  escopo: text("escopo"),
  urgencia: text("urgencia").notNull().default("normal"),
  especialidades: jsonb("especialidades").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("rascunho"),
  responsavel_user_id: text("responsavel_user_id"),
  responsavel_membro_id: text("responsavel_membro_id"),
  visibilidade: text("visibilidade").notNull().default("privada"),
  consentimento_publicacao_at: timestamp("consentimento_publicacao_at"),
  publicada_em: timestamp("publicada_em"),
  expira_em: timestamp("expira_em"),
  resumo_publico: text("resumo_publico"),
  contexto: text("contexto"),
  cidade: text("cidade"),
  estado: text("estado"),
  pais: text("pais"),
  economic_opportunity_id: text("economic_opportunity_id"),
  fluxo_disparo: text("fluxo_disparo").notNull().default("imediato"),
  tipo_demanda: text("tipo_demanda").notNull().default("servico_fornecimento"),
  modalidade_distribuicao: text("modalidade_distribuicao").notNull().default("pulso"),
  estimativa_min: numeric("estimativa_min"),
  estimativa_max: numeric("estimativa_max"),
  estimativa_moeda: text("estimativa_moeda").default("BRL"),
  motivo_encerramento: text("motivo_encerramento"),
  contratado_dentro_built: boolean("contratado_dentro_built"),
  profissional_escolhido_user_id: text("profissional_escolhido_user_id"),
  profissional_escolhido_membro_id: text("profissional_escolhido_membro_id"),
  valor_fechamento: numeric("valor_fechamento"),
  moeda_fechamento: text("moeda_fechamento"),
  prazo_fechamento: text("prazo_fechamento"),
  experiencia_fechamento: text("experiencia_fechamento"),
  encerrada_em: timestamp("encerrada_em"),
  propostas: jsonb("propostas").$type<Array<Record<string, unknown>>>().notNull().default([]),
  documentos: jsonb("documentos").$type<Array<Record<string, unknown>>>().notNull().default([]),
  proximas_etapas: jsonb("proximas_etapas").$type<Array<Record<string, unknown>>>().notNull().default([]),
  opa_id: text("opa_id"),
  resultado: text("resultado"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const userAccountPurposes = pgTable("user_account_purposes", {
  user_id: text("user_id").notNull(),
  membro_id: text("membro_id"),
  purpose: text("purpose").notNull(),
  objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
  comunidade_id: text("comunidade_id"),
  source: text("source").notNull().default("profile"),
  active: boolean("active").notNull().default(true),
  selected_at: timestamp("selected_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [unique().on(table.user_id, table.purpose)]);

export const initialOnboardingJourneys = pgTable("initial_onboarding_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: text("user_id").notNull().unique(),
  membro_id: text("membro_id"),
  convite_link_id: text("convite_link_id"),
  convite_id: text("convite_id"),
  flow_version: integer("flow_version").notNull().default(2),
  status: text("status").notNull().default("em_andamento"),
  current_step: text("current_step").notNull().default("aceites"),
  completed_steps: jsonb("completed_steps").$type<string[]>().notNull().default([]),
  responses: jsonb("responses").$type<Record<string, unknown>>().notNull().default({}),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  start_destination: text("start_destination"),
  terms_ready_at: timestamp("terms_ready_at"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type InitialOnboardingJourney = typeof initialOnboardingJourneys.$inferSelect;

export const propertyAssistantSessions = pgTable("property_assistant_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  owner_user_id: text("owner_user_id").notNull(),
  owner_membro_id: text("owner_membro_id"),
  path: text("path").notNull().default("imovel"),
  method: text("method").notNull().default("manual"),
  step: text("step").notNull().default("cadastro"),
  status: text("status").notNull().default("em_andamento"),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  suggestions: jsonb("suggestions").$type<Record<string, unknown>>().notNull().default({}),
  confirmations: jsonb("confirmations").$type<Record<string, unknown>>().notNull().default({}),
  property_id: text("property_id"),
  opportunity_id: text("opportunity_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const carteiraDemandaDestinatarios = pgTable("carteira_demanda_destinatarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  demanda_id: text("demanda_id").notNull(),
  user_id: text("user_id"),
  membro_id: text("membro_id").notNull(),
  status: text("status").notNull().default("convidado"),
  origem: text("origem").notNull().default("direcionada"),
  acesso_completo: boolean("acesso_completo").notNull().default(true),
  convidado_em: timestamp("convidado_em").defaultNow().notNull(),
  selecionado_em: timestamp("selecionado_em"),
  encerrado_em: timestamp("encerrado_em"),
}, (table) => [unique().on(table.demanda_id, table.membro_id)]);

export const carteiraAcessosTemporarios = pgTable("carteira_acessos_temporarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull(),
  demanda_id: text("demanda_id").notNull(),
  user_id: text("user_id"),
  membro_id: text("membro_id").notNull(),
  nivel: text("nivel").notNull().default("leitura"),
  motivo: text("motivo").notNull().default("demanda_direcionada"),
  concedido_por_user_id: text("concedido_por_user_id"),
  concedido_em: timestamp("concedido_em").defaultNow().notNull(),
  expira_em: timestamp("expira_em"),
  revogado_em: timestamp("revogado_em"),
}, (table) => [unique().on(table.demanda_id, table.membro_id)]);

export const opportunityRegistry = pgTable("opportunity_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source_type: text("source_type").notNull(),
  source_id: text("source_id").notNull(),
  codigo: text("codigo").notNull().unique(),
  tipo: text("tipo").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  autor_tipo: text("autor_tipo").notNull(),
  autor_user_id: text("autor_user_id"),
  autor_membro_id: text("autor_membro_id"),
  autor_bia_id: text("autor_bia_id"),
  criador_user_id: text("criador_user_id"),
  criador_membro_id: text("criador_membro_id"),
  responsavel_user_id: text("responsavel_user_id"),
  responsavel_membro_id: text("responsavel_membro_id"),
  imovel_id: text("imovel_id"),
  bia_id: text("bia_id"),
  status: text("status").notNull().default("rascunho"),
  visibilidade: text("visibilidade").notNull().default("privada"),
  urgencia: text("urgencia").notNull().default("normal"),
  especialidades: jsonb("especialidades").$type<string[]>().notNull().default([]),
  cidade: text("cidade"),
  estado: text("estado"),
  pais: text("pais"),
  publicada_em: timestamp("publicada_em"),
  expira_em: timestamp("expira_em"),
  fluxo_disparo: text("fluxo_disparo").notNull().default("imediato"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
}, (t) => ({
  sourceUniq: unique("opportunity_registry_source_uniq").on(t.source_type, t.source_id),
}));

export const economicOpportunities = pgTable("economic_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: text("codigo").notNull().unique(),
  titulo: text("titulo").notNull(),
  resumo_autorizado: text("resumo_autorizado"),
  tese: text("tese").notNull(),
  finalidade: text("finalidade"),
  parecer: text("parecer"),
  estagio: text("estagio").notNull().default("identificada"),
  criador_user_id: text("criador_user_id"),
  criador_membro_id: text("criador_membro_id"),
  originador_user_id: text("originador_user_id"),
  originador_membro_id: text("originador_membro_id"),
  responsavel_user_id: text("responsavel_user_id"),
  responsavel_membro_id: text("responsavel_membro_id"),
  comunidade_id: text("comunidade_id"),
  comunidade_nome: text("comunidade_nome"),
  cidade: text("cidade"),
  estado: text("estado"),
  pais: text("pais"),
  bia_id: text("bia_id"),
  visibilidade: text("visibilidade").notNull().default("contextual"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const economicOpportunitySources = pgTable("economic_opportunity_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  economic_opportunity_id: text("economic_opportunity_id").notNull(),
  source_type: text("source_type").notNull(),
  source_id: text("source_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
}, (t) => ({
  sourceUniq: unique("economic_opportunity_sources_uniq").on(t.economic_opportunity_id, t.source_type, t.source_id),
}));

export const opportunityRelations = pgTable("opportunity_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  origem_registry_id: text("origem_registry_id").notNull(),
  destino_registry_id: text("destino_registry_id").notNull(),
  tipo: text("tipo").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const opportunityEvents = pgTable("opportunity_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registry_id: text("registry_id").notNull(),
  tipo: text("tipo").notNull(),
  titulo: text("titulo"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const opportunityOutcomes = pgTable("opportunity_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registry_id: text("registry_id").notNull().unique(),
  resultado: text("resultado").notNull(),
  participante_user_id: text("participante_user_id"),
  participante_membro_id: text("participante_membro_id"),
  valor: numeric("valor", { precision: 16, scale: 2 }),
  moeda: text("moeda"),
  sem_valor_financeiro: boolean("sem_valor_financeiro").notNull().default(false),
  contratado_em: timestamp("contratado_em"),
  concluido_em: timestamp("concluido_em"),
  observacoes: text("observacoes"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const businessTraceJourneys = pgTable("business_trace_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: text("codigo").notNull().unique(),
  titulo: text("titulo"),
  root_type: text("root_type").notNull(),
  root_id: text("root_id").notNull(),
  root_registry_id: text("root_registry_id"),
  status: text("status").notNull().default("ativa"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
}, (t) => ({
  rootUniq: unique("business_trace_journeys_root_uniq").on(t.root_type, t.root_id),
}));

export const businessTraceNodes = pgTable("business_trace_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journey_id: text("journey_id").notNull(),
  registry_id: text("registry_id"),
  object_type: text("object_type").notNull(),
  object_id: text("object_id").notNull(),
  object_code: text("object_code"),
  titulo: text("titulo"),
  status: text("status"),
  papel: text("papel").notNull().default("etapa"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
}, (t) => ({
  objectUniq: unique("business_trace_nodes_object_uniq").on(t.journey_id, t.object_type, t.object_id),
}));

export const businessTraceLinks = pgTable("business_trace_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journey_id: text("journey_id").notNull(),
  source_node_id: text("source_node_id"),
  destination_node_id: text("destination_node_id").notNull(),
  relation_type: text("relation_type").notNull(),
  justificativa: text("justificativa"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const businessTraceEvents = pgTable("business_trace_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journey_id: text("journey_id").notNull(),
  node_id: text("node_id"),
  source_event_id: text("source_event_id"),
  event_type: text("event_type").notNull(),
  titulo: text("titulo").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const businessTraceResults = pgTable("business_trace_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  economic_key: text("economic_key").notNull().unique(),
  source_registry_id: text("source_registry_id"),
  resultado: text("resultado").notNull(),
  participante_user_id: text("participante_user_id"),
  participante_membro_id: text("participante_membro_id"),
  valor: numeric("valor", { precision: 16, scale: 2 }),
  moeda: text("moeda"),
  sem_valor_financeiro: boolean("sem_valor_financeiro").notNull().default(false),
  contratado_em: timestamp("contratado_em"),
  concluido_em: timestamp("concluido_em"),
  observacoes: text("observacoes"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const businessTraceResultLinks = pgTable("business_trace_result_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  result_id: text("result_id").notNull(),
  journey_id: text("journey_id").notNull(),
  node_id: text("node_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
}, (t) => ({
  resultJourneyUniq: unique("business_trace_result_links_result_journey_uniq").on(t.result_id, t.journey_id),
}));

export const opportunityDistributionFlows = pgTable("opportunity_distribution_flows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registry_id: text("registry_id").notNull().unique(),
  modo: text("modo").notNull().default("imediato"),
  status: text("status").notNull().default("ativo"),
  comunidade_id: text("comunidade_id"),
  territorio: text("territorio"),
  estado: text("estado"),
  pais: text("pais"),
  onda_atual: integer("onda_atual").notNull().default(0),
  proxima_execucao_em: timestamp("proxima_execucao_em"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const opportunityDistributionWaves = pgTable("opportunity_distribution_waves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flow_id: text("flow_id").notNull(),
  ordem: integer("ordem").notNull(),
  audiencia: text("audiencia").notNull(),
  status: text("status").notNull().default("pendente"),
  agendada_em: timestamp("agendada_em"),
  executada_em: timestamp("executada_em"),
  destinatarios: integer("destinatarios").notNull().default(0),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
}, (t) => ({
  flowOrderUniq: unique("opportunity_distribution_waves_flow_order_uniq").on(t.flow_id, t.ordem),
}));

export const opportunityDistributionDeliveries = pgTable("opportunity_distribution_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wave_id: text("wave_id").notNull(),
  registry_id: text("registry_id").notNull(),
  user_id: text("user_id"),
  membro_id: text("membro_id"),
  canal: text("canal").notNull(),
  status: text("status").notNull().default("enviado"),
  enviado_em: timestamp("enviado_em").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export const opportunityMeetings = pgTable("opportunity_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: text("codigo").notNull().unique(),
  titulo: text("titulo").notNull(),
  data: date("data").notNull(),
  hora: text("hora"),
  link: text("link"),
  pauta: text("pauta"),
  publico: text("publico").notNull().default("convidados"),
  ata: text("ata"),
  decisoes: jsonb("decisoes").$type<Array<Record<string, unknown>>>().notNull().default([]),
  proximos_passos: jsonb("proximos_passos").$type<Array<Record<string, unknown>>>().notNull().default([]),
  status: text("status").notNull().default("agendada"),
  organizador_user_id: text("organizador_user_id"),
  organizador_membro_id: text("organizador_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

export const opportunityMeetingItems = pgTable("opportunity_meeting_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meeting_id: text("meeting_id").notNull(),
  registry_id: text("registry_id").notNull(),
  papel: text("papel").notNull().default("principal"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
}, (t) => ({
  itemUniq: unique("opportunity_meeting_items_uniq").on(t.meeting_id, t.registry_id),
}));

export const opportunityMeetingDecisions = pgTable("opportunity_meeting_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meeting_id: text("meeting_id").notNull(),
  economic_opportunity_id: text("economic_opportunity_id").notNull(),
  acao: text("acao").notNull(),
  parecer: text("parecer"),
  status: text("status").notNull().default("executada"),
  executado_por_user_id: text("executado_por_user_id"),
  executado_por_membro_id: text("executado_por_membro_id"),
  demanda_gerada_id: text("demanda_gerada_id"),
  bia_solicitacao_id: text("bia_solicitacao_id"),
  resultado: jsonb("resultado").$type<Record<string, unknown>>().notNull().default({}),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
}, (t) => ({
  decisionUniq: unique("opportunity_meeting_decisions_uniq").on(t.meeting_id, t.economic_opportunity_id),
}));

export const opportunityMeetingParticipants = pgTable("opportunity_meeting_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meeting_id: text("meeting_id").notNull(),
  user_id: text("user_id"),
  membro_id: text("membro_id"),
  nome: text("nome"),
  papel: text("papel"),
  confirmacao: text("confirmacao").notNull().default("pendente"),
  presenca: text("presenca").notNull().default("nao_informada"),
  decisao: text("decisao"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const opportunityFeedback = pgTable("opportunity_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registry_id: text("registry_id").notNull(),
  avaliador_user_id: text("avaliador_user_id"),
  avaliador_membro_id: text("avaliador_membro_id"),
  avaliado_membro_id: text("avaliado_membro_id"),
  nota: integer("nota"),
  comentario: text("comentario"),
  origem_externa: boolean("origem_externa").notNull().default(false),
  status_validacao: text("status_validacao").notNull().default("pendente"),
  validado_por_user_id: text("validado_por_user_id"),
  validado_em: timestamp("validado_em"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

export const carteiraAcessos = pgTable("carteira_acessos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imovel_id: text("imovel_id").notNull().references(() => inventarioImoveis.id, { onDelete: "cascade" }),
  user_id: text("user_id"),
  membro_id: text("membro_id"),
  nivel: text("nivel").notNull().default("leitura"),
  concedido_por_user_id: text("concedido_por_user_id"),
  concedido_por_membro_id: text("concedido_por_membro_id"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
}, (t) => ({
  imovelUserUniq: unique("carteira_acessos_imovel_user_uniq").on(t.imovel_id, t.user_id),
  imovelMembroUniq: unique("carteira_acessos_imovel_membro_uniq").on(t.imovel_id, t.membro_id),
}));

export type InventarioImovel = typeof inventarioImoveis.$inferSelect;
export type InventarioLancamento = typeof inventarioLancamentos.$inferSelect;
export type CarteiraEvento = typeof carteiraEventos.$inferSelect;
export type CarteiraDocumento = typeof carteiraDocumentos.$inferSelect;
export type CarteiraAnalise = typeof carteiraAnalises.$inferSelect;
export type CarteiraAlerta = typeof carteiraAlertas.$inferSelect;
export type CarteiraDemanda = typeof carteiraDemandas.$inferSelect;
export type EconomicOpportunity = typeof economicOpportunities.$inferSelect;
export type CarteiraAcesso = typeof carteiraAcessos.$inferSelect;

export const membroComunidadeMae = pgTable("membro_comunidade_mae", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  membro_id: text("membro_id").notNull().unique(),
  comunidade_id: text("comunidade_id").notNull(),
  source: text("source").notNull().default("manual_seed"),
  locked_at: timestamp("locked_at").defaultNow().notNull(),
  created_by_user_id: varchar("created_by_user_id"),
  created_by_membro_id: text("created_by_membro_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  created_at: timestamp("created_at").defaultNow(),
});

export type MembroComunidadeMae = typeof membroComunidadeMae.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
});

export const createUserSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  membro_directus_id: z.string().optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "user", "membro", "investidor", "aliado"]).default("user"),
  permissions: z.record(z.enum(["none", "view", "edit"])).optional(),
  ativo: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(4).optional().or(z.literal("")),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const membros = pgTable("membros", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  email: text("email"),
  telefone: text("telefone"),
  whatsapp: text("whatsapp"),
  cidade: text("cidade"),
  estado: text("estado"),
  empresa: text("empresa"),
  cargo: text("cargo"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertMembroSchema = createInsertSchema(membros).omit({
  id: true,
  created_at: true,
});

export type InsertMembro = z.infer<typeof insertMembroSchema>;
export type Membro = typeof membros.$inferSelect;

export const biasProjetos = pgTable("bias_projetos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome_bia: text("nome_bia").notNull(),
  objetivo_alianca: text("objetivo_alianca"),
  observacoes: text("observacoes"),
  localizacao: text("localizacao"),
  autor_bia: text("autor_bia"),
  aliado_built: text("aliado_built"),
  diretor_alianca: text("diretor_alianca"),
  diretor_execucao: text("diretor_execucao"),
  diretor_comercial: text("diretor_comercial"),
  diretor_capital: text("diretor_capital"),
  valor_origem: numeric("valor_origem"),
  divisor_multiplicador: numeric("divisor_multiplicador"),
  perc_autor_opa: numeric("perc_autor_opa"),
  cpp_autor_opa: numeric("cpp_autor_opa"),
  perc_aliado_built: numeric("perc_aliado_built"),
  cpp_aliado_built: numeric("cpp_aliado_built"),
  perc_built: numeric("perc_built"),
  cpp_built: numeric("cpp_built"),
  perc_dir_tecnico: numeric("perc_dir_tecnico"),
  cpp_dir_tecnico: numeric("cpp_dir_tecnico"),
  perc_dir_obras: numeric("perc_dir_obras"),
  cpp_dir_obras: numeric("cpp_dir_obras"),
  perc_dir_comercial: numeric("perc_dir_comercial"),
  cpp_dir_comercial: numeric("cpp_dir_comercial"),
  perc_dir_capital: numeric("perc_dir_capital"),
  cpp_dir_capital: numeric("cpp_dir_capital"),
  custo_origem_bia: numeric("custo_origem_bia"),
  custo_final_previsto: numeric("custo_final_previsto"),
  valor_realizado_venda: numeric("valor_realizado_venda"),
  comissao_prevista_corretor: numeric("comissao_prevista_corretor"),
  ir_previsto: numeric("ir_previsto"),
  resultado_liquido: numeric("resultado_liquido"),
  lucro_previsto: numeric("lucro_previsto"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertBiasProjetoSchema = createInsertSchema(biasProjetos).omit({
  id: true,
  created_at: true,
});

export type InsertBiasProjeto = z.infer<typeof insertBiasProjetoSchema>;
export type BiasProjeto = typeof biasProjetos.$inferSelect;

export const tiposCpp = pgTable("tipos_cpp", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
});

export const insertTipoCppSchema = createInsertSchema(tiposCpp).omit({
  id: true,
});

export type InsertTipoCpp = z.infer<typeof insertTipoCppSchema>;
export type TipoCpp = typeof tiposCpp.$inferSelect;

export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
});

export const insertCategoriaSchema = createInsertSchema(categorias).omit({
  id: true,
});

export type InsertCategoria = z.infer<typeof insertCategoriaSchema>;
export type Categoria = typeof categorias.$inferSelect;

export const fluxoCaixa = pgTable("fluxo_caixa", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id"),
  tipo: text("tipo").notNull(),
  valor: numeric("valor").notNull(),
  data: date("data"),
  descricao: text("descricao"),
  membro_responsavel_id: text("membro_responsavel_id"),
  categoria_id: text("categoria_id"),
  tipo_cpp_id: text("tipo_cpp_id"),
  favorecido_id: text("favorecido_id"),
  anexos: text("anexos").array(),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertFluxoCaixaSchema = createInsertSchema(fluxoCaixa).omit({
  id: true,
  created_at: true,
});

export type InsertFluxoCaixa = z.infer<typeof insertFluxoCaixaSchema>;
export type FluxoCaixa = typeof fluxoCaixa.$inferSelect;

export const oportunidades = pgTable("oportunidades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome_oportunidade: text("nome_oportunidade").notNull(),
  tipo: text("tipo"),
  ramo_atuacao: text("ramo_atuacao"),
  bia_id: text("bia_id"),
  valor_origem_opa: numeric("valor_origem_opa"),
  objetivo_alianca: text("objetivo_alianca"),
  nucleo_alianca: text("nucleo_alianca"),
  pais: text("pais").default("Brasil"),
  descricao: text("descricao"),
  perfil_aliado: text("perfil_aliado"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertOportunidadeSchema = createInsertSchema(oportunidades).omit({
  id: true,
  created_at: true,
});

export type InsertOportunidade = z.infer<typeof insertOportunidadeSchema>;
export type Oportunidade = typeof oportunidades.$inferSelect;

export const nucleoTecnicoDocs = pgTable("nucleo_tecnico_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id"),
  alianca_tipo: text("alianca_tipo"),
  tipo_documento: text("tipo_documento"),
  descricao: text("descricao"),
  membro_responsavel: text("membro_responsavel"),
  arquivo_ids: jsonb("arquivo_ids").$type<string[]>().default([]),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertNucleoTecnicoDocSchema = createInsertSchema(nucleoTecnicoDocs).omit({
  id: true,
  created_at: true,
});

export type InsertNucleoTecnicoDoc = z.infer<typeof insertNucleoTecnicoDocSchema>;
export type NucleoTecnicoDoc = typeof nucleoTecnicoDocs.$inferSelect;

export const aliancaDocs = pgTable("alianca_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modulo: text("modulo"),
  bia_id: text("bia_id"),
  alianca_tipo: text("alianca_tipo"),
  tipo_documento: text("tipo_documento"),
  descricao: text("descricao"),
  membro_responsavel: text("membro_responsavel"),
  arquivo_ids: jsonb("arquivo_ids").$type<string[]>().default([]),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertAliancaDocSchema = createInsertSchema(aliancaDocs).omit({
  id: true,
  created_at: true,
});

export type InsertAliancaDoc = z.infer<typeof insertAliancaDocSchema>;
export type AliancaDoc = typeof aliancaDocs.$inferSelect;

export const opaInteresses = pgTable("opa_interesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opa_id: text("opa_id").notNull(),
  user_id: text("user_id").notNull(),
  membro_id: text("membro_id"),
  membro_nome: text("membro_nome"),
  mensagem: text("mensagem"),
  multiplicador: text("multiplicador"),
  status_crm: text("status_crm").notNull().default("interesse_recebido"),
  observacao_crm: text("observacao_crm"),
  criado_em: timestamp("criado_em").defaultNow(),
  atualizado_em: timestamp("atualizado_em").defaultNow(),
});

export const insertOpaInteresseSchema = createInsertSchema(opaInteresses).omit({
  id: true,
  criado_em: true,
});

export type InsertOpaInteresse = z.infer<typeof insertOpaInteresseSchema>;
export type OpaInteresse = typeof opaInteresses.$inferSelect;

export const agendaTarefas = pgTable("agenda_tarefas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: text("user_id").notNull(),
  membro_id: text("membro_id"),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  data: date("data").notNull(),
  hora: text("hora"),
  status: text("status").notNull().default("pendente"),
  prioridade: text("prioridade").notNull().default("media"),
  contexto_tipo: text("contexto_tipo"),
  contexto_id: text("contexto_id"),
  origem_tarefa_id: text("origem_tarefa_id"),
  atribuido_por_user_id: text("atribuido_por_user_id"),
  atribuido_por_membro_id: text("atribuido_por_membro_id"),
  atribuido_por_nome: text("atribuido_por_nome"),
  criado_em: timestamp("criado_em").defaultNow(),
  atualizado_em: timestamp("atualizado_em").defaultNow(),
});

export const insertAgendaTarefaSchema = createInsertSchema(agendaTarefas).omit({
  id: true,
  criado_em: true,
  atualizado_em: true,
}).extend({
  titulo: z.string().min(1, "Título é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).default("pendente"),
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
});

export type InsertAgendaTarefa = z.infer<typeof insertAgendaTarefaSchema>;
export type AgendaTarefa = typeof agendaTarefas.$inferSelect;

export const transferenciasCotas = pgTable("transferencias_cotas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: varchar("bia_id").notNull(),
  membro_origem_id: varchar("membro_origem_id").notNull(),
  membro_destino_id: varchar("membro_destino_id").notNull(),
  valor_total: numeric("valor_total"),
  percentual_transferencia: numeric("percentual_transferencia", { precision: 5, scale: 2 }),
  status: text("status").notNull().default("pendente"),
  solicitado_por: varchar("solicitado_por"),
  observacoes: text("observacoes"),
  anexos: text("anexos").array().default([]),
  motivo_rejeicao: text("motivo_rejeicao"),
  criado_em: timestamp("criado_em").defaultNow(),
  atualizado_em: timestamp("atualizado_em").defaultNow(),
});

export const insertTransferenciaCotasSchema = createInsertSchema(transferenciasCotas).omit({
  id: true,
  criado_em: true,
  atualizado_em: true,
});

export type InsertTransferenciaCotas = z.infer<typeof insertTransferenciaCotasSchema>;
export type TransferenciaCotas = typeof transferenciasCotas.$inferSelect;

export const anuncios = pgTable("anuncios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  membro_id: varchar("membro_id").notNull(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  descricao: text("descricao"),
  link: varchar("link", { length: 500 }),
  imagem_directus_id: varchar("imagem_directus_id"),
  ambiente: text("ambiente").notNull().default("vitrine"),
  slot_tipo: text("slot_tipo").notNull().default("padrao"),
  data_inicio: date("data_inicio").notNull(),
  data_fim: date("data_fim").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  pagamento_provider: text("pagamento_provider"),
  pagamento_id: text("pagamento_id"),
  pagamento_url: text("pagamento_url"),
  pagamento_status: text("pagamento_status"),
  pagamento_pais: text("pagamento_pais"),
  pagamento_gerado_em: timestamp("pagamento_gerado_em"),
  publicado_em: timestamp("publicado_em"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertAnuncioSchema = createInsertSchema(anuncios).omit({
  id: true,
  created_at: true,
});

export type InsertAnuncio = z.infer<typeof insertAnuncioSchema>;
export type Anuncio = typeof anuncios.$inferSelect;

export const membroAnuidades = pgTable("membro_anuidades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  membro_id: text("membro_id").notNull(),
  user_id: text("user_id"),
  comunidade_id: text("comunidade_id").notNull(),
  provider: text("provider").notNull(),
  valor: numeric("valor", { precision: 14, scale: 2 }).notNull(),
  moeda: text("moeda").notNull().default("BRL"),
  starts_at: timestamp("starts_at").notNull(),
  ends_at: timestamp("ends_at").notNull(),
  external_id: text("external_id"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata").notNull().default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  providerExternalUnique: unique("membro_anuidades_provider_external_uniq").on(table.provider, table.external_id),
}));

export const biaPatrimonialSnapshots = pgTable("bia_patrimonial_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  patrimonio_liquido: numeric("patrimonio_liquido", { precision: 16, scale: 2 }).notNull(),
  data_base: date("data_base").notNull(),
  moeda: text("moeda").notNull().default("BRL"),
  metodologia: text("metodologia").notNull(),
  liquidez: text("liquidez"),
  confirmado: boolean("confirmado").notNull().default(true),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const biaAporteSolicitacoes = pgTable("bia_aporte_solicitacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  membro_id: text("membro_id").notNull(),
  valor: numeric("valor", { precision: 16, scale: 2 }).notNull(),
  moeda: text("moeda").notNull().default("BRL"),
  comprovante_file_id: text("comprovante_file_id").notNull(),
  status: text("status").notNull().default("pending"),
  observacao: text("observacao"),
  fluxo_caixa_id: text("fluxo_caixa_id"),
  decidido_por_user_id: text("decidido_por_user_id"),
  decidido_por_membro_id: text("decidido_por_membro_id"),
  decidido_em: timestamp("decidido_em"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export function getQuinzena(dateStr: string): { inicio: string; fim: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  if (d <= 15) {
    return {
      inicio: `${String(y)}-${String(m).padStart(2, "0")}-01`,
      fim: `${String(y)}-${String(m).padStart(2, "0")}-15`,
    };
  }
  return {
    inicio: `${String(y)}-${String(m).padStart(2, "0")}-16`,
    fim: `${String(y)}-${String(m).padStart(2, "0")}-${ultimoDia}`,
  };
}

export function isValidQuinzena(inicio: string, fim: string): boolean {
  const [iy, im, id] = inicio.split("-").map(Number);
  const [fy, fm, fd] = fim.split("-").map(Number);
  if (iy !== fy || im !== fm) return false;
  if (id === 1 && fd === 15) return true;
  if (id === 16) {
    const ultimoDia = new Date(iy, im, 0).getDate();
    return fd === ultimoDia;
  }
  return false;
}

export const convitesComunidade = pgTable("convites_comunidade", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()`),
  comunidade_id: text("comunidade_id").notNull(),
  candidato_membro_id: text("candidato_membro_id").notNull(),
  candidato_nome: text("candidato_nome"),
  candidato_email: text("candidato_email"),
  invitador_membro_id: text("invitador_membro_id"),
  status: text("status").notNull().default("convidado"),
  tipo: text("tipo").notNull().default("completo"),
  dados_contratuais: jsonb("dados_contratuais"),
  expires_at: timestamp("expires_at"),
  termos_aceitos_em: timestamp("termos_aceitos_em"),
  solicitacao_acesso_em: timestamp("solicitacao_acesso_em"),
  aura_invitador_avaliada_em: timestamp("aura_invitador_avaliada_em"),
  avaliacao_token: varchar("avaliacao_token").unique(),
  lembrete_24h_em: timestamp("lembrete_24h_em"),
  lembrete_48h_em: timestamp("lembrete_48h_em"),
  lembrete_72h_em: timestamp("lembrete_72h_em"),
  criado_em: timestamp("criado_em").defaultNow(),
  atualizado_em: timestamp("atualizado_em").defaultNow(),
});

export const insertConviteComunidadeSchema = createInsertSchema(convitesComunidade).omit({
  id: true,
  token: true,
  criado_em: true,
  atualizado_em: true,
});

export type InsertConviteComunidade = z.infer<typeof insertConviteComunidadeSchema>;
export type ConviteComunidade = typeof convitesComunidade.$inferSelect;

export const convitesLink = pgTable("convites_link", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()`),
  gerador_user_id: varchar("gerador_user_id").notNull(),
  gerador_membro_id: text("gerador_membro_id"),
  gerador_nome: text("gerador_nome"),
  comunidade_id: text("comunidade_id"),
  comunidade_nome: text("comunidade_nome"),
  tipo: text("tipo").notNull().default("vitrine"),
  status: text("status").notNull().default("ativo"),
  usado_por_user_id: varchar("usado_por_user_id"),
  criado_em: timestamp("criado_em").defaultNow(),
  expires_at: timestamp("expires_at").notNull(),
  usado_em: timestamp("usado_em"),
});

export const insertConviteLinkSchema = createInsertSchema(convitesLink).omit({
  id: true,
  token: true,
  criado_em: true,
  usado_em: true,
});

export type InsertConviteLink = z.infer<typeof insertConviteLinkSchema>;
export type ConviteLink = typeof convitesLink.$inferSelect;

export const biaAprovacoes = pgTable("bia_aprovacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  bia_nome: text("bia_nome"),
  status: text("status").notNull().default("pendente"), // pendente | aprovado | rejeitado
  solicitante_membro_id: text("solicitante_membro_id").notNull(),
  solicitante_nome: text("solicitante_nome"),
  solicitante_email: text("solicitante_email"),
  aliado_built_membro_id: text("aliado_built_membro_id"),
  aliado_built_email: text("aliado_built_email"),
  aliado_built_nome: text("aliado_built_nome"),
  comunidade_id: text("comunidade_id"),
  comunidade_nome: text("comunidade_nome"),
  motivo_rejeicao: text("motivo_rejeicao"),
  criado_em: timestamp("criado_em").defaultNow(),
  revisado_em: timestamp("revisado_em"),
});

export type BiaAprovacao = typeof biaAprovacoes.$inferSelect;
export const insertBiaAprovacaoSchema = createInsertSchema(biaAprovacoes).omit({ id: true, criado_em: true, revisado_em: true });
export type InsertBiaAprovacao = z.infer<typeof insertBiaAprovacaoSchema>;

export const biaDiretorSolicitacoes = pgTable("bia_diretor_solicitacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  bia_nome: text("bia_nome"),
  diretor_membro_id: text("diretor_membro_id").notNull(),
  diretor_nome: text("diretor_nome"),
  diretor_email: text("diretor_email"),
  papel: text("papel").notNull(),
  campo_diretor: text("campo_diretor").notNull(),
  campo_percentual: text("campo_percentual").notNull(),
  percentual: numeric("percentual"),
  status: text("status").notNull().default("pendente"),
  solicitante_membro_id: text("solicitante_membro_id"),
  solicitante_nome: text("solicitante_nome"),
  solicitante_email: text("solicitante_email"),
  criado_em: timestamp("criado_em").defaultNow(),
  respondido_em: timestamp("respondido_em"),
});

export type BiaDiretorSolicitacao = typeof biaDiretorSolicitacoes.$inferSelect;
export const insertBiaDiretorSolicitacaoSchema = createInsertSchema(biaDiretorSolicitacoes).omit({ id: true, criado_em: true, respondido_em: true });
export type InsertBiaDiretorSolicitacao = z.infer<typeof insertBiaDiretorSolicitacaoSchema>;

export const biaSocioSolicitacoes = pgTable("bia_socio_solicitacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  bia_nome: text("bia_nome"),
  socio_membro_id: text("socio_membro_id").notNull(),
  socio_nome: text("socio_nome"),
  socio_email: text("socio_email"),
  papel: text("papel").notNull(),
  campo_socios: text("campo_socios").notNull(),
  status: text("status").notNull().default("pendente"),
  solicitante_membro_id: text("solicitante_membro_id"),
  solicitante_nome: text("solicitante_nome"),
  solicitante_email: text("solicitante_email"),
  criado_em: timestamp("criado_em").defaultNow(),
  respondido_em: timestamp("respondido_em"),
});

export type BiaSocioSolicitacao = typeof biaSocioSolicitacoes.$inferSelect;
export const insertBiaSocioSolicitacaoSchema = createInsertSchema(biaSocioSolicitacoes).omit({ id: true, criado_em: true, respondido_em: true });
export type InsertBiaSocioSolicitacao = z.infer<typeof insertBiaSocioSolicitacaoSchema>;

export const biaMouAceites = pgTable("bia_mou_aceites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  membro_id: text("membro_id").notNull(),
  mou_versao: text("mou_versao").notNull(),
  mou_titulo: text("mou_titulo").notNull(),
  dados_contratuais: jsonb("dados_contratuais"),
  aceite_localizacao: jsonb("aceite_localizacao").$type<Record<string, unknown> | null>(),
  aceito_em: timestamp("aceito_em").defaultNow(),
}, (table) => ({
  uniqueBiaMembroVersao: unique().on(table.bia_id, table.membro_id, table.mou_versao),
}));

export type BiaMouAceite = typeof biaMouAceites.$inferSelect;
export const insertBiaMouAceiteSchema = createInsertSchema(biaMouAceites).omit({ id: true, aceito_em: true });
export type InsertBiaMouAceite = z.infer<typeof insertBiaMouAceiteSchema>;

export const biaUserPermissions = pgTable("bia_user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  membro_id: text("membro_id").notNull(),
  permissions: jsonb("permissions").$type<BiaAccessMatrix>().notNull(),
  updated_by_user_id: text("updated_by_user_id"),
  updated_by_membro_id: text("updated_by_membro_id"),
  updated_by_nome: text("updated_by_nome"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBiaMembro: unique("bia_user_permissions_bia_membro_uniq").on(table.bia_id, table.membro_id),
}));

export type BiaUserPermission = typeof biaUserPermissions.$inferSelect;
export type InsertBiaUserPermission = typeof biaUserPermissions.$inferInsert;

export const chamadasAlianca = pgTable("chamadas_alianca", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bia_id: text("bia_id").notNull(),
  bia_nome: text("bia_nome"),
  diretor_campo: text("diretor_campo").notNull(),
  diretor_membro_id: text("diretor_membro_id"),
  diretor_nome: text("diretor_nome"),
  nucleo_alianca: text("nucleo_alianca"),
  ordem: integer("ordem").notNull(),
  escopo: text("escopo").notNull(),
  titulo: text("titulo").notNull(),
  data_hora: timestamp("data_hora").notNull(),
  link_reuniao: text("link_reuniao").notNull(),
  opa_id: text("opa_id"),
  destinatarios: jsonb("destinatarios").default([]),
  status: text("status").notNull().default("pendente"),
  criado_por_user_id: text("criado_por_user_id"),
  criado_por_membro_id: text("criado_por_membro_id"),
  criado_por_nome: text("criado_por_nome"),
  criado_em: timestamp("criado_em").defaultNow(),
});

export type ChamadaAlianca = typeof chamadasAlianca.$inferSelect;
export const insertChamadaAliancaSchema = createInsertSchema(chamadasAlianca).omit({ id: true, criado_em: true });
export type InsertChamadaAlianca = z.infer<typeof insertChamadaAliancaSchema>;

export const auraAvaliacoes = pgTable("aura_avaliacoes", {
  id: serial("id").primaryKey(),
  avaliador_membro_id: text("avaliador_membro_id").notNull(),
  avaliado_membro_id: text("avaliado_membro_id").notNull(),
  palavras: text("palavras").array().notNull(),
  created_at: timestamp("created_at").defaultNow(),
}, (t) => ({
  avaliadorAvaliadoUniq: unique("aura_avaliacoes_avaliador_avaliado_uniq").on(t.avaliador_membro_id, t.avaliado_membro_id),
}));

export type AuraAvaliacao = typeof auraAvaliacoes.$inferSelect;
export const insertAuraAvaliacaoSchema = createInsertSchema(auraAvaliacoes).omit({ id: true, created_at: true });
export type InsertAuraAvaliacao = z.infer<typeof insertAuraAvaliacaoSchema>;

export const biaInfoComercial = pgTable("bia_info_comercial", {
  id: serial("id").primaryKey(),
  bia_id: text("bia_id").notNull().unique(),
  // Dados Comerciais
  razao_social: text("razao_social"),
  cnpj: text("cnpj"),
  nome_fantasia: text("nome_fantasia"),
  inscricao_estadual: text("inscricao_estadual"),
  // Conta Bancária
  banco: text("banco"),
  agencia: text("agencia"),
  conta: text("conta"),
  tipo_conta: text("tipo_conta"),
  titular_conta: text("titular_conta"),
  chave_pix: text("chave_pix"),
  // Informacoes do Ativo
  ativo_endereco: text("ativo_endereco"),
  ativo_bairro: text("ativo_bairro"),
  ativo_cidade: text("ativo_cidade"),
  ativo_estado: text("ativo_estado"),
  ativo_pais: text("ativo_pais"),
  ativo_qualificacao: text("ativo_qualificacao"),
  ativo_descricao_adicional: text("ativo_descricao_adicional"),
  ativo_area_m2: text("ativo_area_m2"),
  ativo_numero: text("ativo_numero"),
  ativo_complemento: text("ativo_complemento"),
  ativo_cep: text("ativo_cep"),
  ativo_numero_matricula: text("ativo_numero_matricula"),
  ativo_livro: text("ativo_livro"),
  ativo_folha: text("ativo_folha"),
  ativo_cartorio: text("ativo_cartorio"),
  ativo_comarca: text("ativo_comarca"),
  updated_at: timestamp("updated_at").defaultNow(),
});

export type BiaInfoComercial = typeof biaInfoComercial.$inferSelect;
export const insertBiaInfoComercialSchema = createInsertSchema(biaInfoComercial).omit({ id: true, updated_at: true });
export type InsertBiaInfoComercial = z.infer<typeof insertBiaInfoComercialSchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  criado_em: timestamp("criado_em").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
