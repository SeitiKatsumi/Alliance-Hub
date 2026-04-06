import { BookOpen, Database, ArrowRight, Server, Globe, Key, FileText, Layers, Code2 } from "lucide-react";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-brand-gold/70 shrink-0" />
        <h2 className="text-sm font-semibold text-brand-gold/90 uppercase tracking-wider">{title}</h2>
        <div className="flex-1 h-px bg-brand-gold/10" />
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5" style={{ background: "rgba(215,187,125,0.05)" }}>
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-brand-gold/60 font-mono font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 text-white/60 ${j === 0 ? "font-mono text-brand-gold/70" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-white/5 px-4 py-3 text-xs font-mono text-white/60 overflow-x-auto"
      style={{ background: "#020b16" }}>
      {children}
    </pre>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] border border-brand-gold/20 text-brand-gold/60 bg-brand-gold/5">{children}</span>
  );
}

export default function DocumentacaoPage() {
  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10 px-6 py-8"
        style={{ background: "radial-gradient(ellipse at 20% 50%, #001225 0%, #000c1f 40%, #020b16 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40" />

        <div className="relative z-10">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.35em] uppercase mb-1">
            // BUILT ALLIANCES · DOCUMENTAÇÃO TÉCNICA
          </p>
          <h1 className="text-2xl font-bold text-brand-gold font-mono">Frontend & Directus</h1>
          <p className="text-sm text-white/30 font-mono mt-1">&gt; arquitetura, relações e padrões da plataforma</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Visão Geral */}
        <Section icon={Layers} title="Arquitetura Geral">
          <p className="text-sm text-white/50 mb-4">A plataforma usa dois bancos de dados com responsabilidades separadas:</p>
          <Table
            headers={["Camada", "Tecnologia", "Responsabilidade"]}
            rows={[
              ["Dados de negócio", "Directus CMS (app.builtalliances.com)", "Membros, BIAs, OPAs, Fluxo de Caixa, Categorias, CPP"],
              ["Auth / Sessão", "PostgreSQL local (Drizzle ORM)", "Usuários da plataforma, senhas, permissões, sessões"],
            ]}
          />
          <div className="mt-4">
            <CodeBlock>{`Browser (React)
    │
    ▼
Express API (/api/*)          ← único ponto de entrada
    │
    ├── Directus API          ← dados de negócio
    │   https://app.builtalliances.com/items/{collection}
    │   Autenticação: Bearer DIRECTUS_TOKEN
    │
    └── PostgreSQL local      ← auth/sessão
        Tabela: users, session`}</CodeBlock>
          </div>
        </Section>

        {/* Collections */}
        <Section icon={Database} title="Collections Directus → Rotas API">
          <Table
            headers={["Collection Directus", "Rota API local", "Página"]}
            rows={[
              ["cadastro_geral", "/api/membros", "/membros, /meu-perfil"],
              ["bias_projetos", "/api/bias", "/bias, /bias/:id"],
              ["tipos_oportunidades", "/api/oportunidades", "/opas"],
              ["fluxo_caixa", "/api/fluxo-caixa", "/fluxo-caixa"],
              ["Categorias", "/api/categorias", "(dropdown fluxo de caixa)"],
              ["Tipos_CPP", "/api/tipos-cpp", "(dropdown fluxo de caixa)"],
            ]}
          />
        </Section>

        {/* Helpers Directus */}
        <Section icon={Server} title="Helpers Directus (server/routes.ts)">
          <CodeBlock>{`// Busca todos os itens de uma collection
directusFetch(collection, params?)

// Busca um item pelo ID
directusFetchOne(collection, id)

// Cria um item
directusCreate(collection, body)

// Atualiza um item
directusUpdate(collection, id, body)

// Deleta um item
directusDelete(collection, id)

// Todos usam:
// Authorization: Bearer \${DIRECTUS_TOKEN}
// Base: https://app.builtalliances.com`}</CodeBlock>
        </Section>

        {/* Arquivos / Fotos */}
        <Section icon={Globe} title="Arquivos e Fotos (Directus Assets)">
          <p className="text-sm text-white/50 mb-3">Para exibir qualquer arquivo ou foto armazenado no Directus:</p>
          <CodeBlock>{`// URL base de qualquer arquivo
https://app.builtalliances.com/assets/{file_uuid}

// Com transformação de imagem
https://app.builtalliances.com/assets/{file_uuid}?width=200&height=200&fit=cover

// Upload de arquivos → POST /api/upload (multer)
// Retorna: { success: true, fileIds: ["uuid-do-arquivo"] }`}</CodeBlock>
        </Section>

        {/* Campos principais */}
        <Section icon={FileText} title="Campos — cadastro_geral (Membros)">
          <Table
            headers={["Campo Directus", "Tipo", "Descrição"]}
            rows={[
              ["id", "UUID", "Identificador único"],
              ["nome", "string", "Nome do membro"],
              ["email", "string", "E-mail"],
              ["telefone / whatsapp", "string", "Contato"],
              ["cidade / estado", "string", "Localização"],
              ["empresa", "string", "Empresa"],
              ["cargo", "string", "Cargo"],
              ["especialidade", "string", "Especialidade profissional"],
              ["foto", "UUID", "UUID do arquivo → /assets/{uuid}"],
              ["tipo_de_cadastro", "string", "Tipo: PF / PJ / etc"],
              ["perfil_aliado", "string", "Perfil como aliado"],
              ["nucleo_alianca", "string", "Núcleo de aliança"],
              ["ativo", "boolean", "Ativo na plataforma"],
            ]}
          />
        </Section>

        <Section icon={FileText} title="Campos — bias_projetos (BIAs)">
          <Table
            headers={["Campo Directus", "Descrição"]}
            rows={[
              ["nome_bia", "Nome da aliança"],
              ["objetivo_alianca", "Objetivo"],
              ["localizacao", "Endereço textual"],
              ["latitude / longitude", "Coordenadas para o mapa (criadas via ensureBiasGeoFields)"],
              ["autor_bia, aliado_built", "UUID → cadastro_geral"],
              ["diretor_alianca, diretor_execucao, diretor_comercial, diretor_capital", "UUID → cadastro_geral"],
              ["valor_geral_venda_vgv", "VGV (número)"],
              ["valor_realizado_venda", "Valor realizado (número)"],
              ["resultado_liquido / lucro_previsto", "Resultados financeiros (número)"],
              ["perc_* / cpp_*", "Percentuais e valores CPP por papel"],
              ["comissao_prevista_corretor, ir_previsto, inss_previsto, manutencao_pos_obra_prevista", "Deduções em % (não em BRL)"],
            ]}
          />
        </Section>

        <Section icon={FileText} title="Campos — fluxo_caixa">
          <Table
            headers={["Campo Directus", "Descrição"]}
            rows={[
              ["bia", "UUID → bias_projetos"],
              ["tipo", '"entrada" ou "saida"'],
              ["valor", "Decimal"],
              ["data", "Date"],
              ["membro_responsavel", "UUID → cadastro_geral"],
              ["Categoria", "Relação M2M → Categorias"],
              ["tipo_de_cpp", "Relação M2M → Tipos_CPP"],
              ["Favorecido", "UUID → cadastro_geral"],
              ["Anexos", "M2M → directus_files via fluxo_caixa_files"],
            ]}
          />
          <p className="text-xs text-white/30 font-mono mt-2">
            Anexos: enviados como [{`{directus_files_id: "uuid"}`}], lidos com fields=*,Anexos.directus_files_id.*
          </p>
        </Section>

        {/* Auth */}
        <Section icon={Key} title="Autenticação">
          <CodeBlock>{`POST /api/login   → valida no Directus, cria sessão local
GET  /api/me      → retorna { id, role, permissions, membro_directus_id }
POST /api/logout  → destrói sessão

// Roles: admin | manager | user
// Permissões por módulo (none | view | edit):
// oportunidades, bias, calculadora, fluxo_caixa,
// membros, aura, painel, admin

// membro_directus_id → conecta o usuário ao cadastro_geral`}</CodeBlock>
        </Section>

        {/* Padrões frontend */}
        <Section icon={Code2} title="Padrões Frontend">
          <p className="text-xs text-white/40 font-mono mb-2">// Leitura de dados</p>
          <CodeBlock>{`const { data } = useQuery<Membro[]>({
  queryKey: ["/api/membros"],
  // queryFn padrão já busca fetch(queryKey[0])
});`}</CodeBlock>
          <p className="text-xs text-white/40 font-mono mt-4 mb-2">// Escrita / mutação</p>
          <CodeBlock>{`const mutation = useMutation({
  mutationFn: (data) => apiRequest("PATCH", \`/api/membros/\${id}\`, data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/membros"] }),
});`}</CodeBlock>
          <p className="text-xs text-white/40 font-mono mt-4 mb-2">// Formatação monetária pt-BR</p>
          <CodeBlock>{`formatInputBRL(str)    // formata ao digitar (últimos 2 dígitos = centavos)
parseBRLToNumber(str)  // "1.234,56" → 1234.56
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)`}</CodeBlock>
        </Section>

        {/* Estrutura de arquivos */}
        <Section icon={Layers} title="Estrutura de Arquivos">
          <CodeBlock>{`client/src/
├── pages/
│   ├── bias.tsx           → Dashboard de BIAs + mapa interativo
│   ├── bia-detalhe.tsx    → Detalhe de uma BIA com OPAs relacionadas
│   ├── oportunidades.tsx  → Dashboard de OPAs
│   ├── membros.tsx        → Diretório de membros
│   ├── meu-perfil.tsx     → Edição do perfil do usuário logado
│   ├── fluxo-caixa.tsx    → Gestão financeira por BIA
│   ├── resultados.tsx     → Análises financeiras (ROI, múltiplo, lucro)
│   ├── bias-calculadora   → Calculadora DM
│   ├── aura.tsx           → Sistema de pontuação Aura
│   ├── painel.tsx         → Dashboard principal
│   ├── admin.tsx          → Administração de usuários
│   └── documentacao.tsx   → Esta documentação
│
├── components/
│   ├── app-sidebar.tsx    → Navegação lateral
│   └── ui/                → Componentes shadcn/ui
│
├── hooks/
│   └── use-auth.ts        → Hook de autenticação (useAuth)
│
└── lib/
    └── queryClient.ts     → TanStack Query client + apiRequest

server/
├── routes.ts              → Todas as rotas API + helpers Directus
├── db.ts                  → Conexão PostgreSQL (Drizzle)
└── storage.ts             → Camada de acesso a dados locais (users)

client/public/
├── brazil-states.json     → GeoJSON estados do Brasil (mapa)
└── world-countries-50m.json → TopoJSON mapa-múndi`}</CodeBlock>
        </Section>

        <div className="text-center py-6 text-[10px] font-mono text-white/15">
          // Built Alliances Platform · Documentação Técnica
        </div>
      </div>
    </div>
  );
}
