import { createCipheriv, createDecipheriv } from "crypto";

type PinbankRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  encrypted?: boolean;
};

type PinbankEnvelope<T = unknown> = {
  Data?: T;
  ResultCode?: number;
  Message?: string;
  ValidationData?: {
    ResultCode?: number;
    Message?: string;
    Errors?: Array<{ ErrorMessage?: string; FieldName?: string }>;
  };
  [key: string]: unknown;
};

export type PinbankDocumentPayload = {
  codigoCliente?: number | null;
  codigoCanal?: number | null;
  tipoDocumento: number;
  nomeArquivo: string;
  formatoArquivo: string;
  base64Arquivo: string;
  grauParentescoTitular?: string | null;
  rgCnhPossuiNumeroCpf?: boolean;
};

export type PinbankCompanyOnboardingPayload = {
  codigoCanal?: number | null;
  nome: string;
  dataNascimento?: string | null;
  sexo?: string | null;
  cpf?: string | number | null;
  rg?: string | null;
  rgEmissor?: string | null;
  rgDataEmissao?: string | null;
  email?: string | null;
  estadoCivil?: string | null;
  grauEscolar?: string | null;
  nomeMae?: string | null;
  nomePai?: string | null;
  paisOrigem?: string | null;
  celular?: string | null;
  enderecoResidencial?: Record<string, unknown> | null;
  telefoneResidencial?: string | null;
  enderecoComercial?: Record<string, unknown> | null;
  telefoneComercial?: string | null;
  dadosBancarios?: Record<string, unknown> | null;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string | number;
  dataConstituicao?: string | null;
  nomeComprovante?: string | null;
  listaSocios: Array<{ NomeSocio: string; CpfSocio?: string | number | null; PepSocio: boolean }>;
  ramoAtividade?: number | null;
  senha?: string | null;
  enviarEmailPrimAcesso?: boolean;
  pep?: boolean;
  idTermo?: string | number | null;
  rendaPatrimonio?: Record<string, unknown> | null;
};

