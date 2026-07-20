import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, BarChart3, Banknote, Calculator, CheckCircle2, FileText,
  ClipboardList, Copy, Info, Landmark, Link2, Loader2, ReceiptText,
  RefreshCw, Search, ShieldCheck, Upload, Wallet, XCircle, MapPin
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AliancaDocsPageConfig } from "./alianca-docs-page";
import FluxoCaixaPage from "./fluxo-caixa";
import ResultadosPage from "./resultados";
import BiasCalculadoraPage from "./bias-calculadora";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTANCE_LOCATION_NOTICE, captureRequiredAcceptanceLocation } from "@/lib/acceptanceLocation";
import type { BiaAccessLevel } from "@shared/bia-access";

export const NUCLEO_CAPITAL_DOCS_CONFIG: AliancaDocsPageConfig = {
  modulo: "capital",
  titulo: "Documentos",
  subtitulo: "Documentos de investimento, contabilidade e gestão financeira",
  accentColor: "#D7BB7D",
  icon: Landmark,
  theme: "light",
  hideHeaderIcon: true,
  hideHeaderChrome: true,
  aliancas: [
    {
      key: "aporte-financeiro",
      label: "Alianças de Aporte Financeiro",
      tipos: [
        { label: "Memorando/teaser do investimento + pitch deck + data room" },
        { label: "Estrutura do investimento (instrumento, risco, retorno, etc.) (Padrão Políticas BUILT)" },
        { label: "Acordo de sócios/cotistas (governança, saída, preferência) (Padrão Políticas BUILT)" },
        { label: "Plano de captação por parcelas + condições + garantias" },
        { label: "Cessão de recebíveis / garantias (quando aplicável)" },
        { label: "Outro" },
      ],
    },
    {
      key: "contabil",
      label: "Alianças Contábeis e Fiscais",
      tipos: [
        { label: "Escrituração e obrigações (conforme regime)" },
        { label: "DRE do projeto, balanço, balancetes, razão, conciliações" },
        { label: "Relatórios de prestação de contas para cotistas/acionistas (Dashboard)" },
        { label: "Pastas fiscais (NF, retenções, impostos, guias, garantias)" },
        { label: "Outro" },
      ],
    },
    {
      key: "financeiro",
      label: "Alianças de Gestão Financeira",
      tipos: [
        { label: "Plano de contas do projeto (CAPEX/OPEX/receitas/distribuições) (Fluxo de Caixa)" },
        { label: "Orçamento baseline + revisões + controle de versões" },
        { label: "Fluxo de caixa (previsto x realizado) + curva de desembolso" },
        { label: "Política de pagamentos (alçadas, aprovadores, evidências)" },
        { label: "Conciliação bancária + extratos + trilha de aprovação" },
        { label: "Relatórios de distribuição (lucro distribuível, comprovantes, recibos)" },
        { label: "Estornos/correções de despesas e receitas" },
        { label: "Outro" },
      ],
    },
  ],
};

const CAPITAL_TABS = new Set(["banco", "financeiro", "analises", "calculadora"]);

function normalizeCapitalTab(value?: string | null) {
  return value && CAPITAL_TABS.has(value) ? value : "banco";
}

type BancoStatus =
  | "not_started"
  | "terms_pending"
  | "documents_pending"
  | "in_review"
  | "open"
  | "rejected";

type BancoData = {
  bia?: { id: string; nome_bia?: string | null };
  account?: {
    status: BancoStatus;
    terms_version?: string | null;
    terms_accepted_at?: string | null;
    onboarding_requested_at?: string | null;
  } | null;
  documents: Array<{ id: string; tipo: string; file_id: string; membro_id?: string | null; status: string; created_at?: string }>;
  missingDocuments: string[];
  charges: Array<{
    id: string;
    fluxo_caixa_id?: string | null;
    provider?: string | null;
    type?: string | null;
    status?: string | null;
    descricao?: string | null;
    valor?: string | number | null;
    data_vencimento?: string | null;
    pagador_nome?: string | null;
    pagador_email?: string | null;
    nosso_numero?: string | null;
    payment_id?: string | null;
    payment_url?: string | null;
    linha_digitavel?: string | null;
    pagamento_provider?: string | null;
    pagamento_url?: string | null;
    pagamento_status?: string | null;
  }>;
  providerConfigured: boolean;
  configStatus?: {
    configured: boolean;
    mode?: string;
    missing?: string[];
    checks?: Array<{ key: string; ok: boolean; label?: string }>;
  };
};

