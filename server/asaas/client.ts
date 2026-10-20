import type { AsaasConfig } from "./config";

export class AsaasError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 503) { super(message); }
}

export class AsaasClient {
  constructor(private readonly config: AsaasConfig) {}

  async request(method: "GET" | "POST" | "PUT" | "DELETE", endpoint: string, body?: unknown): Promise<Record<string, unknown>> {
    return new AsaasTransport(this.config).request(endpoint, { method, body });
  }

}

export class AsaasTransport {
  constructor(private readonly config: AsaasConfig, private readonly transport: typeof fetch = fetch, private readonly timeoutMs = 15_000) {}

  async request(endpoint: string, options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<Record<string, unknown>> {
    if (!this.config.configurationValid || !this.config.enabled || !this.config.apiKey || !this.config.productionOperationsEnabled) throw new AsaasError("NOT_CONFIGURED", "Ambiente Asaas não configurado ou não autorizado.");
    if (!/^\/[A-Za-z0-9/_-]+(?:\?[A-Za-z0-9_=&%.-]*)?$/.test(endpoint) || endpoint.includes("..") || endpoint.includes("//")) throw new AsaasError("INVALID_ENDPOINT", "Endpoint Asaas inválido.", 400);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const method = options.method || "GET";
      if (!["GET", "POST", "PUT", "DELETE"].includes(method) || (method === "GET" && options.body !== undefined)) throw new AsaasError("INVALID_REQUEST", "Pedido Asaas inválido.", 400);
      const response = await this.transport(`${this.config.baseUrl}${endpoint}`, {
        method, redirect: "error", signal: controller.signal,
        headers: { access_token: this.config.apiKey, "User-Agent": "BUILT/1.0", Accept: "application/json", ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 422) throw new AsaasError("PROVIDER_REJECTED", "O Asaas recusou os dados informados. Revise o cadastro e tente novamente.", 422);
        throw new AsaasError("PROVIDER_ERROR", "O Asaas não confirmou a solicitação.", 502);
      }
      if (!/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) throw new AsaasError("INVALID_RESPONSE", "Resposta Asaas inválida.", 502);
      let data: unknown;
      try { data = await response.json(); }
      catch { throw new AsaasError(controller.signal.aborted ? "TIMEOUT" : "INVALID_RESPONSE", controller.signal.aborted ? "Consulta Asaas excedeu o prazo; resultado não confirmado." : "Resposta Asaas inválida.", 502); }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new AsaasError("INVALID_RESPONSE", "Resposta Asaas inválida.", 502);
      return data as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AsaasError) throw error;
      throw new AsaasError(controller.signal.aborted ? "TIMEOUT" : "TRANSPORT_ERROR", controller.signal.aborted ? "Consulta Asaas excedeu o prazo; resultado não confirmado." : "Não foi possível consultar o Asaas.", 502);
    } finally { clearTimeout(timer); }
  }
}
