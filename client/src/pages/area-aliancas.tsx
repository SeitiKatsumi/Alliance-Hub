import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuraBadge } from "@/components/aura-score";
import { RedeBadgeButton } from "@/components/rede-badge-viewer";
import ComunidadePage from "@/pages/comunidade";
import AreMembroPage from "@/pages/area-membros";
import BiasPage from "@/pages/bias";
import OportunidadesPage from "@/pages/oportunidades";
import {
  Briefcase,
  Globe2,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

interface AliadoRede {
  id: string;
  nome?: string;
  cargo?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
  foto?: string | null;
  foto_perfil?: string | null;
  perfil_aliado?: string | null;
  tipo_alianca?: string | null;
  nucleo_alianca?: string | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

function fotoUrl(m: AliadoRede): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=160&height=160&fit=cover`;
}

function initials(nome?: string): string {
  if (!nome) return "?";
  return nome
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isAliado(m: AliadoRede): boolean {
  const redes = Array.isArray(m.Outras_redes_as_quais_pertenco) ? m.Outras_redes_as_quais_pertenco : [];
  return redes.includes("BUILT_ALLIANCE_PARTNER");
}

function AliadosTab() {
  const [search, setSearch] = useState("");
  const { data: membros = [], isLoading } = useQuery<AliadoRede[]>({
    queryKey: ["/api/membros", "aliados-rede"],
    queryFn: async () => {
      const r = await fetch("/api/membros");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const aliados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return membros
      .filter(isAliado)
      .filter((m) => {
        if (!q) return true;
        return [m.nome, m.empresa, m.cargo, m.cidade, m.estado]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
  }, [membros, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Aliados Licenciados</h2>
        </div>
        <Badge variant="outline" className="w-fit border-brand-gold/30 text-brand-gold">
          {aliados.length} aliado{aliados.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aliado..."
          className="pl-9"
          data-testid="input-buscar-aliados"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : aliados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum aliado encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {aliados.map((aliado) => {
            const foto = fotoUrl(aliado);
            const redes = Array.isArray(aliado.Outras_redes_as_quais_pertenco)
              ? aliado.Outras_redes_as_quais_pertenco
              : [];
            return (
              <Link key={aliado.id} href={`/membro/${aliado.id}`}>
                <Card className="h-full cursor-pointer border-border/70 transition-colors hover:border-brand-gold/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {foto ? (
                        <img src={foto} alt={aliado.nome || "Aliado"} className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gold/15 text-sm font-bold text-brand-gold">
                          {initials(aliado.nome)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{aliado.nome || "Aliado BUILT"}</p>
                        <p className="truncate text-sm text-muted-foreground">{aliado.empresa || aliado.cargo || "Rede BUILT"}</p>
                        {(aliado.cidade || aliado.estado) && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {[aliado.cidade, aliado.estado].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {redes.includes("BUILT_ALLIANCE_PARTNER") && (
                        <RedeBadgeButton rede="BUILT_ALLIANCE_PARTNER" height={24} maxWidth={74} />
                      )}
                      {redes.includes("BUILT_FOUNDING_MEMBER") && (
                        <RedeBadgeButton rede="BUILT_FOUNDING_MEMBER" height={24} maxWidth={74} />
                      )}
                      <AuraBadge membroId={aliado.id} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AreaAliancasPage() {
  const searchParams = useSearch();
  const getTabFromSearch = () => {
    const tab = new URLSearchParams(searchParams).get("tab");
    return ["opas", "bias", "membros", "comunidades", "aliados"].includes(tab || "") ? tab! : "opas";
  };
  const [activeTab, setActiveTab] = useState(getTabFromSearch);

  useEffect(() => {
    setActiveTab(getTabFromSearch());
  }, [searchParams]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-area-aliancas-title">
          <Users className="h-7 w-7 text-cyan-500" />
          BUILT Alliances
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1 md:grid-cols-5">
          <TabsTrigger value="opas" className="gap-2" data-testid="tab-area-opas">
            <Target className="h-4 w-4" />
            OPAs
          </TabsTrigger>
          <TabsTrigger value="bias" className="gap-2" data-testid="tab-area-bias">
            <Briefcase className="h-4 w-4 text-orange-500" />
            BIAs
          </TabsTrigger>
          <TabsTrigger value="membros" className="gap-2" data-testid="tab-area-membros">
            <Users className="h-4 w-4" />
            Membros Aliados
          </TabsTrigger>
          <TabsTrigger value="comunidades" className="gap-2" data-testid="tab-area-comunidades">
            <Globe2 className="h-4 w-4" />
            Comunidades
          </TabsTrigger>
          <TabsTrigger value="aliados" className="gap-2" data-testid="tab-area-aliados">
            <ShieldCheck className="h-4 w-4" />
            Aliados Licenciados
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="opas"
          className="[&>div]:p-0 [&>div]:max-w-none"
        >
          {activeTab === "opas" && <OportunidadesPage />}
        </TabsContent>
        <TabsContent
          value="bias"
          className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-bias-title']>div]:hidden"
        >
          {activeTab === "bias" && <BiasPage />}
        </TabsContent>
        <TabsContent
          value="membros"
          className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-membros-title']>div]:hidden"
        >
          {activeTab === "membros" && <AreMembroPage />}
        </TabsContent>
        <TabsContent
          value="comunidades"
          className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='icon-comunidade-title']]:hidden"
        >
          {activeTab === "comunidades" && <ComunidadePage />}
        </TabsContent>
        <TabsContent value="aliados">
          {activeTab === "aliados" && <AliadosTab />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
