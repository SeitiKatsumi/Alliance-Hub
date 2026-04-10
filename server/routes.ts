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

async function ensureBiasGeoFields() {
  const fields = [
    { field: "latitude", type: "float", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
    { field: "longitude", type: "float", meta: { interface: "input", display: "raw", hidden: false }, schema: { is_nullable: true } },
  ];
  for (const fieldDef of fields) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/bias_projetos`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(fieldDef),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.errors?.[0]?.extensions?.code;
        if (code !== "RECORD_NOT_UNIQUE" && code !== "FORBIDDEN") {
          console.warn(`[geo] Field ${fieldDef.field} response: ${res.status}`);
        }
      } else {
        console.log(`[geo] Field ${fieldDef.field} created in bias_projetos`);
      }
    } catch (e) {
      // silently ignore network errors
    }
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

  // Ensure geo fields exist in Directus
  ensureBiasGeoFields().catch(console.error);
  ensureBiasExtraFields().catch(console.error);
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

  // ========== MEMBROS (from Directus: cadastro_geral) ==========
  app.get("/api/membros", async (req, res) => {
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
            // M2M junction: try nested object fields
            const nested = e?.Especialidades_id || e?.especialidade_id || e;
            if (typeof nested === "object" && nested !== null) {
              return nested.nome || nested.name || nested.titulo || nested.label || String(nested.id || "");
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
    try {
      const m = await directusFetchOne("cadastro_geral", req.params.id, "fields=*");
      if (!m) return res.status(404).json({ error: "Membro não encontrado" });
      res.json({
        ...m,
        cargo: m.cargo || m.responsavel_cargo || null,
        foto: m.foto_perfil || m.foto || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros", async (req, res) => {
    try {
      const item = await directusCreate("cadastro_geral", req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/membros/:id", async (req, res) => {
    try {
      const item = await directusUpdate("cadastro_geral", req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id", async (req, res) => {
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
      const item = await directusUpdate("bias_projetos", req.params.id, prepareBiaPayload(req.body));
      if (req.body.valor_origem !== undefined) {
        const valorOrigem = parseFloat(req.body.valor_origem) || 0;
        syncValorOrigemLancamento(req.params.id, valorOrigem).catch(console.error);
      }
      res.json(item);
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
      const items = await directusFetch("fluxo_caixa", "fields=*,Categoria.categorias_id.*,tipo_de_cpp.tipos_cpp_id.*,Anexos.directus_files_id.*");
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
          Favorecido: f.favorecido_id ? [{ id: f.favorecido_id }] : [],
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
      Anexos: (o.Anexos || []).map((a: any) => {
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
      const items = await directusFetch("tipos_oportunidades", "fields=*,Anexos.directus_files_id.*");
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
      data.Anexos = validIds.map((fileId: string) => ({ directus_files_id: fileId }));
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
        const membros = await directusFetch("cadastro_geral", `filter[email][_eq]=${encodeURIComponent(email)}&fields=id,Nome_de_usuario,nome,primeiro_nome,sobrenome`);
        if (membros.length > 0) {
          membroId = membros[0].id;
          const m = membros[0];
          nome = m.Nome_de_usuario || [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") || m.nome || nome;
        }
      } catch { /* ignore lookup failure */ }

      // Store session
      (req.session as any).directusUserId = directusUser.id;
      (req.session as any).membroId = membroId;
      (req.session as any).nome = nome;
      (req.session as any).email = email;

      res.json({
        id: directusUser.id,
        nome,
        email,
        membro_directus_id: membroId,
        role: "user",
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
      role: "user",
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

  return httpServer;
}