export type PinbankChargePayload = {
  codigoCliente?: number | string | null;
  codigoCanal?: number | string | null;
  valor: number;
  vencimento?: string | null;
  descricao?: string | null;
  pagadorNome?: string | null;
  pagadorDocumento?: string | null;
  pagadorEmail?: string | null;
  pagadorTelefone?: string | null;
  split?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type PinbankChargeQueryPayload = {
  codigoCliente?: number | string | null;
  codigoCanal?: number | string | null;
  nossoNumero?: string | null;
  paymentId?: string | null;
  chargeId?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
};

export const PINBANK_API_DOCS = {
  auth: {
    label: "Gerar token de acesso",
    url: "https://pbdocprod.apidog.io/gerar-token-de-acesso-27215435e0",
  },
  authorization: {
    label: "Autorizando as requisições",
    url: "https://pbdocprod.apidog.io/-passo-3-autorizando-as-requisi%C3%A7%C3%B5es-ajustar-bonicio-1645210m0",
  },
  terms: {
    label: "Recuperar termos de uso para aceite formal",
    url: "https://pbdocprod.apidog.io/recuperar-termos-de-uso-para-aceite-formal-28366573e0",
  },
  companyOnboarding: {
    label: "Iniciar onboarding de empresa (PJ)",
    url: "https://pbdocprod.apidog.io/iniciar-onboarding-de-empresa-pj-28366576e0",
  },
  uploadIdentityDocuments: {
    label: "Fazer upload de documentos de identificação",
    url: "https://pbdocprod.apidog.io/fazer-upload-de-documentos-de-identifica%C3%A7%C3%A3o-28366579e0",
  },
  createBoleto: {
    label: "Gerar boleto de cobrança",
    url: "https://pbdocprod.apidog.io/gerar-boleto-de-cobran%C3%A7a-28366511e0",
  },
  createSplitBoleto: {
    label: "Emitir boleto com split de valores",
    url: "https://pbdocprod.apidog.io/emitir-boleto-com-split-de-valores-28366512e0",
  },
  createPaymentLink: {
    label: "Gerar um link de pagamento",
    url: "https://pbdocprod.apidog.io/gerar-um-link-de-pagamento-28366536e0",
  },
  cancelBoleto: {
    label: "Cancelar cobrança via boleto",
    url: "https://pbdocprod.apidog.io/cancelar-cobran%C3%A7a-via-boleto-28366516e0",
  },
  getBoletoStatus: {
    label: "Consultar o status de um boleto",
    url: "https://pbdocprod.apidog.io/consultar-o-status-de-um-boleto-28366513e0",
  },
  listBoletos: {
    label: "Consultar boletos em lote",
    url: "https://pbdocprod.apidog.io/consultar-boletos-em-lote-28366514e0",
  },
  chargeMetrics: {
    label: "Obter métricas e indicadores de cobrança",
    url: "https://pbdocprod.apidog.io/obter-m%C3%A9tricas-e-indicadores-de-cobran%C3%A7a-28366515e0",
  },
  documentInventory: {
    label: "Verificar inventário e pendências de documentos",
    url: "https://pbdocprod.apidog.io/verificar-invent%C3%A1rio-e-pend%C3%AAncias-de-documentos-28366580e0",
  },
  replaceDocument: {
    label: "Substituir documento reprovado ou expirado",
    url: "https://pbdocprod.apidog.io/substituir-documento-reprovado-ou-expirado-28366581e0",
  },
  documentStatus: {
    label: "Consultar status dos documentos",
    url: "https://pbdocprod.apidog.io/consultar-status-dos-documentos-28366582e0",
  },
  balance: {
    label: "Consultar saldo disponível na conta",
    url: "https://pbdocprod.apidog.io/consultar-saldo-dispon%C3%ADvel-na-conta-28366584e0",
  },
  statement: {
    label: "Consultar extrato da conta",
    url: "https://pbdocprod.apidog.io/consultar-extrato-da-conta-28366585e0",
  },
  transactionReceipt: {
    label: "Consultar comprovante detalhado de transação",
    url: "https://pbdocprod.apidog.io/consultar-comprovante-detalhado-de-transa%C3%A7%C3%A3o-28366586e0",
  },
} as const;

const ENDPOINTS = {
  token: "/api/token",
  terms: "/api/ContaDigital/TermosDeUso",
  companyOnboarding: "/api/ContaDigital/CadastroPj",
  uploadDocument: "/api/ContaDigital/IncluirDocumento",
  documentStatus: "/api/ContaDigital/ConsultarStatusDocumento",
  documentInventory: "/api/ContaDigital/GetInventario",
  replaceDocument: "/api/ContaDigital/SubstituirDocumento",
  createBoleto: "/api/Cobranca/GerarBoleto",
  createSplitBoleto: "/api/Cobranca/GerarBoletoSplit",
  createPaymentLink: "/api/Cobranca/GerarLinkPagamento",
  cancelBoleto: "/api/Cobranca/CancelarBoleto",
  boletoStatus: "/api/Cobranca/ConsultarBoleto",
  listBoletos: "/api/Cobranca/ConsultarBoletos",
  chargeMetrics: "/api/Cobranca/Metricas",
  balance: "/api/ContaDigital/Saldo",
  statement: "/api/ContaDigital/Extrato",
  transactionReceipt: "/api/ContaDigital/Comprovante",
} as const;

export class PinbankClient {
  private baseUrl = (process.env.PINBANK_BASE_URL || "").replace(/\/$/, "");
  private username = process.env.PINBANK_USERNAME || process.env.PINBANK_USER_NAME || "";
  private password = process.env.PINBANK_PASSWORD || process.env.PINBANK_KEY_VALUE || process.env.PINBANK_API_KEY || "";
  private bearerSeed = process.env.PINBANK_TOKEN_SEED || process.env.PINBANK_AUTHORIZATION_TOKEN || "";
  private requestOrigin = process.env.PINBANK_REQUEST_ORIGIN || "";
  private codigoCanal = Number(process.env.PINBANK_CODIGO_CANAL || "0") || 0;
  private codigoCliente = Number(process.env.PINBANK_CODIGO_CLIENTE || "0") || 0;
  private disableEncryption = process.env.PINBANK_DISABLE_ENCRYPTION === "true";
  private tokenCache: { value: string; expiresAt: number } | null = null;

  get configured() {
    return this.getConfigStatus().configured;
  }

  get authConfigured() {
    return !!this.baseUrl && !!this.username && !!this.password;
  }

  get defaultCodigoCanal() {
    return this.codigoCanal;
  }

  get defaultCodigoCliente() {
    return this.codigoCliente;
  }

  getConfigStatus() {
    const aes = this.getAesKeyStatus();
    const checks = [
      { key: "PINBANK_BASE_URL", ok: !!this.baseUrl, label: "URL base da API PINBANK" },
      { key: "PINBANK_USERNAME", ok: !!this.username, label: "Usuário de autenticação" },
      { key: "PINBANK_PASSWORD ou PINBANK_KEY_VALUE", ok: !!this.password, label: "Senha/KeyValue de autenticação" },
      { key: "PINBANK_REQUEST_ORIGIN", ok: !!this.requestOrigin, label: "Origem autorizada das requisições" },
      { key: "PINBANK_AES_KEY ou PINBANK_KEY_VALUE", ok: aes.valid, label: "Chave AES de 16 bytes" },
      { key: "PINBANK_CODIGO_CANAL", ok: !!this.codigoCanal, label: "Código do canal PINBANK" },
    ];
    const missing = checks.filter((item) => !item.ok).map((item) => item.key);
    return {
      provider: "pinbank",
      configured: missing.length === 0,
      mode: missing.length === 0 ? "live" : "stub",
      missing,
      checks,
      encryptionEnabled: !this.disableEncryption,
      aesKeyBytes: aes.length,
    };
  }

  async getTerms(codigoCliente = this.codigoCliente, codigoTermo = process.env.PINBANK_CODIGO_TERMO || "") {
    if (!this.configured) {
      return {
        provider: "pinbank",
        version: "pinbank_terms_pending",
        title: "Termos de Uso PINBANK",
        body:
          "Declaro estar ciente e de acordo com o uso e compartilhamento dos dados e documentos da BIA para abertura, KYC e operação da conta digital vinculada à BIA. Quando a integração PINBANK estiver configurada no ambiente, o aceite será vinculado ao termo oficial retornado pela instituição.",
      };
    }
    const result = await this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_TERMS_PATH || ENDPOINTS.terms,
      encrypted: true,
      body: {
        Data: {
          CodigoTermo: codigoTermo,
          CodigoCliente: codigoCliente || 0,
          CodigoCanal: this.codigoCanal,
          retonaBase64: true,
          retornaArqHeader: true,
          retonaConteudoArquivo: true,
        },
      },
    });
    const data = result.Data || {};
    return {
      provider: "pinbank",
      version: String(data.IdTermo || codigoTermo || "pinbank_terms"),
      title: data.Termo || "Termos de Uso PINBANK",
      body: data.termoConteudo || data.termoBase64 || data.TermoArquivo || result.Message || "",
      docUrl: PINBANK_API_DOCS.terms.url,
      raw: result,
    };
  }

  async startCompanyOnboarding(payload: PinbankCompanyOnboardingPayload) {
    if (!this.configured) {
      return {
        provider: "pinbank",
        externalId: `pinbank_stub_${Date.now()}`,
        status: "in_review",
        raw: {
          mode: "stub",
          reason: "Credenciais PINBANK não configuradas",
          docUrl: PINBANK_API_DOCS.companyOnboarding.url,
          payload,
        },
      };
    }
    const result = await this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_COMPANY_ONBOARDING_PATH || ENDPOINTS.companyOnboarding,
      encrypted: true,
      body: { Data: this.toCadastroPjData(payload) },
    });
    const data = result.Data || {};
    return {
      provider: "pinbank",
      externalId: data.CodigoCliente || data.KeyLoja || null,
      status: inferPinbankOnboardingStatus(data),
      raw: result,
    };
  }

  async uploadDocument(payload: PinbankDocumentPayload) {
    if (!this.configured) {
      return {
        provider: "pinbank",
        externalId: `pinbank_doc_stub_${Date.now()}`,
        status: "sent",
        raw: { mode: "stub", reason: "Credenciais PINBANK não configuradas", payload: { ...payload, base64Arquivo: "[base64]" } },
      };
    }
    const result = await this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_UPLOAD_DOCUMENT_PATH || ENDPOINTS.uploadDocument,
      encrypted: true,
      body: {
        Data: {
          CodigoCanal: payload.codigoCanal ?? this.codigoCanal,
          CodigoCliente: payload.codigoCliente ?? this.codigoCliente,
          RgCnhPossuiNumeroCpf: payload.rgCnhPossuiNumeroCpf ?? true,
          CodigoRetorno: 0,
          ListaDocumentos: [
            {
              TipoDocumento: payload.tipoDocumento,
              NomeArquivo: payload.nomeArquivo,
              FormatoArquivo: payload.formatoArquivo,
              Base64Arquivo: payload.base64Arquivo,
              GrauParentescoTitular: payload.grauParentescoTitular || "",
            },
          ],
        },
      },
    });
    const first = Array.isArray(result.Data) ? result.Data[0] : result.Data;
    return {
      provider: "pinbank",
      externalId: first?.CodigoDocumento || first?.codigoDocumento || null,
      status: "sent",
      raw: result,
    };
  }

  async getDocumentStatus(codigoCliente = this.codigoCliente) {
    if (!this.configured || !codigoCliente) {
      return null;
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_DOCUMENT_STATUS_PATH || ENDPOINTS.documentStatus,
      encrypted: true,
      body: {
        Data: {
          CodigoCanal: this.codigoCanal,
          CodigoCliente: codigoCliente,
        },
      },
    });
  }

  async getDocumentInventory(codigoCliente = this.codigoCliente) {
    if (!this.configured || !codigoCliente) {
      return {
        provider: "pinbank",
        status: "stub",
        raw: { mode: "stub", documentos: [] },
      };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_DOCUMENT_INVENTORY_PATH || ENDPOINTS.documentInventory,
      encrypted: true,
      body: {
        Data: {
          CodigoCanal: this.codigoCanal,
          CodigoCliente: codigoCliente,
        },
      },
    });
  }

  async replaceDocument(payload: PinbankDocumentPayload & { providerDocumentId?: string | null }) {
    if (!this.configured) {
      return {
        provider: "pinbank",
        externalId: payload.providerDocumentId || `pinbank_doc_replace_stub_${Date.now()}`,
        status: "sent",
        raw: { mode: "stub", reason: "Credenciais PINBANK nao configuradas", payload: { ...payload, base64Arquivo: "[base64]" } },
      };
    }
    const result = await this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_REPLACE_DOCUMENT_PATH || ENDPOINTS.replaceDocument,
      encrypted: true,
      body: {
        Data: {
          CodigoCanal: payload.codigoCanal ?? this.codigoCanal,
          CodigoCliente: payload.codigoCliente ?? this.codigoCliente,
          CodigoDocumento: payload.providerDocumentId || undefined,
          TipoDocumento: payload.tipoDocumento,
          NomeArquivo: payload.nomeArquivo,
          FormatoArquivo: payload.formatoArquivo,
          Base64Arquivo: payload.base64Arquivo,
          GrauParentescoTitular: payload.grauParentescoTitular || "",
        },
      },
    });
    const data = Array.isArray(result.Data) ? result.Data[0] : result.Data;
    return {
      provider: "pinbank",
      externalId: data?.CodigoDocumento || data?.codigoDocumento || payload.providerDocumentId || null,
      status: "sent",
      raw: result,
    };
  }

  async createBoleto(payload: PinbankChargePayload) {
    if (!this.configured) return this.stubCharge("boleto", payload);
    return this.createChargeWithPath(
      process.env.PINBANK_CREATE_BOLETO_PATH || ENDPOINTS.createBoleto,
      "boleto",
      payload,
    );
  }

  async createSplitBoleto(payload: PinbankChargePayload) {
    if (!this.configured) return this.stubCharge("boleto_split", payload);
    return this.createChargeWithPath(
      process.env.PINBANK_CREATE_SPLIT_BOLETO_PATH || ENDPOINTS.createSplitBoleto,
      "boleto_split",
      payload,
    );
  }

  async createPaymentLink(payload: PinbankChargePayload) {
    if (!this.configured) return this.stubCharge("link_pagamento", payload);
    return this.createChargeWithPath(
      process.env.PINBANK_CREATE_PAYMENT_LINK_PATH || ENDPOINTS.createPaymentLink,
      "link_pagamento",
      payload,
    );
  }

  async cancelBoleto(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", status: "cancelled", raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_CANCEL_BOLETO_PATH || ENDPOINTS.cancelBoleto,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  async getBoletoStatus(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", status: "pending", raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_BOLETO_STATUS_PATH || ENDPOINTS.boletoStatus,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  async listBoletos(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", items: [], raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_LIST_BOLETOS_PATH || ENDPOINTS.listBoletos,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  async getChargeMetrics(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", total: 0, paid: 0, pending: 0, cancelled: 0, raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_CHARGE_METRICS_PATH || ENDPOINTS.chargeMetrics,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  async getBalance(codigoCliente = this.codigoCliente) {
    if (!this.configured || !codigoCliente) {
      return { provider: "pinbank", available: 0, blocked: 0, currency: "BRL", raw: { mode: "stub" } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_BALANCE_PATH || ENDPOINTS.balance,
      encrypted: true,
      body: {
        Data: {
          CodigoCanal: this.codigoCanal,
          CodigoCliente: codigoCliente,
        },
      },
    });
  }

  async getStatement(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", items: [], raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_STATEMENT_PATH || ENDPOINTS.statement,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  async getTransactionReceipt(payload: PinbankChargeQueryPayload) {
    if (!this.configured) {
      return { provider: "pinbank", status: "available", raw: { mode: "stub", payload } };
    }
    return this.request<PinbankEnvelope<any>>({
      method: "POST",
      path: process.env.PINBANK_TRANSACTION_RECEIPT_PATH || ENDPOINTS.transactionReceipt,
      encrypted: true,
      body: { Data: this.toChargeQueryData(payload) },
    });
  }

  getDocumentationLinks() {
    return PINBANK_API_DOCS;
  }

  private async createChargeWithPath(path: string, kind: "boleto" | "boleto_split" | "link_pagamento", payload: PinbankChargePayload) {
    const result = await this.request<PinbankEnvelope<any>>({
      method: "POST",
      path,
      encrypted: true,
      body: { Data: this.toChargeData(payload) },
    });
    return this.normalizeChargeResult(kind, payload, result);
  }

  private normalizeChargeResult(kind: "boleto" | "boleto_split" | "link_pagamento", payload: PinbankChargePayload, result: PinbankEnvelope<any>) {
    const data: any = Array.isArray(result.Data) ? result.Data[0] : (result.Data || {});
    const id = data.Id || data.id || data.CodigoBoleto || data.codigoBoleto || data.NossoNumero || data.nossoNumero || data.NumeroDocumento || null;
    return {
      provider: "pinbank",
      type: kind,
      externalId: id,
      nossoNumero: data.NossoNumero || data.nossoNumero || data.NumeroDocumento || data.numeroDocumento || id,
      status: data.Status || data.status || data.Situacao || "pending",
      url: data.Url || data.url || data.LinkPagamento || data.linkPagamento || data.BoletoUrl || data.bankSlipUrl || null,
      linhaDigitavel: data.LinhaDigitavel || data.linhaDigitavel || null,
      valor: payload.valor,
      vencimento: payload.vencimento || null,
      raw: result,
    };
  }

  private stubCharge(kind: "boleto" | "boleto_split" | "link_pagamento", payload: PinbankChargePayload) {
    const id = `pinbank_${kind}_stub_${Date.now()}`;
    const base = (process.env.APP_URL || "http://localhost:3004").replace(/\/$/, "");
    return {
      provider: "pinbank",
      type: kind,
      externalId: id,
      nossoNumero: id,
      status: "pending",
      url: `${base}/pagamento/${id}`,
      linhaDigitavel: kind === "link_pagamento" ? null : `00000.00000 00000.000000 00000.000000 0 00000000000000`,
      valor: payload.valor,
      vencimento: payload.vencimento || null,
      raw: { mode: "stub", reason: "Credenciais PINBANK nao configuradas", payload },
    };
  }

  private toChargeData(payload: PinbankChargePayload) {
    return compactObject({
      CodigoCanal: payload.codigoCanal ?? this.codigoCanal,
      CodigoCliente: payload.codigoCliente ?? this.codigoCliente,
      Valor: Number(payload.valor || 0),
      DataVencimento: normalizeDateOnly(payload.vencimento),
      Descricao: payload.descricao || "Cobranca BIA BUILT",
      Pagador: compactObject({
        Nome: payload.pagadorNome || "",
        Documento: onlyDigits(payload.pagadorDocumento),
        Email: payload.pagadorEmail || "",
        Telefone: onlyDigits(payload.pagadorTelefone),
      }),
      Split: payload.split,
      Metadata: payload.metadata,
    });
  }

  private toChargeQueryData(payload: PinbankChargeQueryPayload) {
    return compactObject({
      CodigoCanal: payload.codigoCanal ?? this.codigoCanal,
      CodigoCliente: payload.codigoCliente ?? this.codigoCliente,
      NossoNumero: payload.nossoNumero || undefined,
      CodigoBoleto: payload.paymentId || payload.chargeId || undefined,
      Id: payload.paymentId || payload.chargeId || undefined,
      DataInicio: normalizeDateOnly(payload.dataInicio),
      DataFim: normalizeDateOnly(payload.dataFim),
      CodigoTransacao: payload.transactionId || undefined,
      TransactionId: payload.transactionId || undefined,
      Metadata: payload.metadata,
    });
  }

  private toCadastroPjData(payload: PinbankCompanyOnboardingPayload) {
    const celular = splitBrazilPhone(payload.celular);
    const telefoneResidencial = splitBrazilPhone(payload.telefoneResidencial || payload.celular);
    const telefoneComercial = splitBrazilPhone(payload.telefoneComercial);
    const enderecoResidencial = payload.enderecoResidencial || {};
    const enderecoComercial = payload.enderecoComercial || {};
    const dadosBancarios = payload.dadosBancarios || {};
    return compactObject({
      CodigoCanal: payload.codigoCanal ?? this.codigoCanal,
      Nome: payload.nome,
      DataNascimento: normalizeIsoDate(payload.dataNascimento),
      Sexo: payload.sexo || "N",
      Cpf: onlyDigits(payload.cpf),
      Rg: payload.rg || "",
      RgEmissor: payload.rgEmissor || "",
      RgDataEmissao: normalizeIsoDate(payload.rgDataEmissao),
      Email: payload.email || "",
      EstadoCivil: normalizeEstadoCivil(payload.estadoCivil),
      GrauEscolar: payload.grauEscolar || "NaoInformado",
      NomeMae: payload.nomeMae || "",
      NomePai: payload.nomePai || "",
      PaisOrigem: payload.paisOrigem || "Brasil",
      DdiCelular: celular.ddi,
      DddCelular: celular.ddd,
      NumeroCelular: celular.numero,
      Operadora: 0,
      TipoSO: 0,
      EnderecoResidencial: compactObject({
        EndeResCep: onlyDigits(enderecoResidencial.cep),
        EndeResLogradouro: enderecoResidencial.endereco || enderecoResidencial.logradouro || "",
        EndeResNumero: enderecoResidencial.numero || "S/N",
        EndeResComplemento: enderecoResidencial.complemento || "",
        EndeResEstado: enderecoResidencial.estado || "",
        EndeResCidade: enderecoResidencial.cidade || "",
        EndeResBairro: enderecoResidencial.bairro || "",
      }),
      TelefoneResidencial: compactObject({
        DdiTelefoneResidencial: telefoneResidencial.ddi,
        DddTelefoneResidencial: telefoneResidencial.ddd,
        NumeroTelefoneResidencial: telefoneResidencial.numero,
      }),
      EnderecoComercial: compactObject({
        EndeComCep: onlyDigits(enderecoComercial.cep),
        EndeComLogradouro: enderecoComercial.endereco || enderecoComercial.logradouro || "",
        EndeComNumero: enderecoComercial.numero || "S/N",
        EndeComComplemento: enderecoComercial.complemento || "",
        EndeComEstado: enderecoComercial.estado || "",
        EndeComCidade: enderecoComercial.cidade || "",
        EndeComBairro: enderecoComercial.bairro || "",
      }),
      TelefoneComercial: compactObject({
        DddTelefoneComercial: telefoneComercial.ddd,
        NumeroTelefoneComercial: telefoneComercial.numero,
        RamalTelefoneComercial: 0,
      }),
      DadosBancarios: compactObject({
        CodBanco: dadosBancarios.banco || dadosBancarios.codBanco || "",
        Agencia: dadosBancarios.agencia || "",
        Conta: dadosBancarios.conta || "",
        TipoConta: dadosBancarios.tipo_conta || dadosBancarios.tipoConta || "Corrente",
        NomeContaCorrente: dadosBancarios.titular_conta || dadosBancarios.nomeContaCorrente || payload.razaoSocial,
        CpfCnpjContaCorrente: onlyDigits(dadosBancarios.cpfCnpj || payload.cnpj),
      }),
      RazaoSocial: payload.razaoSocial,
      NomeFantasia: payload.nomeFantasia || payload.razaoSocial,
      CNPJ: onlyDigits(payload.cnpj),
      DataConstituicao: normalizeIsoDate(payload.dataConstituicao),
      NomeComprovante: payload.nomeComprovante || payload.razaoSocial,
      ListaSocios: payload.listaSocios,
      RamoAtividade: payload.ramoAtividade || 0,
      Senha: payload.senha || process.env.PINBANK_DEFAULT_ACCOUNT_PASSWORD || "",
      EnviarEmailPrimAcesso: payload.enviarEmailPrimAcesso ?? true,
      Pep: payload.pep ?? false,
      IdTermo: payload.idTermo ? Number(payload.idTermo) || payload.idTermo : undefined,
      RendaPatrimonio: payload.rendaPatrimonio || {
        FaixaRenda: "NaoInformado",
        OrigemRenda: "Atividade empresarial",
        ComentarioOrigemRenda: "Cadastro originado pela Plataforma BUILT.",
        FaixaPatrimonio: "NaoInformado",
      },
    });
  }

  private async getAccessToken() {
    if (!this.authConfigured) {
      throw new Error("Configure PINBANK_BASE_URL, PINBANK_USERNAME e PINBANK_PASSWORD para autenticar na Pinbank.");
    }
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) return this.tokenCache.value;
    const form = new URLSearchParams();
    form.set("username", this.username);
    form.set("password", this.password);
    form.set("grant_type", "password");
    const tokenPath = process.env.PINBANK_TOKEN_PATH || ENDPOINTS.token;
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (this.bearerSeed) headers.Authorization = `Bearer ${this.bearerSeed}`;
    const response = await fetch(this.url(tokenPath), {
      method: "POST",
      headers,
      body: form.toString(),
    });
    const parsed = await parseResponse(response);
    if (!response.ok) {
      throw new Error(extractPinbankError(parsed, `Falha ao gerar token PINBANK (${response.status})`));
    }
    const accessToken = parsed?.access_token || parsed?.accessToken;
    if (!accessToken) throw new Error("Resposta de token PINBANK sem access_token.");
    const expiresIn = Number(parsed?.expires_in || parsed?.expiresIn || 3300);
    this.tokenCache = { value: String(accessToken), expiresAt: now + Math.max(60, expiresIn - 60) * 1000 };
    return this.tokenCache.value;
  }

  private async request<T>({ method = "GET", path, body, encrypted = false }: PinbankRequestOptions): Promise<T> {
    const token = await this.getAccessToken();
    const shouldEncrypt = encrypted && !this.disableEncryption;
    const requestPath = shouldEncrypt ? encryptedPath(path) : path;
    const requestBody = body === undefined
      ? undefined
      : shouldEncrypt
        ? JSON.stringify({ Data: { Json: this.encrypt(JSON.stringify(body)) } })
        : JSON.stringify(body);
    const response = await fetch(this.url(requestPath), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        UserName: this.username,
        RequestOrigin: this.requestOrigin,
      },
      body: requestBody,
    });
    const parsed = await parseResponse(response);
    const unwrapped = shouldEncrypt ? this.unwrapEncrypted(parsed) : parsed;
    if (!response.ok) {
      throw new Error(extractPinbankError(unwrapped, `PINBANK request failed (${response.status})`));
    }
    this.assertSuccess(unwrapped);
    return unwrapped as T;
  }

  private unwrapEncrypted(value: any) {
    const encryptedJson = value?.Data?.Json || value?.data?.Json || value?.Json;
    if (!encryptedJson || typeof encryptedJson !== "string") return value;
    const decrypted = this.decrypt(encryptedJson);
    try {
      return JSON.parse(decrypted);
    } catch {
      return { Data: decrypted };
    }
  }

  private assertSuccess(value: any) {
    const resultCode = Number(value?.ResultCode ?? value?.resultCode ?? 0);
    const validationCode = Number(value?.ValidationData?.ResultCode ?? value?.validationData?.resultCode ?? 0);
    if (resultCode !== 0 || validationCode !== 0) {
      throw new Error(extractPinbankError(value, "PINBANK retornou erro de validação."));
    }
  }

  private encrypt(plainText: string) {
    const cipher = createCipheriv("aes-128-cbc", this.aesKey(), this.aesIv());
    return Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]).toString("base64");
  }

  private decrypt(cipherText: string) {
    const decipher = createDecipheriv("aes-128-cbc", this.aesKey(), this.aesIv());
    return Buffer.concat([decipher.update(Buffer.from(cipherText, "base64")), decipher.final()]).toString("utf8");
  }

  private getAesKeyStatus() {
    const configuredKey = process.env.PINBANK_AES_KEY || process.env.PINBANK_KEY_VALUE || this.password;
    const decoded = decodeConfiguredBuffer(configuredKey);
    return { valid: decoded.length === 16, length: decoded.length };
  }

  private aesKey() {
    const configuredKey = process.env.PINBANK_AES_KEY || process.env.PINBANK_KEY_VALUE || this.password;
    const decoded = decodeConfiguredBuffer(configuredKey);
    if (decoded.length !== 16) {
      throw new Error("A chave AES da PINBANK deve ter 16 bytes. Configure PINBANK_AES_KEY com a KeyValue exata recebida da Pinbank.");
    }
    return decoded;
  }

  private aesIv() {
    const configuredIv = process.env.PINBANK_AES_IV || process.env.PINBANK_IV || "";
    if (!configuredIv) return Buffer.alloc(16, 0);
    const decoded = decodeConfiguredBuffer(configuredIv);
    if (decoded.length !== 16) {
      throw new Error("O IV AES da PINBANK deve ter 16 bytes. Configure PINBANK_AES_IV ou remova para usar IV zerado.");
    }
    return decoded;
  }

  private url(path: string) {
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
}

