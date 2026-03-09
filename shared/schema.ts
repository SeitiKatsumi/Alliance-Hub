import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
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
  role: z.enum(["admin", "manager", "user"]).default("user"),
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
