# Built Alliances Platform — Arquitetura Frontend & Directus

## Visão Geral

A plataforma Built Alliances usa uma arquitetura de **dois bancos de dados**:

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| **Dados de negócio** | [Directus CMS](https://app.builtalliances.com) | Membros, BIAs, OPAs, Fluxo de Caixa, Categorias, CPP |
| **Auth / Sessão** | PostgreSQL local (Drizzle ORM) | Usuários da plataforma, senhas, permissões, sessões |

---

## Fluxo de Dados

```
Browser (React)
    │
    ▼
Express API (/api/*)          ← único ponto de entrada
    │
    ├── Directus API          ← dados de negócio
    │   https://app.builtalliances.com/items/{collection}
    │   Autenticação: Bearer DIRECTUS_TOKEN
    │
    └── PostgreSQL local      ← auth/sessão
        Tabela: users, session
```

Toda chamada do frontend vai para `/api/*`. O backend decide se vai ao Directus ou ao PostgreSQL local.

---

## Collections Directus

| Collection Directus | Rota API local | Página |
|---------------------|---------------|--------|
| `cadastro_geral` | `/api/membros` | `/membros`, `/meu-perfil` |
| `bias_projetos` | `/api/bias` | `/bias`, `/bias/:id` |
| `tipos_oportunidades` | `/api/oportunidades` | `/opas` |
| `fluxo_caixa` | `/api/fluxo-caixa` | `/fluxo-caixa` |
| `Categorias` | `/api/categorias` | (dropdown no fluxo de caixa) |
| `Tipos_CPP` | `/api/tipos-cpp` | (dropdown no fluxo de caixa) |

---

## Helpers Directus (server/routes.ts)

```typescript
// Busca todos os itens de uma collection
directusFetch(collection, params?)

// Busca um item pelo ID
directusFetchOne(collection, id)

// Cria um item
directusCreate(collection, body)

// Atualiza um item
directusUpdate(collection, id, body)

// Deleta um item
directusDelete(collection, id)
```

Todos usam o header `Authorization: Bearer ${DIRECTUS_TOKEN}` e apontam para `DIRECTUS_URL` (padrão: `https://app.builtalliances.com`).

---

## Arquivos do Directus (Uploads / Fotos)

O Directus gerencia arquivos em `/files`. Para exibir uma imagem pelo UUID:

```
https://app.builtalliances.com/assets/{file_uuid}
```

Parâmetros úteis de transformação:
```
?width=200&height=200&fit=cover   → thumbnail quadrado
?quality=80                        → compressão
```

### Upload de arquivos

O endpoint `/api/upload` (multer) recebe multipart, faz upload ao Directus e retorna os UUIDs dos arquivos criados.

---

## Campos principais — cadastro_geral (Membros)

| Campo Directus | Mapeado como | Tipo | Descrição |
|----------------|-------------|------|-----------|
| `id` | `id` | UUID | Identificador único |
| `nome` | `nome` | string | Nome do membro |
| `Nome_de_usuario` | `Nome_de_usuario` | string | Username alternativo |
| `email` | `email` | string | E-mail |
| `telefone` | `telefone` | string | Telefone |
| `whatsapp` | `whatsapp` | string | WhatsApp |
| `cidade` | `cidade` | string | Cidade |
| `estado` | `estado` | string | Estado (UF) |
| `empresa` | `empresa` | string | Empresa |
| `cargo` | `cargo` | string | Cargo |
| `especialidade` | `especialidade` | string | Especialidade profissional |
| `foto` | `foto` | UUID | UUID do arquivo no Directus |
| `tipo_de_cadastro` | `tipo_de_cadastro` | string | Tipo: Pessoa Física / Jurídica / etc |
| `tipo_pessoa` | `tipo_pessoa` | string | Tipo de pessoa |
| `perfil_aliado` | `perfil_aliado` | string | Perfil como aliado |
| `nucleo_alianca` | `nucleo_alianca` | string | Núcleo de aliança |
| `ativo` | `ativo` | boolean | Ativo na plataforma |

**URL da foto:** `https://app.builtalliances.com/assets/{foto}`

---

## Campos principais — bias_projetos (BIAs)

| Campo Directus | Descrição |
|----------------|-----------|
| `nome_bia` | Nome da aliança |
| `objetivo_alianca` | Objetivo da aliança |
| `localizacao` | Endereço textual |
| `latitude`, `longitude` | Coordenadas para o mapa (criadas via `ensureBiasGeoFields()`) |
| `autor_bia` | UUID → cadastro_geral |
| `aliado_built` | UUID → cadastro_geral |
| `diretor_alianca` | UUID → cadastro_geral |
| `diretor_execucao` | UUID → cadastro_geral |
| `diretor_comercial` | UUID → cadastro_geral |
| `diretor_capital` | UUID → cadastro_geral |
| `valor_origem` | Valor origem (número) |
| `valor_geral_venda_vgv` | VGV (número) |
| `valor_realizado_venda` | Valor realizado (número) |
| `resultado_liquido` | Resultado líquido (número) |
| `lucro_previsto` | Lucro previsto (número) |
| `perc_*` / `cpp_*` | Percentuais e valores CPP por papel |
| `comissao_prevista_corretor` | % comissão corretor |
| `ir_previsto` | % IR previsto |
| `inss_previsto` | % INSS previsto |
| `manutencao_pos_obra_prevista` | % manutenção pós-obra |

> **Nota:** os campos `perc_*` e deduções são **percentuais (%)**, não valores em BRL.

---

## Campos principais — tipos_oportunidades (OPAs)

| Campo Directus | Descrição |
|----------------|-----------|
| `nome_oportunidade` | Nome da OPA |
| `tipo` | Tipo de oportunidade |
| `bia` | UUID → bias_projetos (bia_id) |
| `valor_origem_opa` | Valor origem (número) |
| `objetivo_alianca` | Objetivo da aliança |
| `nucleo_alianca` | Núcleo |
| `pais` | País |
| `descricao` | Descrição |
| `perfil_aliado` | Perfil do aliado buscado |

---

## Campos principais — fluxo_caixa

| Campo Directus | Descrição |
|----------------|-----------|
| `bia` | UUID → bias_projetos |
| `tipo` | `"entrada"` ou `"saida"` |
| `valor` | Decimal |
| `data` | Data (date) |
| `descricao` | Descrição |
| `membro_responsavel` | UUID → cadastro_geral |
| `Categoria` | Relação M2M → Categorias |
| `tipo_de_cpp` | Relação M2M → Tipos_CPP |
| `Favorecido` | UUID → cadastro_geral |
| `Anexos` | M2M → directus_files via `fluxo_caixa_files` |

**Nota sobre Anexos:** enviados como `[{directus_files_id: "uuid"}]`, resolvidos na leitura via `fields=*,Anexos.directus_files_id.*`.

---

## Autenticação

```
POST /api/login   → valida credenciais no Directus, cria sessão local
GET  /api/me      → retorna usuário da sessão { id, role, permissions, membro_directus_id }
POST /api/logout  → destrói sessão
```

O `membro_directus_id` conecta o usuário da plataforma ao seu cadastro em `cadastro_geral`.

**Roles:** `admin` | `manager` | `user`

**Permissões por módulo** (jsonb): `none` | `view` | `edit`

Módulos: `oportunidades`, `bias`, `calculadora`, `fluxo_caixa`, `membros`, `aura`, `painel`, `admin`

---

## Frontend — Padrões

### Query (leitura)
```typescript
const { data } = useQuery<Membro[]>({
  queryKey: ["/api/membros"],
});
```
O `queryFn` padrão já busca `fetch(queryKey[0])` — não precisa ser definido manualmente.

### Mutation (escrita)
```typescript
const mutation = useMutation({
  mutationFn: (data) => apiRequest("PATCH", `/api/membros/${id}`, data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/membros"] }),
});
```

### Formatação monetária (pt-BR)
```typescript
// Input controlado
formatInputBRL(str)   // formata ao digitar (últimos 2 dígitos = centavos)
parseBRLToNumber(str) // "1.234,56" → 1234.56

// Exibição
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
```

---

## Estrutura de Arquivos

```
client/src/
├── pages/
│   ├── bias.tsx          → Dashboard de BIAs + mapa interativo
│   ├── bia-detalhe.tsx   → Detalhe de uma BIA com OPAs relacionadas
│   ├── oportunidades.tsx → Dashboard de OPAs
│   ├── membros.tsx       → Diretório de membros
│   ├── meu-perfil.tsx    → Edição do perfil do usuário logado
│   ├── fluxo-caixa.tsx   → Gestão financeira por BIA
│   ├── resultados.tsx    → Análises financeiras (ROI, múltiplo, lucro)
│   ├── bias-calculadora  → Calculadora DM
│   ├── aura.tsx          → Sistema de pontuação Aura
│   ├── painel.tsx        → Dashboard principal
│   └── admin.tsx         → Administração de usuários
│
├── components/
│   ├── app-sidebar.tsx   → Navegação lateral
│   └── ui/               → Componentes shadcn/ui
│
├── hooks/
│   └── use-auth.ts       → Hook de autenticação (useAuth)
│
└── lib/
    └── queryClient.ts    → TanStack Query client + apiRequest helper

server/
├── index.ts              → Entrada Express
├── routes.ts             → Todas as rotas API + helpers Directus
├── db.ts                 → Conexão PostgreSQL (Drizzle)
└── storage.ts            → Camada de acesso a dados locais (users)

shared/
└── schema.ts             → Tipos TypeScript + schemas Zod compartilhados

client/public/
├── brazil-states.json    → GeoJSON estados do Brasil (mapa)
└── world-countries-50m.json → TopoJSON mapa-múndi
```

---

## Variáveis de Ambiente

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL local (auth/sessão) |
| `DIRECTUS_TOKEN` | Bearer token para Directus API |
| `DIRECTUS_URL` | Base URL do Directus (padrão: `https://app.builtalliances.com`) |
| `SESSION_SECRET` | Chave para assinar cookies de sessão |

---

## Mapa Interativo (BIAs)

- Biblioteca: `react-simple-maps` com `ZoomableGroup`
- GeoJSON Brasil: `/brazil-states.json` (143KB, local)
- TopoJSON mundo: `/world-countries-50m.json` (739KB, local)
- Geocodificação: Nominatim (OpenStreetMap) — sem chave de API
- Campos geográficos: `latitude` e `longitude` em `bias_projetos` (criados automaticamente via `ensureBiasGeoFields()`)
- Marcadores: pulsantes em dourado, clique navega para `/bias/:id`