function encryptedPath(path: string) {
  if (path.endsWith("Encrypted")) return path;
  const queryIndex = path.indexOf("?");
  if (queryIndex >= 0) return `${path.slice(0, queryIndex)}Encrypted${path.slice(queryIndex)}`;
  return `${path}Encrypted`;
}

function decodeConfiguredBuffer(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return Buffer.alloc(0);
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    const hex = Buffer.from(trimmed, "hex");
    if (hex.length === 16) return hex;
  }
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 16 && b64.toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")) return b64;
  } catch {}
  return Buffer.from(trimmed, "utf8");
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractPinbankError(value: any, fallback: string) {
  const validationErrors = value?.ValidationData?.Errors || value?.validationData?.errors || [];
  const errors = Array.isArray(validationErrors)
    ? validationErrors
      .map((error: any) => [error?.FieldName, error?.ErrorMessage].filter(Boolean).join(": "))
      .filter(Boolean)
    : [];
  return [value?.Message || value?.message, value?.ValidationData?.Message, ...errors].filter(Boolean).join(" | ") || fallback;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  ) as T;
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function splitBrazilPhone(value: unknown) {
  const digits = onlyDigits(value);
  const normalized = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return {
    ddi: 55,
    ddd: Number(normalized.slice(0, 2)) || 0,
    numero: Number(normalized.slice(2)) || 0,
  };
}

function normalizeIsoDate(value: unknown) {
  if (!value) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.includes("T") ? text : `${text}T00:00:00.000Z`;
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}T00:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeDateOnly(value: unknown) {
  if (!value) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function inferPinbankOnboardingStatus(data: any) {
  const text = [
    data?.Status,
    data?.status,
    data?.Situacao,
    data?.situacao,
    data?.Mensagem,
    data?.Message,
  ].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("abert") || text.includes("aprov") || text.includes("ativa") || text.includes("open")) return "open";
  if (text.includes("reprov") || text.includes("recus") || text.includes("reject")) return "rejected";
  if (text.includes("document")) return "documents_pending";
  return "in_review";
}

function normalizeEstadoCivil(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (text.includes("casad")) return "Casado";
  if (text.includes("divor")) return "Divorciado";
  if (text.includes("viuv") || text.includes("viúv")) return "Viuvo";
  if (text.includes("uni")) return "UniaoEstavel";
  return "Solteiro";
}
