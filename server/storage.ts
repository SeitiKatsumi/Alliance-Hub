import { db } from "./db";
import {
  users, type User, type InsertUser, type ModulePermissions, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS,
  membros, type Membro, type InsertMembro,
  biasProjetos, type BiasProjeto, type InsertBiasProjeto,
  fluxoCaixa, type FluxoCaixa, type InsertFluxoCaixa,
  tiposCpp, type TipoCpp, type InsertTipoCpp,
  categorias, type Categoria, type InsertCategoria,
  oportunidades, type Oportunidade, type InsertOportunidade,
  transferenciasCotas, type TransferenciaCotas, type InsertTransferenciaCotas,
  opaInteresses, type OpaInteresse, type InsertOpaInteresse,
  convitesComunidade, type ConviteComunidade, type InsertConviteComunidade,
  convitesLink, type ConviteLink, type InsertConviteLink,
  anuncios, type Anuncio, type InsertAnuncio,
  passwordResetTokens, type PasswordResetToken,
  biaAprovacoes, type BiaAprovacao, type InsertBiaAprovacao,
  auraAvaliacoes, type AuraAvaliacao,
} from "@shared/schema";
import { eq, desc, and, lte, gte, sql as sqlExpr } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(".")) return false;
  const dotIdx = stored.lastIndexOf(".");
  const hashed = stored.slice(0, dotIdx);
  const salt = stored.slice(dotIdx + 1);
  if (!hashed || !salt) return false;
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    if (hashedBuf.length === 0) return false;
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    if (hashedBuf.length !== suppliedBuf.length) return false;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  getAllMembros(): Promise<Membro[]>;
  getMembro(id: string): Promise<Membro | undefined>;
  createMembro(data: InsertMembro): Promise<Membro>;
  updateMembro(id: string, data: Partial<InsertMembro>): Promise<Membro | undefined>;
  deleteMembro(id: string): Promise<boolean>;

  getAllBias(): Promise<BiasProjeto[]>;
  getBia(id: string): Promise<BiasProjeto | undefined>;
  createBia(data: InsertBiasProjeto): Promise<BiasProjeto>;
  updateBia(id: string, data: Partial<InsertBiasProjeto>): Promise<BiasProjeto | undefined>;
  deleteBia(id: string): Promise<boolean>;

  getAllFluxoCaixa(): Promise<any[]>;
  getFluxoCaixaByBia(biaId: string): Promise<any[]>;
  createFluxoCaixa(data: InsertFluxoCaixa): Promise<FluxoCaixa>;
  updateFluxoCaixa(id: string, data: Partial<InsertFluxoCaixa>): Promise<FluxoCaixa | undefined>;
  deleteFluxoCaixa(id: string): Promise<boolean>;

  getAllTiposCpp(): Promise<TipoCpp[]>;
  createTipoCpp(data: InsertTipoCpp): Promise<TipoCpp>;

  getAllCategorias(): Promise<Categoria[]>;
  createCategoria(data: InsertCategoria): Promise<Categoria>;

  getAllOportunidades(): Promise<Oportunidade[]>;
  createOportunidade(data: InsertOportunidade): Promise<Oportunidade>;
  updateOportunidade(id: string, data: Partial<InsertOportunidade>): Promise<Oportunidade | undefined>;

  createTransferenciaCotas(data: InsertTransferenciaCotas): Promise<TransferenciaCotas>;
  getTransferenciaCotas(id: string): Promise<TransferenciaCotas | undefined>;
  getTransferenciasCotasByBia(biaId: string): Promise<TransferenciaCotas[]>;
  updateTransferenciaCotas(id: string, data: Partial<TransferenciaCotas>): Promise<TransferenciaCotas | undefined>;

  getInteressesByOpa(opaId: string): Promise<OpaInteresse[]>;
  getUserInteresseByOpa(opaId: string, userId: string): Promise<OpaInteresse | undefined>;
  createOpaInteresse(data: InsertOpaInteresse): Promise<OpaInteresse>;
  deleteOpaInteresse(opaId: string, userId: string): Promise<boolean>;

  createConvite(data: InsertConviteComunidade): Promise<ConviteComunidade>;
  getConviteByToken(token: string): Promise<ConviteComunidade | undefined>;
  getConviteByAvaliacaoToken(avaliacaoToken: string): Promise<ConviteComunidade | undefined>;
  getConvitesByComunidade(comunidadeId: string): Promise<ConviteComunidade[]>;
  getConvitesByCandidato(candidatoMembroId: string): Promise<ConviteComunidade[]>;
  getConvitesByCandidatoMembro(membroId: string, tipo?: string): Promise<ConviteComunidade[]>;
  getConvitesTermosPendentes(): Promise<ConviteComunidade[]>;
  updateConvite(id: string, data: Partial<ConviteComunidade>): Promise<ConviteComunidade | undefined>;

  createConviteLink(data: InsertConviteLink): Promise<ConviteLink>;
  getConviteLinkByToken(token: string): Promise<ConviteLink | undefined>;
  getActiveConviteLinkByUserId(userId: string): Promise<ConviteLink | undefined>;
  getConvitesLinkByComunidade(comunidadeId: string): Promise<ConviteLink[]>;
  updateConviteLink(id: string, data: Partial<ConviteLink>): Promise<ConviteLink | undefined>;

  createPasswordResetToken(userId: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;

  getAnunciosAtivos(today: string): Promise<Anuncio[]>;
  getAnuncioByMembro(membroId: string): Promise<Anuncio | undefined>;
  getAnunciosByMembro(membroId: string): Promise<Anuncio[]>;
  hasAnuncioByMembroInPeriod(membroId: string, dataInicio: string, dataFim: string, excludeId?: string): Promise<boolean>;
  getAnuncioById(id: string): Promise<Anuncio | undefined>;
  countAnunciosByPeriod(dataInicio: string, dataFim: string, excludeId?: string): Promise<number>;
  createAnuncio(data: InsertAnuncio): Promise<Anuncio>;
  updateAnuncio(id: string, data: Partial<InsertAnuncio>): Promise<Anuncio | undefined>;
  deleteAnuncio(id: string): Promise<boolean>;
  getAnunciosDisponibilidade(meses: number): Promise<Array<{ inicio: string; fim: string; count: number; vagas: number }>>;

  upsertAuraAvaliacao(avaliadorId: string, avaliadoId: string, palavras: string[]): Promise<AuraAvaliacao>;
  getAuraAvaliacoesByAvaliado(avaliadoId: string): Promise<AuraAvaliacao[]>;
  getAuraAvaliacoesByAvaliador(avaliadorId: string): Promise<AuraAvaliacao[]>;
  getAuraAvaliacaoByPair(avaliadorId: string, avaliadoId: string): Promise<AuraAvaliacao | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sqlExpr`lower(${users.email}) = ${email.toLowerCase()}`).orderBy(desc(users.created_at));
    return user;
  }

  async getUsersByEmail(email: string): Promise<User[]> {
    return db.select().from(users).where(sqlExpr`lower(${users.email}) = ${email.toLowerCase()}`).orderBy(desc(users.created_at));
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.google_id, googleId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
        permissions: insertUser.permissions || (insertUser.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS),
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: Partial<InsertUser> = { ...data };
    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    } else {
      delete updateData.password;
    }
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllMembros(): Promise<Membro[]> {
    return db.select().from(membros);
  }

  async getMembro(id: string): Promise<Membro | undefined> {
    const [m] = await db.select().from(membros).where(eq(membros.id, id));
    return m;
  }

  async createMembro(data: InsertMembro): Promise<Membro> {
    const [m] = await db.insert(membros).values(data).returning();
    return m;
  }

  async updateMembro(id: string, data: Partial<InsertMembro>): Promise<Membro | undefined> {
    const [m] = await db.update(membros).set(data).where(eq(membros.id, id)).returning();
    return m;
  }

  async deleteMembro(id: string): Promise<boolean> {
    const result = await db.delete(membros).where(eq(membros.id, id)).returning();
    return result.length > 0;
  }

  async getAllBias(): Promise<BiasProjeto[]> {
    return db.select().from(biasProjetos);
  }

  async getBia(id: string): Promise<BiasProjeto | undefined> {
    const [b] = await db.select().from(biasProjetos).where(eq(biasProjetos.id, id));
    return b;
  }

  async createBia(data: InsertBiasProjeto): Promise<BiasProjeto> {
    const [b] = await db.insert(biasProjetos).values(data).returning();
    return b;
  }

  async updateBia(id: string, data: Partial<InsertBiasProjeto>): Promise<BiasProjeto | undefined> {
    const [b] = await db.update(biasProjetos).set(data).where(eq(biasProjetos.id, id)).returning();
    return b;
  }

  async deleteBia(id: string): Promise<boolean> {
    const result = await db.delete(biasProjetos).where(eq(biasProjetos.id, id)).returning();
    return result.length > 0;
  }

  async getAllFluxoCaixa(): Promise<any[]> {
    const items = await db.select().from(fluxoCaixa);
    return this._enrichFluxoItems(items);
  }

  async getFluxoCaixaByBia(biaId: string): Promise<any[]> {
    const items = await db.select().from(fluxoCaixa).where(eq(fluxoCaixa.bia_id, biaId));
    return this._enrichFluxoItems(items);
  }

  private async _enrichFluxoItems(items: FluxoCaixa[]): Promise<any[]> {
    if (items.length === 0) return [];

    const allMembros = await db.select().from(membros);
    const allCpp = await db.select().from(tiposCpp);
    const allCat = await db.select().from(categorias);

    const membroMap = new Map(allMembros.map(m => [m.id, m]));
    const cppMap = new Map(allCpp.map(c => [String(c.id), c]));
    const catMap = new Map(allCat.map(c => [String(c.id), c]));

    return items.map(item => {
      const cat = item.categoria_id ? catMap.get(item.categoria_id) : null;
      const cpp = item.tipo_cpp_id ? cppMap.get(item.tipo_cpp_id) : null;
      const fav = item.favorecido_id ? membroMap.get(item.favorecido_id) : null;

      return {
        id: item.id,
        bia: item.bia_id,
        tipo: item.tipo,
        valor: item.valor,
        data: item.data,
        descricao: item.descricao,
        membro_responsavel: item.membro_responsavel_id,
        anexos: item.anexos || [],
        Categoria: cat ? [{ id: cat.id, Nome_da_categoria: cat.nome, Descricao_das_categorias: cat.descricao }] : [],
        tipo_de_cpp: cpp ? [{ id: cpp.id, Nome: cpp.nome, Descricao: cpp.descricao }] : [],
        Favorecido: fav ? [{ id: fav.id, nome: fav.nome }] : [],
      };
    });
  }

  async createFluxoCaixa(data: InsertFluxoCaixa): Promise<FluxoCaixa> {
    const [item] = await db.insert(fluxoCaixa).values(data).returning();
    return item;
  }

  async updateFluxoCaixa(id: string, data: Partial<InsertFluxoCaixa>): Promise<FluxoCaixa | undefined> {
    const [item] = await db.update(fluxoCaixa).set(data).where(eq(fluxoCaixa.id, id)).returning();
    return item;
  }

  async deleteFluxoCaixa(id: string): Promise<boolean> {
    const result = await db.delete(fluxoCaixa).where(eq(fluxoCaixa.id, id)).returning();
    return result.length > 0;
  }

  async getAllTiposCpp(): Promise<any[]> {
    const items = await db.select().from(tiposCpp);
    return items.map(c => ({ id: c.id, Nome: c.nome, Descricao: c.descricao }));
  }

  async createTipoCpp(data: InsertTipoCpp): Promise<TipoCpp> {
    const [item] = await db.insert(tiposCpp).values(data).returning();
    return item;
  }

  async getAllCategorias(): Promise<any[]> {
    const items = await db.select().from(categorias);
    return items.map(c => ({ id: c.id, Nome_da_categoria: c.nome, Descricao_das_categorias: c.descricao }));
  }

  async createCategoria(data: InsertCategoria): Promise<Categoria> {
    const [item] = await db.insert(categorias).values(data).returning();
    return item;
  }

  async getAllOportunidades(): Promise<any[]> {
    const items = await db.select().from(oportunidades);
    return items.map(o => ({ ...o, bia: o.bia_id }));
  }

  async createOportunidade(data: InsertOportunidade): Promise<Oportunidade> {
    const [item] = await db.insert(oportunidades).values(data).returning();
    return item;
  }

  async updateOportunidade(id: string, data: Partial<InsertOportunidade>): Promise<Oportunidade | undefined> {
    const [item] = await db.update(oportunidades).set(data).where(eq(oportunidades.id, id)).returning();
    return item;
  }

  async createTransferenciaCotas(data: InsertTransferenciaCotas): Promise<TransferenciaCotas> {
    const [item] = await db.insert(transferenciasCotas).values(data).returning();
    return item;
  }

  async getTransferenciaCotas(id: string): Promise<TransferenciaCotas | undefined> {
    const [item] = await db.select().from(transferenciasCotas).where(eq(transferenciasCotas.id, id));
    return item;
  }

  async getTransferenciasCotasByBia(biaId: string): Promise<TransferenciaCotas[]> {
    return db
      .select()
      .from(transferenciasCotas)
      .where(eq(transferenciasCotas.bia_id, biaId))
      .orderBy(desc(transferenciasCotas.criado_em));
  }

  async updateTransferenciaCotas(id: string, data: Partial<TransferenciaCotas>): Promise<TransferenciaCotas | undefined> {
    const [item] = await db
      .update(transferenciasCotas)
      .set({ ...data, atualizado_em: new Date() })
      .where(eq(transferenciasCotas.id, id))
      .returning();
    return item;
  }

  async getInteressesByOpa(opaId: string): Promise<OpaInteresse[]> {
    return db
      .select()
      .from(opaInteresses)
      .where(eq(opaInteresses.opa_id, opaId))
      .orderBy(desc(opaInteresses.criado_em));
  }

  async getUserInteresseByOpa(opaId: string, userId: string): Promise<OpaInteresse | undefined> {
    const [item] = await db
      .select()
      .from(opaInteresses)
      .where(and(eq(opaInteresses.opa_id, opaId), eq(opaInteresses.user_id, userId)));
    return item;
  }

  async createOpaInteresse(data: InsertOpaInteresse): Promise<OpaInteresse> {
    const [item] = await db.insert(opaInteresses).values(data).returning();
    return item;
  }

  async deleteOpaInteresse(opaId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(opaInteresses)
      .where(and(eq(opaInteresses.opa_id, opaId), eq(opaInteresses.user_id, userId)))
      .returning();
    return result.length > 0;
  }

  async createConvite(data: InsertConviteComunidade): Promise<ConviteComunidade> {
    const [item] = await db.insert(convitesComunidade).values(data).returning();
    return item;
  }

  async getConviteByToken(token: string): Promise<ConviteComunidade | undefined> {
    const [item] = await db
      .select()
      .from(convitesComunidade)
      .where(eq(convitesComunidade.token, token));
    return item;
  }

  async getConviteByAvaliacaoToken(avaliacaoToken: string): Promise<ConviteComunidade | undefined> {
    const [item] = await db
      .select()
      .from(convitesComunidade)
      .where(eq(convitesComunidade.avaliacao_token, avaliacaoToken));
    return item;
  }

  async getConvitesTermosPendentes(): Promise<ConviteComunidade[]> {
    return db
      .select()
      .from(convitesComunidade)
      .where(eq(convitesComunidade.status, "termos_pendentes"))
      .orderBy(convitesComunidade.criado_em);
  }

  async getConvitesByComunidade(comunidadeId: string): Promise<ConviteComunidade[]> {
    return db
      .select()
      .from(convitesComunidade)
      .where(eq(convitesComunidade.comunidade_id, comunidadeId))
      .orderBy(desc(convitesComunidade.criado_em));
  }

  async getConvitesByCandidato(candidatoMembroId: string): Promise<ConviteComunidade[]> {
    return db
      .select()
      .from(convitesComunidade)
      .where(eq(convitesComunidade.candidato_membro_id, candidatoMembroId))
      .orderBy(desc(convitesComunidade.criado_em));
  }

  async updateConvite(id: string, data: Partial<ConviteComunidade>): Promise<ConviteComunidade | undefined> {
    const [item] = await db
      .update(convitesComunidade)
      .set({ ...data, atualizado_em: new Date() })
      .where(eq(convitesComunidade.id, id))
      .returning();
    return item;
  }

  async getConvitesByCandidatoMembro(membroId: string, tipo?: string): Promise<ConviteComunidade[]> {
    const conditions = [eq(convitesComunidade.candidato_membro_id, membroId)];
    if (tipo) conditions.push(eq(convitesComunidade.tipo, tipo));
    return db
      .select()
      .from(convitesComunidade)
      .where(and(...conditions))
      .orderBy(desc(convitesComunidade.criado_em));
  }

  async createConviteLink(data: InsertConviteLink): Promise<ConviteLink> {
    const [item] = await db.insert(convitesLink).values(data).returning();
    return item;
  }

  async getConviteLinkByToken(token: string): Promise<ConviteLink | undefined> {
    const [item] = await db.select().from(convitesLink).where(eq(convitesLink.token, token));
    return item;
  }

  async getActiveConviteLinkByUserId(userId: string): Promise<ConviteLink | undefined> {
    const [item] = await db
      .select()
      .from(convitesLink)
      .where(and(eq(convitesLink.gerador_user_id, userId), eq(convitesLink.status, "ativo")))
      .orderBy(desc(convitesLink.criado_em))
      .limit(1);
    return item;
  }

  async getConvitesLinkByComunidade(comunidadeId: string): Promise<ConviteLink[]> {
    return db
      .select()
      .from(convitesLink)
      .where(eq(convitesLink.comunidade_id, comunidadeId))
      .orderBy(desc(convitesLink.criado_em));
  }

  async updateConviteLink(id: string, data: Partial<ConviteLink>): Promise<ConviteLink | undefined> {
    const [item] = await db.update(convitesLink).set(data).where(eq(convitesLink.id, id)).returning();
    return item;
  }

  async createPasswordResetToken(userId: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [item] = await db.insert(passwordResetTokens).values({ user_id: userId, expires_at: expiresAt }).returning();
    return item;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [item] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return item;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id));
  }

  async getAnunciosAtivos(today: string): Promise<Anuncio[]> {
    return db
      .select()
      .from(anuncios)
      .where(
        and(
          eq(anuncios.ativo, true),
          lte(anuncios.data_inicio, today),
          gte(anuncios.data_fim, today),
        )
      )
      .orderBy(desc(anuncios.created_at));
  }

  async getAnuncioByMembro(membroId: string): Promise<Anuncio | undefined> {
    const today = new Date().toISOString().slice(0, 10);
    const [item] = await db
      .select()
      .from(anuncios)
      .where(
        and(
          eq(anuncios.membro_id, membroId),
          eq(anuncios.ativo, true),
          gte(anuncios.data_fim, today),
        )
      )
      .orderBy(desc(anuncios.data_inicio))
      .limit(1);
    return item;
  }

  async getAnunciosByMembro(membroId: string): Promise<Anuncio[]> {
    const today = new Date().toISOString().slice(0, 10);
    return db
      .select()
      .from(anuncios)
      .where(
        and(
          eq(anuncios.membro_id, membroId),
          eq(anuncios.ativo, true),
          gte(anuncios.data_fim, today),
        )
      )
      .orderBy(anuncios.data_inicio);
  }

  async hasAnuncioByMembroInPeriod(membroId: string, dataInicio: string, dataFim: string, excludeId?: string): Promise<boolean> {
    const items = await db
      .select()
      .from(anuncios)
      .where(
        and(
          eq(anuncios.membro_id, membroId),
          eq(anuncios.ativo, true),
          lte(anuncios.data_inicio, dataFim),
          gte(anuncios.data_fim, dataInicio),
        )
      );
    const filtered = excludeId ? items.filter(a => a.id !== excludeId) : items;
    return filtered.length > 0;
  }

  async getAnuncioById(id: string): Promise<Anuncio | undefined> {
    const [item] = await db.select().from(anuncios).where(eq(anuncios.id, id));
    return item;
  }

  async countAnunciosByPeriod(dataInicio: string, dataFim: string, excludeId?: string): Promise<number> {
    const items = await db
      .select()
      .from(anuncios)
      .where(
        and(
          eq(anuncios.ativo, true),
          lte(anuncios.data_inicio, dataFim),
          gte(anuncios.data_fim, dataInicio),
        )
      );
    const filtered = excludeId ? items.filter(a => a.id !== excludeId) : items;
    return filtered.length;
  }

  async createAnuncio(data: InsertAnuncio): Promise<Anuncio> {
    const [item] = await db.insert(anuncios).values(data).returning();
    return item;
  }

  async updateAnuncio(id: string, data: Partial<InsertAnuncio>): Promise<Anuncio | undefined> {
    const [item] = await db.update(anuncios).set(data).where(eq(anuncios.id, id)).returning();
    return item;
  }

  async deleteAnuncio(id: string): Promise<boolean> {
    const result = await db
      .update(anuncios)
      .set({ ativo: false })
      .where(eq(anuncios.id, id))
      .returning();
    return result.length > 0;
  }

  async getAnunciosDisponibilidade(meses: number): Promise<Array<{ inicio: string; fim: string; count: number; vagas: number }>> {
    const MAX_SIMULTANEOUS = 6;
    const periodos: Array<{ inicio: string; fim: string; count: number; vagas: number }> = [];
    const hoje = new Date();
    for (let m = 0; m < meses; m++) {
      const ano = hoje.getFullYear() + Math.floor((hoje.getMonth() + m) / 12);
      const mes = (hoje.getMonth() + m) % 12;
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      const quinzenas = [
        { inicio: `${ano}-${String(mes + 1).padStart(2, "0")}-01`, fim: `${ano}-${String(mes + 1).padStart(2, "0")}-15` },
        { inicio: `${ano}-${String(mes + 1).padStart(2, "0")}-16`, fim: `${ano}-${String(mes + 1).padStart(2, "0")}-${ultimoDia}` },
      ];
      for (const q of quinzenas) {
        const count = await this.countAnunciosByPeriod(q.inicio, q.fim);
        periodos.push({ ...q, count, vagas: Math.max(0, MAX_SIMULTANEOUS - count) });
      }
    }
    return periodos;
  }

  // ── BIA Aprovações ─────────────────────────────────────────────────────────

  async createBiaAprovacao(data: InsertBiaAprovacao): Promise<BiaAprovacao> {
    const [row] = await db.insert(biaAprovacoes).values(data).returning();
    return row;
  }

  async getBiaAprovacoesPendentes(): Promise<BiaAprovacao[]> {
    return db.select().from(biaAprovacoes).where(eq(biaAprovacoes.status, "pendente")).orderBy(desc(biaAprovacoes.criado_em));
  }

  async getBiaAprovacoesParaAliado(aliadoMembroId: string): Promise<BiaAprovacao[]> {
    return db.select().from(biaAprovacoes)
      .where(and(eq(biaAprovacoes.status, "pendente"), eq(biaAprovacoes.aliado_built_membro_id, aliadoMembroId)))
      .orderBy(desc(biaAprovacoes.criado_em));
  }

  async getBiaAprovacaoByBiaId(biaId: string): Promise<BiaAprovacao | undefined> {
    const [row] = await db.select().from(biaAprovacoes).where(eq(biaAprovacoes.bia_id, biaId)).orderBy(desc(biaAprovacoes.criado_em));
    return row;
  }

  async updateBiaAprovacao(id: string, data: Partial<BiaAprovacao>): Promise<BiaAprovacao | undefined> {
    const [row] = await db.update(biaAprovacoes).set({ ...data, revisado_em: new Date() }).where(eq(biaAprovacoes.id, id)).returning();
    return row;
  }

  async getBiaAprovacaoById(id: string): Promise<BiaAprovacao | undefined> {
    const [row] = await db.select().from(biaAprovacoes).where(eq(biaAprovacoes.id, id));
    return row;
  }

  async getAllBiaAprovacoes(): Promise<BiaAprovacao[]> {
    return db.select().from(biaAprovacoes).orderBy(desc(biaAprovacoes.criado_em));
  }

  async upsertAuraAvaliacao(avaliadorId: string, avaliadoId: string, palavras: string[]): Promise<AuraAvaliacao> {
    const [row] = await db.insert(auraAvaliacoes)
      .values({ avaliador_membro_id: avaliadorId, avaliado_membro_id: avaliadoId, palavras })
      .onConflictDoUpdate({
        target: [auraAvaliacoes.avaliador_membro_id, auraAvaliacoes.avaliado_membro_id],
        set: { palavras, created_at: new Date() },
      })
      .returning();
    return row;
  }

  async getAuraAvaliacoesByAvaliado(avaliadoId: string): Promise<AuraAvaliacao[]> {
    return db.select().from(auraAvaliacoes).where(eq(auraAvaliacoes.avaliado_membro_id, avaliadoId)).orderBy(desc(auraAvaliacoes.created_at));
  }

  async getAuraAvaliacoesByAvaliador(avaliadorId: string): Promise<AuraAvaliacao[]> {
    return db.select().from(auraAvaliacoes).where(eq(auraAvaliacoes.avaliador_membro_id, avaliadorId)).orderBy(desc(auraAvaliacoes.created_at));
  }

  async getAuraAvaliacaoByPair(avaliadorId: string, avaliadoId: string): Promise<AuraAvaliacao | undefined> {
    const [row] = await db.select().from(auraAvaliacoes)
      .where(and(eq(auraAvaliacoes.avaliador_membro_id, avaliadorId), eq(auraAvaliacoes.avaliado_membro_id, avaliadoId)));
    return row;
  }
}

export const storage = new DatabaseStorage();
