import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { NUCLEO_CAPITAL_DOCS_CONFIG } from "./nucleo-capital";
import { NUCLEO_COMERCIAL_DOCS_CONFIG } from "./nucleo-comercial";
import { NUCLEO_OBRA_DOCS_CONFIG } from "./nucleo-obra";
import { TECNICO_ABA_LABELS, TECNICO_TIPOS_POR_ALIANCA } from "./nucleo-tecnico";
import type { BiaAccessLevel } from "@shared/bia-access";

export type DocumentoModulo = "tecnico" | "obra" | "comercial" | "capital";

type AnexoFile = {
  id: string;
  title?: string;
  filename?: string;
  url?: string;
  size?: string | number;
};

type Documento = {
  id: string;
  modulo: DocumentoModulo;
  bia_id?: string;
  alianca_tipo?: string;
  tipo_documento?: string;
  descricao?: string;
  arquivo_ids?: string[];
  arquivos?: AnexoFile[];
  created_at?: string;
  date_created?: string;
};

type Subnucleo = { key: string; label: string; tipos: Array<{ label: string }> };
type ModuloConfig = {
  key: DocumentoModulo;
  label: string;
  color: string;
  subnucleos: Subnucleo[];
};

const cleanSubnucleoLabel = (label: string) =>
  label.replace(/^Alian[cç]as?\s+(de\s+)?/i, "").replace(/^Alian[cç]as?\s+/i, "");

const MODULOS: ModuloConfig[] = [
  {
    key: "tecnico",
    label: "Núcleo Técnico",
    color: "#3b82f6",
    subnucleos: Object.entries(TECNICO_ABA_LABELS).map(([key, label]) => ({
      key,
      label: cleanSubnucleoLabel(label),
      tipos: TECNICO_TIPOS_POR_ALIANCA[key] || [],
    })),
  },
  {
    key: "obra",
    label: "Núcleo de Obra",
    color: "#ea580c",
    subnucleos: NUCLEO_OBRA_DOCS_CONFIG.aliancas.map((item) => ({
      ...item,
      label: cleanSubnucleoLabel(item.label),
    })),
  },
  {
    key: "comercial",
    label: "Núcleo Comercial",
    color: "#16a34a",
    subnucleos: NUCLEO_COMERCIAL_DOCS_CONFIG.aliancas.map((item) => ({
      ...item,
      label: cleanSubnucleoLabel(item.label),
    })),
  },
  {
    key: "capital",
    label: "Núcleo de Capital",
    color: "#7c3aed",
    subnucleos: NUCLEO_CAPITAL_DOCS_CONFIG.aliancas.map((item) => ({
      ...item,
      label: cleanSubnucleoLabel(item.label),
    })),
  },
];

function moduloConfig(modulo: DocumentoModulo) {
  return MODULOS.find((item) => item.key === modulo)!;
}

function subnucleoConfig(doc: Pick<Documento, "modulo" | "alianca_tipo">) {
  return moduloConfig(doc.modulo).subnucleos.find((item) => item.key === doc.alianca_tipo);
}

