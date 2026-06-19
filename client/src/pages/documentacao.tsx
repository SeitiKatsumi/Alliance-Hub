import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Download, FileCheck2, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DocumentoAceito = {
  id: string;
  tipo: "termo" | "mou";
  titulo: string;
  versao: string | null;
  aceito_em: string | null;
  origem: string;
  bia_id?: string | null;
  bia_nome?: string | null;
};

type DocumentosAceitosResponse = {
  documentos: DocumentoAceito[];
};

function formatDate(value?: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentacaoPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<DocumentosAceitosResponse>({
    queryKey: ["/api/me/documentos-aceitos"],
  });
  const documentos = data?.documentos || [];

  const openPdf = (documento: DocumentoAceito) => {
    window.open(`/api/me/documentos-aceitos/${encodeURIComponent(documento.id)}/pdf`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#001D34]">
      <div className="border-b border-[#d7bb7d]/30 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-600"
            onClick={() => navigate("/")}
            data-testid="btn-documentacao-voltar"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Badge variant="outline" className="border-[#d7bb7d]/60 bg-[#fcfaf5] text-[#001D34]">
            Documentos aceitos
          </Badge>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <section className="relative overflow-hidden rounded-lg border border-[#1d5fbf]/30 bg-[#020b16] p-6 text-white shadow-sm md:p-8">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(109,230,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(109,230,255,0.06) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative z-10 max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#6de6ff]">
              // BUILT ALLIANCES · ACEITES
            </p>
            <h1 className="mt-3 text-2xl font-bold md:text-3xl">Documentações de aceite</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
              Consulte os termos, políticas e MOUs que foram aceitos por você na plataforma.
              Cada documento é aberto em PDF com o padrão visual institucional da BUILT.
            </p>
          </div>
        </section>

        <section className="mt-6">
          {isLoading ? (
            <Card className="border-border/70">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Carregando documentações aceitas...
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 text-sm text-red-700">
                Não foi possível carregar suas documentações de aceite.
              </CardContent>
            </Card>
          ) : documentos.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-white">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold">Nenhuma documentação aceita ainda</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Quando você aceitar termos, políticas ou MOUs de BIA, eles aparecerão aqui para consulta.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documentos.map((documento) => {
                const Icon = documento.tipo === "mou" ? ShieldCheck : FileCheck2;
                return (
                  <Card
                    key={documento.id}
                    className="border-[#d7bb7d]/45 bg-white transition-colors hover:border-blue-500/45"
                    data-testid={`card-documento-aceito-${documento.id}`}
                  >
                    <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-[#001D34]">{documento.titulo}</h2>
                            <Badge
                              variant="outline"
                              className={documento.tipo === "mou" ? "border-green-200 bg-green-50 text-green-700" : "border-blue-200 bg-blue-50 text-blue-700"}
                            >
                              {documento.tipo === "mou" ? "MOU" : "Termo"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>{documento.origem}</span>
                            {documento.versao && <span>Versão {documento.versao}</span>}
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(documento.aceito_em)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 md:w-auto"
                        onClick={() => openPdf(documento)}
                        data-testid={`btn-abrir-pdf-${documento.id}`}
                      >
                        <Download className="h-4 w-4" />
                        Abrir PDF
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
