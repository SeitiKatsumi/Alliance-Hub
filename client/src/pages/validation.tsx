import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Database, RefreshCw, Folder, ChevronRight } from "lucide-react";
import { useState } from "react";

interface DirectusCollection {
  collection: string;
  meta: {
    collection: string;
    icon: string | null;
    note: string | null;
    hidden: boolean;
    singleton: boolean;
  } | null;
  schema: {
    name: string;
  } | null;
}

interface DirectusField {
  field: string;
  type: string;
  meta: {
    field: string;
    special: string[] | null;
    interface: string | null;
    required: boolean;
    note: string | null;
  } | null;
}

export default function ValidationPage() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const validationQuery = useQuery<{ success: boolean; message?: string; serverInfo?: any; error?: string }>({
    queryKey: ["/api/directus/validate"],
  });

  const collectionsQuery = useQuery<{ success: boolean; collections?: DirectusCollection[]; error?: string }>({
    queryKey: ["/api/directus/collections"],
    enabled: validationQuery.data?.success === true,
  });

  const fieldsQuery = useQuery<{ success: boolean; fields?: DirectusField[]; error?: string }>({
    queryKey: ["/api/directus/collections", selectedCollection, "fields"],
    enabled: !!selectedCollection,
  });

  const userCollections = collectionsQuery.data?.collections?.filter(
    c => !c.collection.startsWith("directus_")
  ) || [];

  const systemCollections = collectionsQuery.data?.collections?.filter(
    c => c.collection.startsWith("directus_")
  ) || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
              BUILT Alliances - Directus
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="text-page-description">
              Validação e gerenciamento de coleções
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              validationQuery.refetch();
              collectionsQuery.refetch();
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg" data-testid="text-connection-title">
                Status da Conexão
              </CardTitle>
              <CardDescription data-testid="text-connection-url">
                https://app.builtalliances.com
              </CardDescription>
            </div>
            {validationQuery.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : validationQuery.data?.success ? (
              <Badge variant="default" className="bg-green-600" data-testid="badge-status-success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="destructive" data-testid="badge-status-error">
                <XCircle className="h-3 w-3 mr-1" />
                Erro
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {validationQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : validationQuery.data?.success ? (
              <div className="text-sm text-muted-foreground" data-testid="text-connection-message">
                {validationQuery.data.message}
              </div>
            ) : (
              <div className="text-sm text-destructive" data-testid="text-connection-error">
                {validationQuery.data?.error || "Falha ao conectar ao Directus"}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg" data-testid="text-collections-title">
                  Coleções do Usuário
                </CardTitle>
                <CardDescription>
                  {userCollections.length} coleções encontradas
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {collectionsQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : userCollections.length > 0 ? (
                <div className="space-y-1">
                  {userCollections.map((collection) => (
                    <button
                      key={collection.collection}
                      onClick={() => setSelectedCollection(collection.collection)}
                      className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors hover-elevate ${
                        selectedCollection === collection.collection
                          ? "bg-accent"
                          : "bg-muted/50"
                      }`}
                      data-testid={`button-collection-${collection.collection}`}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{collection.collection}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-collections">
                  Nenhuma coleção de usuário encontrada.
                  <br />
                  Aguardando suas diretrizes para criar as coleções.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg" data-testid="text-fields-title">
                  {selectedCollection ? `Campos: ${selectedCollection}` : "Campos da Coleção"}
                </CardTitle>
                <CardDescription>
                  {selectedCollection 
                    ? `${fieldsQuery.data?.fields?.length || 0} campos` 
                    : "Selecione uma coleção"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedCollection ? (
                <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-select-collection">
                  Selecione uma coleção para ver seus campos
                </div>
              ) : fieldsQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : fieldsQuery.data?.fields && fieldsQuery.data.fields.length > 0 ? (
                <div className="space-y-1">
                  {fieldsQuery.data.fields.map((field) => (
                    <div
                      key={field.field}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`field-${field.field}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{field.field}</span>
                        {field.meta?.required && (
                          <Badge variant="secondary" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-fields">
                  Nenhum campo encontrado nesta coleção
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {systemCollections.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg" data-testid="text-system-collections-title">
                  Coleções do Sistema
                </CardTitle>
                <CardDescription>
                  {systemCollections.length} coleções do Directus
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {systemCollections.map((collection) => (
                  <Badge 
                    key={collection.collection} 
                    variant="secondary"
                    data-testid={`badge-system-${collection.collection}`}
                  >
                    {collection.collection.replace("directus_", "")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
