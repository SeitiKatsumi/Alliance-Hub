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
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
}

export const storage = new DatabaseStorage();
