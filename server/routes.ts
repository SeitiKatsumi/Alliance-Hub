import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createUserSchema, updateUserSchema, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".doc", ".docx", ".xls", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${ext}`));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", express.static(uploadsDir));

  app.post("/api/upload", (req, res) => {
    upload.array("files", 10)(req, res, (err) => {
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
      const urls = files.map((f) => `/uploads/${f.filename}`);
      res.json({ success: true, urls });
    });
  });

  // ========== MEMBROS ==========
  app.get("/api/membros", async (req, res) => {
    try {
      const items = await storage.getAllMembros();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/membros/:id", async (req, res) => {
    try {
      const item = await storage.getMembro(req.params.id);
      if (!item) return res.status(404).json({ error: "Membro não encontrado" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/membros", async (req, res) => {
    try {
      const item = await storage.createMembro(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/membros/:id", async (req, res) => {
    try {
      const item = await storage.updateMembro(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Membro não encontrado" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/membros/:id", async (req, res) => {
    try {
      const ok = await storage.deleteMembro(req.params.id);
      if (!ok) return res.status(404).json({ error: "Membro não encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== BIAS PROJETOS ==========
  app.get("/api/bias", async (req, res) => {
    try {
      const items = await storage.getAllBias();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bias/:id", async (req, res) => {
    try {
      const item = await storage.getBia(req.params.id);
      if (!item) return res.status(404).json({ error: "BIA não encontrada" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bias", async (req, res) => {
    try {
      const item = await storage.createBia(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/bias/:id", async (req, res) => {
    try {
      const item = await storage.updateBia(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "BIA não encontrada" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bias/:id", async (req, res) => {
    try {
      const ok = await storage.deleteBia(req.params.id);
      if (!ok) return res.status(404).json({ error: "BIA não encontrada" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== FLUXO DE CAIXA ==========
  app.get("/api/fluxo-caixa", async (req, res) => {
    try {
      const items = await storage.getAllFluxoCaixa();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fluxo-caixa", async (req, res) => {
    try {
      const body = req.body;
      const data = {
        bia_id: body.bia || body.bia_id || null,
        tipo: body.tipo,
        valor: String(body.valor),
        data: body.data || null,
        descricao: body.descricao || null,
        membro_responsavel_id: body.membro_responsavel || body.membro_responsavel_id || null,
        categoria_id: body.categoria_id || (body.Categoria && body.Categoria[0] ? String(body.Categoria[0]) : null),
        tipo_cpp_id: body.tipo_cpp_id || (body.tipo_de_cpp && body.tipo_de_cpp[0] ? String(body.tipo_de_cpp[0]) : null),
        favorecido_id: body.favorecido_id || (body.Favorecido && body.Favorecido[0] ? String(body.Favorecido[0]) : null),
        anexos: body.anexos || [],
      };
      const item = await storage.createFluxoCaixa(data);
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
      if (body.membro_responsavel !== undefined || body.membro_responsavel_id !== undefined) {
        data.membro_responsavel_id = body.membro_responsavel || body.membro_responsavel_id || null;
      }
      if (body.categoria_id !== undefined) data.categoria_id = body.categoria_id;
      if (body.Categoria !== undefined) data.categoria_id = body.Categoria[0] ? String(body.Categoria[0]) : null;
      if (body.tipo_cpp_id !== undefined) data.tipo_cpp_id = body.tipo_cpp_id;
      if (body.tipo_de_cpp !== undefined) data.tipo_cpp_id = body.tipo_de_cpp[0] ? String(body.tipo_de_cpp[0]) : null;
      if (body.favorecido_id !== undefined) data.favorecido_id = body.favorecido_id;
      if (body.Favorecido !== undefined) data.favorecido_id = body.Favorecido[0] ? String(body.Favorecido[0]) : null;
      if (body.anexos !== undefined) data.anexos = body.anexos;

      const item = await storage.updateFluxoCaixa(req.params.id, data);
      if (!item) return res.status(404).json({ error: "Lançamento não encontrado" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      const ok = await storage.deleteFluxoCaixa(req.params.id);
      if (!ok) return res.status(404).json({ error: "Lançamento não encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TIPOS CPP ==========
  app.get("/api/tipos-cpp", async (req, res) => {
    try {
      const items = await storage.getAllTiposCpp();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tipos-cpp", async (req, res) => {
    try {
      const item = await storage.createTipoCpp(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== CATEGORIAS ==========
  app.get("/api/categorias", async (req, res) => {
    try {
      const items = await storage.getAllCategorias();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categorias", async (req, res) => {
    try {
      const item = await storage.createCategoria(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== OPORTUNIDADES ==========
  app.get("/api/oportunidades", async (req, res) => {
    try {
      const items = await storage.getAllOportunidades();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/oportunidades", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.bia && !body.bia_id) { body.bia_id = body.bia; delete body.bia; }
      const item = await storage.createOportunidade(body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/oportunidades/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.bia && !body.bia_id) { body.bia_id = body.bia; delete body.bia; }
      const item = await storage.updateOportunidade(req.params.id, body);
      if (!item) return res.status(404).json({ error: "Oportunidade não encontrada" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== AI ANALYZE (per-item) ==========
  app.post("/api/analyze/bia/:id", async (req, res) => {
    try {
      const bia = await storage.getBia(req.params.id);
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
        storage.getAllMembros(),
        storage.getAllBias(),
        storage.getAllOportunidades(),
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