function comparableLabel(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function documentTypeLabel(doc: Pick<Documento, "modulo" | "alianca_tipo" | "tipo_documento">) {
  const canonical = subnucleoConfig(doc)?.tipos.find(
    (item) => comparableLabel(item.label) === comparableLabel(doc.tipo_documento),
  );
  return canonical?.label || doc.tipo_documento || "Documento sem tipo";
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

function formatSize(value?: string | number) {
  const bytes = Number(value);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function invalidateDocumentQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/nucleo-tecnico-docs"] });
  (["obra", "comercial", "capital"] as const).forEach((modulo) => {
    queryClient.invalidateQueries({ queryKey: ["/api/alianca-docs", modulo] });
  });
}

async function fetchDocuments(url: string): Promise<Documento[]> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível carregar os documentos.");
  return response.json();
}

function DocumentoSheet({
  biaId,
  allowedModules,
  preferredModule,
  documento,
  onClose,
}: {
  biaId: string;
  allowedModules: DocumentoModulo[];
  preferredModule?: DocumentoModulo;
  documento?: Documento;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const initialModule = documento?.modulo || (preferredModule && allowedModules.includes(preferredModule) ? preferredModule : allowedModules[0]) || "tecnico";
  const initialModuleConfig = moduloConfig(initialModule);
  const [modulo, setModulo] = useState<DocumentoModulo>(initialModule);
  const [aliancaTipo, setAliancaTipo] = useState(
    documento?.alianca_tipo || initialModuleConfig.subnucleos[0]?.key || "",
  );
  const [tipoDocumento, setTipoDocumento] = useState(documento ? documentTypeLabel(documento) : "");
  const [descricao, setDescricao] = useState(documento?.descricao || "");
  const [arquivoIds, setArquivoIds] = useState<string[]>(
    documento?.arquivo_ids || documento?.arquivos?.map((arquivo) => arquivo.id) || [],
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentModule = moduloConfig(modulo);
  const currentSubnucleo = currentModule.subnucleos.find((item) => item.key === aliancaTipo) || currentModule.subnucleos[0];
  const existingFiles = (documento?.arquivos || []).filter((arquivo) => arquivoIds.includes(arquivo.id));

  const saveMutation = useMutation({
    mutationFn: async () => {
      let uploadedIds: string[] = [];
      if (pendingFiles.length) {
        const data = new FormData();
        pendingFiles.forEach((file) => data.append("files", file, file.name));
        const response = await fetch("/api/upload", { method: "POST", body: data, credentials: "include" });
        if (!response.ok) throw new Error("Não foi possível enviar os anexos.");
        uploadedIds = (await response.json()).fileIds || [];
      }

      const payload = {
        bia_id: biaId,
        alianca_tipo: aliancaTipo,
        tipo_documento: tipoDocumento,
        descricao,
        arquivo_ids: [...arquivoIds, ...uploadedIds],
      };

      if (modulo === "tecnico") {
        return documento
          ? apiRequest("PATCH", `/api/nucleo-tecnico-docs/${documento.id}`, payload)
          : apiRequest("POST", "/api/nucleo-tecnico-docs", payload);
      }

      const genericPayload = { ...payload, modulo };
      return documento
        ? apiRequest("PATCH", `/api/alianca-docs/${documento.id}`, genericPayload)
        : apiRequest("POST", "/api/alianca-docs", genericPayload);
    },
    onSuccess: () => {
      invalidateDocumentQueries();
      toast({ title: documento ? "Documento atualizado" : "Documento adicionado" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar documento", description: error.message, variant: "destructive" });
    },
  });

  const changeModule = (next: DocumentoModulo) => {
    const nextConfig = moduloConfig(next);
    setModulo(next);
    setAliancaTipo(nextConfig.subnucleos[0]?.key || "");
    setTipoDocumento("");
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col bg-background p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-blue-600" />
            {documento ? "Editar documento" : "Adicionar documento"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Núcleo</label>
              <Select value={modulo} onValueChange={(value) => changeModule(value as DocumentoModulo)} disabled={!!documento}>
                <SelectTrigger data-testid="select-documento-nucleo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedModules.map((item) => <SelectItem key={item} value={item}>{moduloConfig(item).label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subnúcleo</label>
              <Select value={aliancaTipo} onValueChange={(value) => { setAliancaTipo(value); setTipoDocumento(""); }}>
                <SelectTrigger data-testid="select-documento-subnucleo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentModule.subnucleos.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de documento</label>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger data-testid="select-documento-tipo"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(currentSubnucleo?.tipos || []).map((item) => <SelectItem key={item.label} value={item.label}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={4} placeholder="Observações sobre o documento" />
          </div>

          {existingFiles.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Anexos atuais</label>
              {existingFiles.map((arquivo) => (
                <div key={arquivo.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                  <Paperclip className="h-4 w-4 text-blue-600" />
                  <span className="min-w-0 flex-1 truncate text-sm">{arquivo.filename || arquivo.title}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(arquivo.size)}</span>
                  <button type="button" onClick={() => setArquivoIds((ids) => ids.filter((id) => id !== arquivo.id))} title="Remover anexo">
                    <X className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              {pendingFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                  <Paperclip className="h-4 w-4 text-blue-600" />
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <button type="button" onClick={() => setPendingFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} title="Remover anexo">
                    <X className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              setPendingFiles((files) => [...files, ...Array.from(event.target.files || [])]);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" className="w-full gap-2 border-dashed" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivos
          </Button>
        </div>

        <div className="flex justify-end gap-3 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => saveMutation.mutate()}
            disabled={!aliancaTipo || !tipoDocumento || saveMutation.isPending}
            data-testid="button-salvar-documento"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar documento"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function BiaDocumentosPage({
  biaId,
  allowedModules,
  moduleAccess,
  initialModule,
}: {
  biaId: string;
  allowedModules: DocumentoModulo[];
  moduleAccess: Record<DocumentoModulo, BiaAccessLevel>;
  initialModule?: DocumentoModulo;
}) {
  const { toast } = useToast();
  const [moduleFilter, setModuleFilter] = useState<DocumentoModulo | "todos">(
    initialModule && allowedModules.includes(initialModule) ? initialModule : "todos",
  );
  const [subFilter, setSubFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Documento>();
  const [deletingDoc, setDeletingDoc] = useState<Documento>();

  useEffect(() => {
    if (moduleFilter !== "todos" && !allowedModules.includes(moduleFilter)) {
      setModuleFilter("todos");
      setSubFilter("todos");
    }
  }, [allowedModules, moduleFilter]);

  useEffect(() => {
    if (initialModule && allowedModules.includes(initialModule)) {
      setModuleFilter(initialModule);
      setSubFilter("todos");
    }
  }, [allowedModules, initialModule]);

  const tecnicoQuery = useQuery<Documento[]>({
    queryKey: ["/api/nucleo-tecnico-docs", biaId],
    queryFn: () => fetchDocuments(`/api/nucleo-tecnico-docs?bia_id=${encodeURIComponent(biaId)}`),
    enabled: allowedModules.includes("tecnico"),
  });
  const obraQuery = useQuery<Documento[]>({
    queryKey: ["/api/alianca-docs", "obra", biaId],
    queryFn: () => fetchDocuments(`/api/alianca-docs?modulo=obra&bia_id=${encodeURIComponent(biaId)}`),
    enabled: allowedModules.includes("obra"),
  });
  const comercialQuery = useQuery<Documento[]>({
    queryKey: ["/api/alianca-docs", "comercial", biaId],
    queryFn: () => fetchDocuments(`/api/alianca-docs?modulo=comercial&bia_id=${encodeURIComponent(biaId)}`),
    enabled: allowedModules.includes("comercial"),
  });
  const capitalQuery = useQuery<Documento[]>({
    queryKey: ["/api/alianca-docs", "capital", biaId],
    queryFn: () => fetchDocuments(`/api/alianca-docs?modulo=capital&bia_id=${encodeURIComponent(biaId)}`),
    enabled: allowedModules.includes("capital"),
  });

  const documents = useMemo(() => {
    const withModule = (items: Documento[] | undefined, modulo: DocumentoModulo) =>
      (Array.isArray(items) ? items : []).map((item) => ({ ...item, modulo }));
    return [
      ...withModule(tecnicoQuery.data, "tecnico"),
      ...withModule(obraQuery.data, "obra"),
      ...withModule(comercialQuery.data, "comercial"),
      ...withModule(capitalQuery.data, "capital"),
    ]
      .filter((item) => item.bia_id === biaId && allowedModules.includes(item.modulo))
      .sort((a, b) => Date.parse(b.created_at || b.date_created || "") - Date.parse(a.created_at || a.date_created || ""));
  }, [allowedModules, biaId, capitalQuery.data, comercialQuery.data, obraQuery.data, tecnicoQuery.data]);

  const subnucleos = useMemo(() => {
    const modules = moduleFilter === "todos" ? MODULOS.filter((item) => allowedModules.includes(item.key)) : [moduloConfig(moduleFilter)];
    return modules.flatMap((item) => item.subnucleos.map((sub) => ({ ...sub, modulo: item.key, moduloLabel: item.label })));
  }, [allowedModules, moduleFilter]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return documents.filter((item) => {
      if (moduleFilter !== "todos" && item.modulo !== moduleFilter) return false;
      if (subFilter !== "todos" && `${item.modulo}:${item.alianca_tipo}` !== subFilter) return false;
      if (!normalizedSearch) return true;
      const module = moduloConfig(item.modulo);
      const sub = subnucleoConfig(item);
      const searchable = [
        documentTypeLabel(item),
        item.descricao,
        module.label,
        sub?.label,
        ...(item.arquivos || []).map((arquivo) => arquivo.filename || arquivo.title),
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return searchable.includes(normalizedSearch);
    });
  }, [documents, moduleFilter, search, subFilter]);

  const isLoading = [tecnicoQuery, obraQuery, comercialQuery, capitalQuery].some((query) => query.isLoading && query.fetchStatus !== "idle");
  const hasLoadError = [tecnicoQuery, obraQuery, comercialQuery, capitalQuery].some((query) => query.isError);
  const editableModules = allowedModules.filter((module) => moduleAccess[module] === "edit");
  const preferredModule = moduleFilter !== "todos" && editableModules.includes(moduleFilter)
    ? moduleFilter
    : editableModules[0];

  const deleteMutation = useMutation({
    mutationFn: (documento: Documento) => documento.modulo === "tecnico"
      ? apiRequest("DELETE", `/api/nucleo-tecnico-docs/${documento.id}`)
      : apiRequest("DELETE", `/api/alianca-docs/${documento.id}`),
    onSuccess: () => {
      invalidateDocumentQueries();
      toast({ title: "Documento excluído" });
      setDeletingDoc(undefined);
    },
    onError: (error: Error) => toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5" data-testid="bia-documentos-unificados">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Documentos</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Arquivos dos núcleos organizados por origem e subnúcleo.</p>
        </div>
        {editableModules.length > 0 && <Button
          className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => { setEditingDoc(undefined); setSheetOpen(true); }}
          data-testid="button-adicionar-documento-unificado"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </Button>}
      </div>

      <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(220px,1fr)_200px_240px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento..." className="pl-9" />
        </div>
        <Select value={moduleFilter} onValueChange={(value) => { setModuleFilter(value as DocumentoModulo | "todos"); setSubFilter("todos"); }}>
          <SelectTrigger data-testid="filter-documentos-nucleo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os núcleos</SelectItem>
            {MODULOS.filter((item) => allowedModules.includes(item.key)).map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subFilter} onValueChange={setSubFilter}>
          <SelectTrigger data-testid="filter-documentos-subnucleo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os subnúcleos</SelectItem>
            {subnucleos.map((item) => (
              <SelectItem key={`${item.modulo}:${item.key}`} value={`${item.modulo}:${item.key}`}>
                {moduleFilter === "todos" ? `${item.moduloLabel} · ` : ""}{item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredDocuments.length} documento{filteredDocuments.length === 1 ? "" : "s"}</span>
        {(moduleFilter !== "todos" || subFilter !== "todos" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setModuleFilter("todos"); setSubFilter("todos"); setSearch(""); }}>Limpar filtros</Button>
        )}
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />)}</div>}

      {!isLoading && hasLoadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Parte dos documentos não pôde ser carregada. Tente novamente em instantes.
        </div>
      )}

      {!isLoading && !hasLoadError && filteredDocuments.length === 0 && (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredDocuments.map((documento) => {
          const module = moduloConfig(documento.modulo);
          const sub = subnucleoConfig(documento);
          return (
            <article key={`${documento.modulo}-${documento.id}`} className="rounded-lg border bg-background p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${module.color}14`, color: module.color }}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" style={{ borderColor: `${module.color}55`, color: module.color }}>{module.label}</Badge>
                    {sub && <Badge variant="secondary">{sub.label}</Badge>}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug text-foreground">{documentTypeLabel(documento)}</h3>
                  {documento.descricao && <p className="mt-1 text-sm text-muted-foreground">{documento.descricao}</p>}
                  {(documento.arquivos || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(documento.arquivos || []).map((arquivo) => (
                        <a key={arquivo.id} href={arquivo.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:border-blue-300 hover:text-blue-700">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-48 truncate">{arquivo.filename || arquivo.title || "Abrir anexo"}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(documento.created_at || documento.date_created)}</p>
                </div>
                {moduleAccess[documento.modulo] === "edit" && <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar documento" onClick={() => { setEditingDoc(documento); setSheetOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" title="Excluir documento" onClick={() => setDeletingDoc(documento)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>}
              </div>
            </article>
          );
        })}
      </div>

      {sheetOpen && (
        <DocumentoSheet
          biaId={biaId}
          allowedModules={editableModules}
          preferredModule={preferredModule}
          documento={editingDoc}
          onClose={() => { setSheetOpen(false); setEditingDoc(undefined); }}
        />
      )}

      <AlertDialog open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>“{deletingDoc ? documentTypeLabel(deletingDoc) : "Documento"}” será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deletingDoc && deleteMutation.mutate(deletingDoc)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
