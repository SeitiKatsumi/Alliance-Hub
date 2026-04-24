import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb, timestamp, serial, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  role: z.enum(["admin", "manager", "user", "membro", "investidor"]).default("user"),
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
  criado_em: timestamp("criado_em").defaultNow(),
});

export const insertOpaInteresseSchema = createInsertSchema(opaInteresses).omit({
  id: true,
  criado_em: true,
});

export type InsertOpaInteresse = z.infer<typeof insertOpaInteresseSchema>;
export type OpaInteresse = typeof opaInteresses.$inferSelect;

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
  data_inicio: date("data_inicio").notNull(),
  data_fim: date("data_fim").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertAnuncioSchema = createInsertSchema(anuncios).omit({
  id: true,
  created_at: true,
});

export type InsertAnuncio = z.infer<typeof insertAnuncioSchema>;
export type Anuncio = typeof anuncios.$inferSelect;

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

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  criado_em: timestamp("criado_em").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

