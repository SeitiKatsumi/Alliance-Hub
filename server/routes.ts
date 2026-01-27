import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

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

  return httpServer;
}
