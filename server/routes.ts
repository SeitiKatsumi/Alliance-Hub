import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Validate Directus connection
  app.get("/api/directus/validate", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const response = await fetch(`${DIRECTUS_URL}/server/info`, {
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          success: false, 
          error: `Directus returned ${response.status}: ${errorText}` 
        });
      }

      const data = await response.json();
      res.json({ 
        success: true, 
        message: "Connected to Directus successfully",
        serverInfo: data.data
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Directus" 
      });
    }
  });

  // Get all collections from Directus
  app.get("/api/directus/collections", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const response = await fetch(`${DIRECTUS_URL}/collections`, {
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          success: false, 
          error: `Directus returned ${response.status}: ${errorText}` 
        });
      }

      const data = await response.json();
      res.json({ 
        success: true, 
        collections: data.data 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch collections" 
      });
    }
  });

  // Create a field in a collection
  app.post("/api/directus/collections/:collection/fields", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const { collection } = req.params;
      const fieldData = req.body;

      const response = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fieldData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({ 
          success: false, 
          error: errorData.errors?.[0]?.message || `Directus returned ${response.status}` 
        });
      }

      const data = await response.json();
      res.json({ 
        success: true, 
        field: data.data 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to create field" 
      });
    }
  });

  // Create multiple fields in a collection (batch)
  app.post("/api/directus/collections/:collection/fields/batch", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const { collection } = req.params;
      const { fields } = req.body;

      const results = [];
      const errors = [];

      for (const fieldData of fields) {
        try {
          const response = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(fieldData)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            errors.push({
              field: fieldData.field,
              error: errorData.errors?.[0]?.message || `Status ${response.status}`
            });
          } else {
            const data = await response.json();
            results.push(data.data);
          }
        } catch (err: any) {
          errors.push({
            field: fieldData.field,
            error: err.message
          });
        }
      }

      res.json({ 
        success: errors.length === 0, 
        created: results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to create fields" 
      });
    }
  });

  // Get fields for a specific collection
  app.get("/api/directus/collections/:collection/fields", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const { collection } = req.params;
      const response = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          success: false, 
          error: `Directus returned ${response.status}: ${errorText}` 
        });
      }

      const data = await response.json();
      res.json({ 
        success: true, 
        fields: data.data 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch fields" 
      });
    }
  });

  // Generic route to get items from any Directus collection
  app.get("/api/directus/:collection", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const { collection } = req.params;
      const response = await fetch(`${DIRECTUS_URL}/items/${collection}?limit=-1`, {
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          success: false, 
          error: `Directus returned ${response.status}: ${errorText}` 
        });
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch items" 
      });
    }
  });

  // Get single item from Directus collection
  app.get("/api/directus/:collection/:id", async (req, res) => {
    try {
      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "DIRECTUS_TOKEN not configured" 
        });
      }

      const { collection, id } = req.params;
      const response = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
        headers: {
          "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          success: false, 
          error: `Directus returned ${response.status}: ${errorText}` 
        });
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch item" 
      });
    }
  });

  // AI Assistant endpoint
  app.post("/api/assistant", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!DIRECTUS_TOKEN) {
        return res.status(500).json({ 
          success: false, 
          error: "Directus token not configured" 
        });
      }

      // Fetch current data from Directus for context
      const [membrosRes, biasRes, oportunidadesRes] = await Promise.all([
        fetch(`${DIRECTUS_URL}/items/cadastro_geral?limit=100`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
        }),
        fetch(`${DIRECTUS_URL}/items/BIAS?limit=100`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
        }),
        fetch(`${DIRECTUS_URL}/items/funil_de_conversao?limit=100`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
        })
      ]);

      if (!membrosRes.ok && !biasRes.ok && !oportunidadesRes.ok) {
        return res.status(502).json({ 
          success: false, 
          error: "Unable to fetch data from Directus" 
        });
      }

      const membrosData = membrosRes.ok ? (await membrosRes.json()).data : [];
      const biasData = biasRes.ok ? (await biasRes.json()).data : [];
      const oportunidadesData = oportunidadesRes.ok ? (await oportunidadesRes.json()).data : [];

      const systemPrompt = `Você é o assistente inteligente da Built Alliances, uma plataforma de gestão de membros, projetos BIA (Business Intelligence Analysis) e oportunidades de negócio.

DADOS ATUAIS DO SISTEMA:
- Total de Membros: ${membrosData.length}
- Total de BIAS (Projetos): ${biasData.length}
- Total de Oportunidades: ${oportunidadesData.length}

MEMBROS CADASTRADOS:
${membrosData.slice(0, 20).map((m: any) => `- ${m.nome_completo || 'N/A'} | Empresa: ${m.empresa || 'N/A'} | Especialidades: ${m.especialidades || 'N/A'}`).join('\n')}

PROJETOS BIA ATIVOS:
${biasData.slice(0, 15).map((b: any) => `- ${b.nome || b.titulo || 'Projeto'} | Status: ${b.status || 'N/A'} | Membros: ${b.membros_participantes?.length || 0}`).join('\n')}

OPORTUNIDADES NO FUNIL:
${oportunidadesData.slice(0, 15).map((o: any) => `- ${o.titulo || o.nome || 'Oportunidade'} | Valor: R$ ${o.valor || 0} | Status: ${o.status || 'N/A'}`).join('\n')}

SUAS CAPACIDADES:
1. Analisar dados de membros, BIAS e oportunidades
2. Sugerir conexões estratégicas entre membros
3. Identificar oportunidades de negócio
4. Recomendar BIAS baseado em especialidades
5. Fornecer insights sobre performance e métricas
6. Ajudar na tomada de decisões estratégicas

Responda sempre em português brasileiro, de forma clara e objetiva. Use emojis moderadamente para tornar as respostas mais visuais.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const assistantMessage = response.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

      res.json({ 
        success: true, 
        message: assistantMessage,
        stats: {
          membros: membrosData.length,
          bias: biasData.length,
          oportunidades: oportunidadesData.length
        }
      });
    } catch (error: any) {
      console.error("AI Assistant error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to process request" 
      });
    }
  });

  return httpServer;
}
