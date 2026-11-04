import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import type { AppUser } from '@/hooks/use-auth';
import { auraLookupState, isBuiltMemberForAura } from '@/lib/aura-access';
export interface MembroBusca {
    id: string;
    nome: string;
    cargo: string;
    empresa: string;
    foto: string | {
        id: string;
        filename_disk: string;
    } | null;
}
export function fixMojibakeText(value: string): string {
    if (!/[ÃÂ]|[\u0080-\u009F]/.test(value))
        return value.normalize("NFC");
    try {
        return decodeURIComponent(escape(value)).normalize("NFC");
    }
    catch {
        return value.normalize("NFC");
    }
}
export function fixMojibakeDeep<T>(value: T): T {
    if (typeof value === "string")
        return fixMojibakeText(value) as T;
    if (Array.isArray(value))
        return value.map(item => fixMojibakeDeep(item)) as T;
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, fixMojibakeDeep(item)])) as T;
    }
    return value;
}
export function fotoUrl(foto: MembroBusca["foto"]): string | null {
    if (!foto)
        return null;
    const fileId = typeof foto === "string" ? foto : foto.id || foto.filename_disk;
    if (!fileId)
        return null;
    if (fileId.startsWith("/api/assets/"))
        return fileId;
    if (fileId.startsWith("/assets/"))
        return fileId.replace(/^\/assets\//, "/api/assets/");
    if (fileId.startsWith("http"))
        return fileId;
    return `/api/assets/${fileId}?width=80&height=80&fit=cover`;
}
export function AvatarImage({ foto, nome }: {
    foto: MembroBusca["foto"];
    nome: string;
}) {
    const [failed, setFailed] = useState(false);
    const src = !failed ? fotoUrl(foto) : null;
    if (!src)
        return <>{getInitials(nome || "")}</>;
    return (<img src={src} alt="" aria-hidden="true" className="w-full h-full object-cover" onError={() => setFailed(true)}/>);
}
export function getInitials(nome: string): string {
    return nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "";
}
export function AuraLookupDialog({ user, open: lookupOpen, onOpenChange: setLookupOpen, onSelect, restoreFocus }: {
    user?: AppUser | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (member: MembroBusca) => void;
    restoreFocus?: () => void;
}) {
    const myId = user?.membro_directus_id;
    const enabled = lookupOpen && !!myId && isBuiltMemberForAura(user);
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupFilter, setLookupFilter] = useState<'all' | 'eligible'>('all');
    const [lookupVisibleCount, setLookupVisibleCount] = useState(30);
    useEffect(() => {
        setLookupVisibleCount(30);
    }, [lookupQuery, lookupOpen, lookupFilter]);
    useEffect(() => {
        if (!lookupOpen) {
            setLookupQuery('');
            setLookupFilter('all');
        }
    }, [lookupOpen]);
    const { data: vinculosAuraServidor = [], isPending: loadingLinks, isError: linksError, refetch: retryLinks } = useQuery<string[]>({
        queryKey: ['/api/aura/vinculos', myId],
        enabled,
        queryFn: async () => {
            const res = await fetch('/api/aura/vinculos', { credentials: 'include' });
            if (!res.ok) throw Error('Não foi possível conferir seus vínculos.');
            const data = await res.json();
            if (!Array.isArray(data?.ids)) throw Error('Vínculos indisponíveis.');
            return data.ids.map(String);
        },
    });
    const { data: minhasAvaliacoesData, isPending: loadingMyEvaluations, isError: evaluationsError, refetch: retryEvaluations } = useQuery<{
        dadas: Array<{
            avaliado_membro_id: string;
        }>;
    }>({
        queryKey: ['/api/aura/minhas-avaliacoes'],
        enabled,
        queryFn: async () => {
            const res = await fetch('/api/aura/minhas-avaliacoes', { credentials: 'include' });
            if (!res.ok) throw Error('Não foi possível conferir suas avaliações.');
            return fixMojibakeDeep(await res.json());
        },
    });
    const lookupSearchTerm = lookupQuery.trim();
    const evaluatedMemberIds = new Set((minhasAvaliacoesData?.dadas || []).map(item => String(item.avaliado_membro_id)));
    const lookupState = (id: string) => auraLookupState({
        user,
        targetMemberId: id,
        linkedMemberIds: new Set(vinculosAuraServidor),
        evaluatedMemberIds,
        ready: !loadingLinks && !loadingMyEvaluations,
        failed: linksError || evaluationsError,
    });
    const { data: allMembros = [], isLoading: loadingSearch, isError: searchError, refetch: retrySearch } = useQuery<MembroBusca[]>({
        queryKey: ['/api/aura/membros/busca', lookupSearchTerm, lookupFilter === 'eligible'],
        enabled,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (lookupSearchTerm.length >= 2) params.set('q', lookupSearchTerm);
            if (lookupFilter === 'eligible') params.set('avaliaveis', '1');
            const res = await fetch('/api/aura/membros/busca' + (params.size ? '?' + params.toString() : ''), { credentials: 'include' });
            if (!res.ok) throw Error('Não foi possível buscar os membros.');
            return fixMojibakeDeep(await res.json());
        },
    });
    const lookupResults = useMemo(() => {
        const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const q = normalize(lookupSearchTerm);
        return allMembros
            .filter(m => m.id !== myId)
            .filter(m => lookupFilter !== 'eligible' || !evaluatedMemberIds.has(String(m.id)))
            .filter(m => !q || [m.nome, m.empresa, m.cargo].some(value => normalize(value || '').includes(q)))
            .sort((a, b) => (a.nome || '').trim().localeCompare((b.nome || '').trim(), 'pt-BR', { sensitivity: 'base', numeric: true }));
    }, [allMembros, lookupSearchTerm, myId, lookupFilter, minhasAvaliacoesData]);
    function abrirAuraDoMembro(member: MembroBusca) {
        setLookupOpen(false);
        onSelect(member);
    }
    if (!isBuiltMemberForAura(user))
        return null;
    return (<Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent onCloseAutoFocus={event => { if (restoreFocus) {
        event.preventDefault();
        restoreFocus();
    } }} className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consultar Aura</DialogTitle>
            <DialogDescription>
              Consulte a Aura dos membros. Você pode registrar percepção para quem compartilha uma BIA ou comunidade com você.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50"/>
              <Input value={lookupQuery} onChange={e => setLookupQuery(e.target.value)} placeholder="Buscar por nome, empresa ou cargo..." className="pl-9" data-testid="input-consultar-aura-membro"/>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar membros por permissão">
              <Button type="button" size="sm" variant={lookupFilter === "all" ? "default" : "outline"} aria-pressed={lookupFilter === "all"} onClick={() => setLookupFilter("all")}>Todos os membros</Button>
              <Button type="button" size="sm" variant={lookupFilter === "eligible" ? "default" : "outline"} aria-pressed={lookupFilter === "eligible"} onClick={() => setLookupFilter("eligible")}>Posso avaliar</Button>
            </div>
            {(linksError || evaluationsError) && <div className="text-sm text-muted-foreground" role="alert">Não foi possível conferir quem você pode avaliar. <Button type="button" variant="ghost" onClick={() => { retryLinks(); retryEvaluations(); }}>Tentar novamente</Button></div>}
            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border/60">
              {searchError ? <div role="alert" className="p-4 text-sm">Não foi possível buscar os membros. <Button type="button" variant="ghost" onClick={() => retrySearch()}>Tentar novamente</Button></div> : loadingSearch ? (<div className="space-y-1 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-10 h-10 rounded-full"/>
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-44"/>
                        <Skeleton className="h-3 w-32"/>
                      </div>
                    </div>))}
                </div>) : lookupResults.length === 0 ? (<p className="p-4 text-sm text-muted-foreground">{lookupFilter === "eligible" ? "Nenhum membro disponível para uma nova avaliação nesta busca." : "Nenhum membro encontrado."}</p>) : (lookupResults.slice(0, lookupVisibleCount).map(m => (<button key={m.id} type="button" onClick={() => abrirAuraDoMembro(m)} className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/70 border-b border-border/50 last:border-0" data-testid={`btn-consultar-aura-membro-${m.id}`}>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold bg-[#001D34]/10 text-[#D7BB7D] shrink-0">
                      <AvatarImage foto={m.foto} nome={m.nome}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{m.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{[m.cargo, m.empresa].filter(Boolean).join(" · ") || "Membro BUILT"}</p>
                      <span className={`mt-1 block text-xs ${lookupState(m.id) === "eligible" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                        {{ eligible: "Pode avaliar", consult: "Somente consulta · sem BIA ou comunidade em comum", evaluated: "Já avaliado por você", checking: "Conferindo permissão…", unavailable: "Permissão indisponível · consultar Aura" }[lookupState(m.id)]}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0"/>
                  </button>)))}
            </div>
            {!loadingSearch && lookupResults.length > lookupVisibleCount && (<Button type="button" variant="outline" className="w-full gap-2" onClick={() => setLookupVisibleCount(count => count + 30)}>
                Ver mais ({lookupResults.length - lookupVisibleCount} restantes)
                <ChevronDown className="h-4 w-4"/>
              </Button>)}
          </div>
        </DialogContent>
      </Dialog>);
}