const BANK_STATUS_LABELS: Record<BancoStatus, string> = {
  not_started: "não iniciada",
  terms_pending: "termos pendentes",
  documents_pending: "documentos pendentes",
  in_review: "em análise",
  open: "conta aberta",
  rejected: "reprovada",
};

const BANK_DOCUMENT_TYPES = [
  { value: "cartao_cnpj", label: "Cartão CNPJ da BIA", group: "BIA" },
  { value: "contrato_social", label: "Contrato social atualizado", group: "BIA" },
  { value: "comprovante_endereco_comercial", label: "Comprovante de endereço comercial", group: "BIA" },
  { value: "documento_identificacao", label: "RG ou CNH do sócio", group: "Sócios" },
  { value: "selfie_documento", label: "Selfie do sócio segurando documento", group: "Sócios" },
  { value: "comprovante_endereco_residencial", label: "Comprovante residencial do sócio", group: "Sócios" },
] as const;

type BankDocumentType = typeof BANK_DOCUMENT_TYPES[number]["value"];

function bankDocLabel(tipo: string) {
  return BANK_DOCUMENT_TYPES.find((doc) => doc.value === tipo)?.label || tipo;
}

function formatMoney(value?: string | number | null) {
  const amount = typeof value === "number" ? value : Number(String(value || "0").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function BancoBiaPage({ biaId, readOnly = false }: { biaId?: string | null; readOnly?: boolean }) {
  const { toast } = useToast();
  const [docTipo, setDocTipo] = useState<BankDocumentType>(BANK_DOCUMENT_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [permitirCompartilhamento, setPermitirCompartilhamento] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    tipo: "boleto",
    descricao: "Aporte da BIA",
    valor: "",
    vencimento: "",
    pagadorNome: "",
    pagadorEmail: "",
    pagadorDocumento: "",
    splitJson: "",
  });
  const [consulta, setConsulta] = useState<{ title: string; data: unknown } | null>(null);
  const [transactionId, setTransactionId] = useState("");

  const { data, isLoading } = useQuery<BancoData>({
    queryKey: [`/api/bias/${biaId}/banco`],
    enabled: !!biaId,
  });

  const { data: terms } = useQuery<{ version: string; title?: string; body: string; docUrl?: string }>({
    queryKey: [`/api/bias/${biaId}/banco/termos`],
    enabled: !!biaId,
  });

  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      if (!biaId) throw new Error("BIA não selecionada");
      const aceite_localizacao = await captureRequiredAcceptanceLocation();
      await apiRequest("POST", `/api/bias/${biaId}/banco/aceite-termos`, {
        version: terms?.version || "pinbank_terms_pending",
        aceite_localizacao,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      toast({ title: "Termos aceitos", description: "O aceite PINBANK foi registrado para esta BIA." });
    },
    onError: (error: Error) => toast({ title: "Erro ao aceitar termos", description: error.message, variant: "destructive" }),
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!biaId) throw new Error("BIA não selecionada");
      if (!file) throw new Error("Escolha um arquivo");
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson.error || "Erro ao enviar arquivo");
      const fileId = uploadJson.fileIds?.[0];
      if (!fileId) throw new Error("Arquivo não retornou ID");
      await apiRequest("POST", `/api/bias/${biaId}/banco/documentos`, {
        tipo: docTipo,
        fileId,
        permitirCompartilhamento,
      });
    },
    onSuccess: () => {
      setFile(null);
      setFileInputKey((current) => current + 1);
      setPermitirCompartilhamento(false);
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      toast({ title: "Documento enviado", description: "O documento foi adicionado ao dossiê bancário da BIA." });
    },
    onError: (error: Error) => toast({ title: "Erro ao enviar documento", description: error.message, variant: "destructive" }),
  });

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      if (!biaId) throw new Error("BIA não selecionada");
      await apiRequest("POST", `/api/bias/${biaId}/banco/onboarding`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      toast({ title: "Onboarding iniciado", description: "A solicitação de abertura da conta foi enviada." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível abrir a conta", description: error.message, variant: "destructive" }),
  });

  const createChargeMutation = useMutation({
    mutationFn: async () => {
      if (!biaId) throw new Error("BIA nao selecionada");
      const payload: Record<string, unknown> = {
        tipo: chargeForm.tipo,
        descricao: chargeForm.descricao,
        valor: chargeForm.valor,
        vencimento: chargeForm.vencimento || null,
        pagadorNome: chargeForm.pagadorNome,
        pagadorEmail: chargeForm.pagadorEmail,
        pagadorDocumento: chargeForm.pagadorDocumento,
      };
      if (chargeForm.tipo === "boleto_split" && chargeForm.splitJson.trim()) {
        payload.split = JSON.parse(chargeForm.splitJson);
      }
      const res = await apiRequest("POST", `/api/bias/${biaId}/banco/cobrancas`, payload);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      setConsulta({ title: "Cobranca gerada", data: result });
      toast({ title: "Cobranca gerada", description: "Boleto/link criado para esta BIA." });
    },
    onError: (error: Error) => toast({ title: "Erro ao gerar cobrança", description: error.message, variant: "destructive" }),
  });

  const refreshChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      if (!biaId) throw new Error("BIA nao selecionada");
      const res = await apiRequest("POST", `/api/bias/${biaId}/banco/cobrancas/${chargeId}/status`, {});
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      setConsulta({ title: "Status da cobrança", data: result });
    },
    onError: (error: Error) => toast({ title: "Erro ao consultar status", description: error.message, variant: "destructive" }),
  });

  const cancelChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      if (!biaId) throw new Error("BIA nao selecionada");
      const res = await apiRequest("POST", `/api/bias/${biaId}/banco/cobrancas/${chargeId}/cancelar`, {});
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${biaId}/banco`] });
      setConsulta({ title: "Cobranca cancelada", data: result });
      toast({ title: "Cobranca cancelada" });
    },
    onError: (error: Error) => toast({ title: "Erro ao cancelar cobrança", description: error.message, variant: "destructive" }),
  });

  const consultaMutation = useMutation({
    mutationFn: async ({ title, url }: { title: string; url: string }) => {
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro na consulta");
      return { title, data: json };
    },
    onSuccess: (result) => setConsulta(result),
    onError: (error: Error) => toast({ title: "Erro na consulta", description: error.message, variant: "destructive" }),
  });

  if (!biaId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Abra o Banco dentro de uma BIA para iniciar a conta digital.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados bancários da BIA...
        </CardContent>
      </Card>
    );
  }

  const status = data?.account?.status || "not_started";
  const termsAccepted = !!data?.account?.terms_accepted_at;
  const missingDocuments = data?.missingDocuments || [];
  const configStatus = data?.configStatus;
  const providerReady = !!data?.providerConfigured || !!configStatus?.configured;
  const uploadedDocumentTypes = new Set((data?.documents || []).map((item) => item.tipo));
  const selectedDoc = BANK_DOCUMENT_TYPES.find((doc) => doc.value === docTipo) || BANK_DOCUMENT_TYPES[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-blue-500/20">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-blue-600" />
                  Banco da BIA
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conta digital e dossiê PINBANK vinculados à BIA {data?.bia?.nome_bia || ""}.
                </p>
              </div>
              <Badge variant={status === "open" ? "default" : "outline"}>{BANK_STATUS_LABELS[status]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-50/60 p-4 text-sm text-blue-950">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p>
                  As informações e documentos serão usados exclusivamente para abertura, KYC e operação bancária da BIA.
                  O envio ao banco exige aceite formal e autorização de compartilhamento.
                </p>
              </div>
            </div>

            {!providerReady && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                <p className="font-semibold">Configuração técnica PINBANK pendente</p>
                <p>
                  O dossiê pode ser preparado agora, mas a abertura automática só fica ativa quando as credenciais e chaves da PINBANK estiverem no ambiente do servidor.
                </p>
                    <div className="flex flex-wrap gap-2">
                      {(configStatus?.checks || []).map((check) => (
                        <Badge key={check.key} variant={check.ok ? "outline" : "destructive"} className="text-[11px]">
                          {check.ok ? "OK" : "Falta"}: {check.key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Termos PINBANK</p>
                <p className="mt-1 font-semibold">{termsAccepted ? "Aceitos" : "Pendentes"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documentos faltantes</p>
                <p className="mt-1 font-semibold">{missingDocuments.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cobranças geradas</p>
                <p className="mt-1 font-semibold">{data?.charges?.length || 0}</p>
              </div>
            </div>

            {!termsAccepted && (
              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{terms?.title || "Termos de Uso PINBANK"}</p>
                </div>
                <p className="mt-2 max-h-24 overflow-auto text-sm text-muted-foreground">{terms?.body}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>{ACCEPTANCE_LOCATION_NOTICE}</span>
                </div>
                <Button
                  className="mt-3 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-200 disabled:text-white"
                  onClick={() => acceptTermsMutation.mutate()}
                  disabled={readOnly || acceptTermsMutation.isPending || !providerReady}
                  data-testid="button-aceitar-termos-pinbank"
                >
                  {acceptTermsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Aceitar termos
                </Button>
              </div>
            )}

            <Button
              className="bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-200 disabled:text-white"
              onClick={() => onboardingMutation.mutate()}
              disabled={readOnly || onboardingMutation.isPending || !termsAccepted || missingDocuments.length > 0 || !providerReady}
              data-testid="button-abrir-conta-pinbank"
            >
              {onboardingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Abrir Conta Digital
            </Button>
            {(!providerReady || !termsAccepted || missingDocuments.length > 0) && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Complete a configuração PINBANK, aceite os termos e envie todos os documentos obrigatórios para habilitar a abertura da conta.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dossiê KYC PINBANK</CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecione um item obrigatório, anexe o arquivo e autorize o compartilhamento para abertura da conta da BIA.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {BANK_DOCUMENT_TYPES.map((doc) => {
                const sent = uploadedDocumentTypes.has(doc.value);
                const active = docTipo === doc.value;
                return (
                  <button
                    key={doc.value}
                    type="button"
                    onClick={() => setDocTipo(doc.value)}
                    disabled={readOnly}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                      active ? "border-blue-500 bg-blue-50" : "hover:bg-muted/50"
                    }`}
                    data-testid={`button-selecionar-doc-${doc.value}`}
                  >
                    <span>
                      <span className="block font-medium">{doc.label}</span>
                      <span className="text-xs text-muted-foreground">{doc.group}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {sent ? (
                        <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3" /> Enviado
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                      <Badge variant={active ? "default" : "outline"}>{sent ? "Substituir" : "Selecionar"}</Badge>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documento selecionado</p>
              <p className="mt-1 font-medium">{selectedDoc.group} - {selectedDoc.label}</p>
            </div>

            <select
              value={docTipo}
              onChange={(event) => setDocTipo(event.target.value as BankDocumentType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="select-banco-documento-tipo"
              disabled={readOnly}
            >
              {BANK_DOCUMENT_TYPES.map((doc) => (
                <option key={doc.value} value={doc.value}>{doc.group} - {doc.label}</option>
              ))}
            </select>
            <Input
              key={fileInputKey}
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              data-testid="input-banco-documento-file"
              disabled={readOnly}
            />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={permitirCompartilhamento}
                onChange={(event) => setPermitirCompartilhamento(event.target.checked)}
                className="mt-1"
                disabled={readOnly}
              />
              Autorizo o compartilhamento deste documento com o banco para fins de KYC e abertura da conta da BIA.
            </label>
            <Button
              variant="outline"
              onClick={() => uploadDocumentMutation.mutate()}
              disabled={readOnly || uploadDocumentMutation.isPending || !file || !permitirCompartilhamento}
              data-testid="button-enviar-documento-banco"
            >
              {uploadDocumentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar para o dossiê
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registrar aporte / cobrança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={chargeForm.tipo}
                onChange={(event) => setChargeForm((current) => ({ ...current, tipo: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-banco-cobranca-tipo"
                disabled={readOnly}
              >
                <option value="boleto">Boleto</option>
                <option value="boleto_split">Boleto com split</option>
                <option value="link_pagamento">Link de pagamento</option>
              </select>
              <Input
                value={chargeForm.valor}
                onChange={(event) => setChargeForm((current) => ({ ...current, valor: event.target.value }))}
                placeholder="Valor, ex: 1500,00"
                data-testid="input-banco-cobranca-valor"
                disabled={readOnly}
              />
              <Input
                value={chargeForm.descricao}
                onChange={(event) => setChargeForm((current) => ({ ...current, descricao: event.target.value }))}
                placeholder="Descrição"
                data-testid="input-banco-cobranca-descricao"
                disabled={readOnly}
              />
              <Input
                type="date"
                value={chargeForm.vencimento}
                onChange={(event) => setChargeForm((current) => ({ ...current, vencimento: event.target.value }))}
                data-testid="input-banco-cobranca-vencimento"
                disabled={readOnly}
              />
              <Input
                value={chargeForm.pagadorNome}
                onChange={(event) => setChargeForm((current) => ({ ...current, pagadorNome: event.target.value }))}
                placeholder="Pagador"
                disabled={readOnly}
              />
              <Input
                value={chargeForm.pagadorEmail}
                onChange={(event) => setChargeForm((current) => ({ ...current, pagadorEmail: event.target.value }))}
                placeholder="E-mail do pagador"
                disabled={readOnly}
              />
              <Input
                value={chargeForm.pagadorDocumento}
                onChange={(event) => setChargeForm((current) => ({ ...current, pagadorDocumento: event.target.value }))}
                placeholder="CPF/CNPJ do pagador"
                className="sm:col-span-2"
                disabled={readOnly}
              />
            </div>
            {chargeForm.tipo === "boleto_split" && (
              <textarea
                value={chargeForm.splitJson}
                onChange={(event) => setChargeForm((current) => ({ ...current, splitJson: event.target.value }))}
                placeholder='Split em JSON, ex: [{"documento":"00000000000","valor":500}]'
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={readOnly}
              />
            )}
            {!providerReady && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Configure a PINBANK para gerar boletos, splits e links reais.
              </p>
            )}
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-200 disabled:text-white"
              onClick={() => createChargeMutation.mutate()}
              disabled={readOnly || createChargeMutation.isPending || !providerReady || !chargeForm.valor}
              data-testid="button-banco-gerar-cobranca"
            >
              {createChargeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Gerar cobrança
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultas bancárias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => consultaMutation.mutate({ title: "Saldo da conta", url: `/api/bias/${biaId}/banco/saldo` })} disabled={consultaMutation.isPending}>
                <Wallet className="mr-2 h-4 w-4" /> Saldo
              </Button>
              <Button variant="outline" onClick={() => consultaMutation.mutate({ title: "Extrato da conta", url: `/api/bias/${biaId}/banco/extrato` })} disabled={consultaMutation.isPending}>
                <ReceiptText className="mr-2 h-4 w-4" /> Extrato
              </Button>
              <Button variant="outline" onClick={() => consultaMutation.mutate({ title: "Inventário de documentos", url: `/api/bias/${biaId}/banco/documentos/inventario` })} disabled={consultaMutation.isPending}>
                <ClipboardList className="mr-2 h-4 w-4" /> Inventário
              </Button>
              <Button variant="outline" onClick={() => consultaMutation.mutate({ title: "Métricas de cobrança", url: `/api/bias/${biaId}/banco/cobrancas/metricas` })} disabled={consultaMutation.isPending}>
                <BarChart3 className="mr-2 h-4 w-4" /> Métricas
              </Button>
              <Button variant="outline" onClick={() => consultaMutation.mutate({ title: "Boletos em lote", url: `/api/bias/${biaId}/banco/cobrancas/lote` })} disabled={consultaMutation.isPending} className="sm:col-span-2">
                <Search className="mr-2 h-4 w-4" /> Boletos em lote
              </Button>
            </div>
            <div className="flex gap-2">
              <Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="ID da transação" />
              <Button
                variant="outline"
                onClick={() => transactionId.trim() && consultaMutation.mutate({ title: "Comprovante detalhado", url: `/api/bias/${biaId}/banco/comprovante/${encodeURIComponent(transactionId.trim())}` })}
                disabled={consultaMutation.isPending || !transactionId.trim()}
              >
                <ReceiptText className="mr-2 h-4 w-4" /> Comprovante
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {consulta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{consulta.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{formatJson(consulta.data)}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dossiê bancário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {BANK_DOCUMENT_TYPES.map((doc) => {
              const sent = data?.documents?.some((item) => item.tipo === doc.value);
              return (
                <div key={doc.value} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">{doc.group}</p>
                  </div>
                  {sent ? (
                    <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Boletos e links da BIA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.charges || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada para esta BIA ainda.</p>
            ) : (
              data?.charges.map((charge) => (
                <div key={charge.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{charge.descricao || "Cobrança"}</p>
                      <p className="text-xs text-muted-foreground">{charge.pagamento_provider || "provider"} · {charge.pagamento_status || charge.status || "pendente"}</p>
                    </div>
                    <p className="font-semibold">{formatMoney(charge.valor)}</p>
                  </div>
                  {(charge.payment_url || charge.pagamento_url) && (
                    <Button variant="link" className="mt-2 h-auto p-0" onClick={() => window.open(charge.payment_url || charge.pagamento_url || "", "_blank")}>
                      Abrir link de pagamento
                    </Button>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {charge.linha_digitavel && (
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(charge.linha_digitavel || "")}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Copiar linha
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refreshChargeMutation.mutate(charge.id)} disabled={readOnly || refreshChargeMutation.isPending}>
                      <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar status
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => cancelChargeMutation.mutate(charge.id)} disabled={readOnly || cancelChargeMutation.isPending || String(charge.status || charge.pagamento_status || "").toLowerCase().includes("cancel")}>
                      <XCircle className="mr-2 h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NucleoCapitalPage({
  initialBiaId = null,
  embedded = false,
  activeTab: controlledActiveTab,
  onTabChange,
  access,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  access?: Partial<Record<"banco" | "financeiro" | "analises" | "calculadora", BiaAccessLevel>>;
} = {}) {
  const tabDefinitions = [
    { key: "banco", label: "Banco", icon: Banknote, testId: "tab-capital-banco" },
    { key: "financeiro", label: "Financeiro", icon: Wallet, testId: "tab-capital-financeiro" },
    { key: "analises", label: "Análises", icon: BarChart3, testId: "tab-capital-analises" },
    { key: "calculadora", label: "Calculadora DM", icon: Calculator, testId: "tab-capital-calculadora" },
  ] as const;
  const allowedTabs = tabDefinitions.filter((tab) => {
    const level = access?.[tab.key] || (access ? "none" : "edit");
    return level === "view" || level === "edit";
  });
  const allowedTabKey = allowedTabs.map((tab) => tab.key).join("|");
  const resolveAllowedTab = (value?: string | null) => {
    const normalized = normalizeCapitalTab(value);
    return allowedTabs.some((tab) => tab.key === normalized) ? normalized : allowedTabs[0]?.key || "banco";
  };
  const [activeTab, setActiveTab] = useState(() => resolveAllowedTab(controlledActiveTab));

  useEffect(() => {
    const next = resolveAllowedTab(controlledActiveTab);
    setActiveTab(next);
    if (controlledActiveTab && controlledActiveTab !== next) onTabChange?.(next);
  }, [controlledActiveTab, allowedTabKey]);

  const handleTabChange = (value: string) => {
    const next = resolveAllowedTab(value);
    setActiveTab(next);
    onTabChange?.(next);
  };

  if (allowedTabs.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Você não possui acesso aos módulos de Capital desta BIA.</div>;
  }

  return (
    <div className={`${embedded ? "space-y-6" : "p-6 space-y-6 max-w-7xl mx-auto"}`}>
      {!embedded && <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-nucleo-capital-title">
          <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
            <Landmark className="h-6 w-6" />
          </div>
          Núcleo de Capital
        </h1>
        <p className="text-sm text-muted-foreground">
          Banco, financeiro, análises e calculadora DM em uma visão única.
        </p>
      </div>}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList className="grid h-auto w-full gap-1 bg-muted/60 p-1" style={{ gridTemplateColumns: `repeat(${allowedTabs.length}, minmax(0, 1fr))` }}>
          {allowedTabs.some((tab) => tab.key === "banco") && <TabsTrigger value="banco" className="gap-2" data-testid="tab-capital-banco">
            <Banknote className="h-4 w-4" />
            Banco
          </TabsTrigger>}
          {allowedTabs.some((tab) => tab.key === "financeiro") && <TabsTrigger value="financeiro" className="gap-2" data-testid="tab-capital-financeiro">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>}
          {allowedTabs.some((tab) => tab.key === "analises") && <TabsTrigger value="analises" className="gap-2" data-testid="tab-capital-analises">
            <BarChart3 className="h-4 w-4" />
            Análises
          </TabsTrigger>}
          {allowedTabs.some((tab) => tab.key === "calculadora") && <TabsTrigger value="calculadora" className="gap-2" data-testid="tab-capital-calculadora">
            <Calculator className="h-4 w-4" />
            Calculadora DM
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="banco" className="[&>div]:p-0 [&>div]:max-w-none">
          {activeTab === "banco" && <BancoBiaPage biaId={initialBiaId} readOnly={access?.banco === "view"} />}
        </TabsContent>
        <TabsContent value="financeiro" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "financeiro" && <FluxoCaixaPage initialBiaId={initialBiaId} embedded={embedded} readOnly={access?.financeiro === "view"} />}
        </TabsContent>
        <TabsContent value="analises" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "analises" && <ResultadosPage initialBiaId={initialBiaId} embedded={embedded} readOnly={access?.analises === "view"} />}
        </TabsContent>
        <TabsContent value="calculadora" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "calculadora" && <BiasCalculadoraPage initialBiaId={initialBiaId} embedded={embedded} readOnly={access?.calculadora === "view"} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
