import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Monitor, Pencil, Plus, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ProjectStatus = "checking" | "online" | "offline";

interface LocalProject {
  id: string;
  name: string;
  port: number;
  path: string;
  kind: "Frontend" | "Backend" | "Full stack" | "Banco" | "Outro";
}

type ProjectDraft = Omit<LocalProject, "id">;

const STORAGE_KEY = "codex-localhost-portal-projects";

const DEFAULT_PROJECTS: LocalProject[] = [
  { id: "built-3003", name: "Projeto Codex atual", port: 3003, path: "/", kind: "Full stack" },
  { id: "api-5000", name: "API local", port: 5000, path: "/api/health", kind: "Backend" },
  { id: "vite-5173", name: "Vite padrão", port: 5173, path: "/", kind: "Frontend" },
  { id: "vite-5174", name: "Vite alternativo", port: 5174, path: "/", kind: "Frontend" },
  { id: "next-3000", name: "Next/React padrão", port: 3000, path: "/", kind: "Frontend" },
  { id: "next-3001", name: "Next alternativo", port: 3001, path: "/", kind: "Frontend" },
  { id: "node-8080", name: "Servidor 8080", port: 8080, path: "/", kind: "Backend" },
  { id: "postgres-5433", name: "Postgres tunnel", port: 5433, path: "/", kind: "Banco" },
];

const EMPTY_DRAFT: ProjectDraft = {
  name: "",
  port: 3000,
  path: "/",
  kind: "Frontend",
};

function normalizePath(path: string) {
  if (!path.trim()) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function getProjectUrl(project: LocalProject) {
  return `http://localhost:${project.port}${normalizePath(project.path)}`;
}

async function probeLocalhost(project: LocalProject) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);

  try {
    await fetch(getProjectUrl(project), {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function loadProjects() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROJECTS;
    const parsed = JSON.parse(raw) as LocalProject[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROJECTS;
    return parsed;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export default function PortalLocalhostsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<LocalProject[]>(() => loadProjects());
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ProjectStatus>>({});

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(project =>
      project.name.toLowerCase().includes(term) ||
      String(project.port).includes(term) ||
      project.kind.toLowerCase().includes(term)
    );
  }, [projects, query]);

  async function refreshStatuses(targets = projects) {
    setStatuses(current => ({
      ...current,
      ...Object.fromEntries(targets.map(project => [project.id, "checking" as ProjectStatus])),
    }));

    const results = await Promise.all(
      targets.map(async project => [project.id, await probeLocalhost(project)] as const)
    );

    setStatuses(current => ({
      ...current,
      ...Object.fromEntries(results.map(([id, online]) => [id, online ? "online" : "offline"])),
    }));
  }

  useEffect(() => {
    refreshStatuses();
  }, []);

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function handleSubmit() {
    const name = draft.name.trim();
    const port = Number(draft.port);

    if (!name || !Number.isInteger(port) || port < 1 || port > 65535) {
      toast({ title: "Verifique nome e porta", variant: "destructive" });
      return;
    }

    const project: LocalProject = {
      id: editingId || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${port}-${Date.now()}`,
      name,
      port,
      path: normalizePath(draft.path),
      kind: draft.kind,
    };

    setProjects(current =>
      editingId ? current.map(item => item.id === editingId ? project : item) : [project, ...current]
    );
    resetForm();
    refreshStatuses([project]);
  }

  function handleEdit(project: LocalProject) {
    setEditingId(project.id);
    setDraft({ name: project.name, port: project.port, path: project.path, kind: project.kind });
  }

  function handleDelete(projectId: string) {
    setProjects(current => current.filter(project => project.id !== projectId));
    setStatuses(current => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  }

  async function copyUrl(project: LocalProject) {
    await navigator.clipboard.writeText(getProjectUrl(project));
    toast({ title: "URL copiada" });
  }

  function resetDefaults() {
    setProjects(DEFAULT_PROJECTS);
    resetForm();
    refreshStatuses(DEFAULT_PROJECTS);
  }

  const onlineCount = projects.filter(project => statuses[project.id] === "online").length;

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#10263a]">
      <div className="border-b border-[#d8d0be] bg-[#10263a] text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-7 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded border border-white/15 px-2.5 py-1 text-xs text-white/75">
              <Monitor className="h-3.5 w-3.5" />
              Codex Localhosts
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Portal de portas locais</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Abra, monitore e organize os localhost dos seus projetos Codex em um só painel.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-white/15 px-4 py-3">
              <div className="text-2xl font-semibold">{projects.length}</div>
              <div className="text-xs text-white/60">salvos</div>
            </div>
            <div className="rounded border border-emerald-300/30 px-4 py-3">
              <div className="text-2xl font-semibold text-emerald-200">{onlineCount}</div>
              <div className="text-xs text-white/60">online</div>
            </div>
            <div className="rounded border border-white/15 px-4 py-3">
              <div className="text-2xl font-semibold">{projects.length - onlineCount}</div>
              <div className="text-xs text-white/60">offline</div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-5">
          <Card className="rounded border-[#d8d0be] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? "Editar porta" : "Adicionar porta"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Meu projeto" />
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1.5">
                  <Label>Caminho</Label>
                  <Input value={draft.path} onChange={event => setDraft(current => ({ ...current, path: event.target.value }))} placeholder="/" />
                </div>
                <div className="space-y-1.5">
                  <Label>Porta</Label>
                  <Input type="number" min={1} max={65535} value={draft.port} onChange={event => setDraft(current => ({ ...current, port: Number(event.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={draft.kind} onValueChange={value => setDraft(current => ({ ...current, kind: value as LocalProject["kind"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Frontend">Frontend</SelectItem>
                    <SelectItem value="Backend">Backend</SelectItem>
                    <SelectItem value="Full stack">Full stack</SelectItem>
                    <SelectItem value="Banco">Banco</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="flex-1 gap-2">
                  <Plus className="h-4 w-4" />
                  {editingId ? "Salvar" : "Adicionar"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded border-[#d8d0be] shadow-sm">
            <CardContent className="space-y-3 p-4">
              <Button variant="outline" onClick={() => refreshStatuses()} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Atualizar status
              </Button>
              <Button variant="ghost" onClick={resetDefaults} className="w-full">Restaurar portas padrão</Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded border border-[#d8d0be] bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, porta ou tipo" />
            </div>
            <Button variant="outline" onClick={() => refreshStatuses(filteredProjects)} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Verificar
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredProjects.map(project => {
              const status = statuses[project.id] || "checking";
              const url = getProjectUrl(project);

              return (
                <Card key={project.id} className="rounded border-[#d8d0be] shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold">{project.name}</h2>
                          <Badge variant="outline">{project.kind}</Badge>
                        </div>
                        <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-sm text-[#5b6b7a] hover:text-[#10263a]">
                          {url}
                        </a>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {status === "online" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        {status === "offline" && <XCircle className="h-5 w-5 text-red-500" />}
                        {status === "checking" && <RefreshCw className="h-5 w-5 animate-spin text-[#b09557]" />}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="gap-2">
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Abrir
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyUrl(project)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copiar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(project)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(project.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
