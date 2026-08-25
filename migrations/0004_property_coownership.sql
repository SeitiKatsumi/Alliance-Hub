CREATE TABLE IF NOT EXISTS carteira_imovel_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE CASCADE,
  user_id text,
  membro_id text,
  nome text NOT NULL,
  email text,
  map_percentual numeric(7,4) NOT NULL CHECK (map_percentual > 0 AND map_percentual <= 100),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'revogado')),
  aceite_versao integer NOT NULL DEFAULT 1,
  aceite_evidencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  convite_token_hash text,
  convite_expira_em timestamp,
  aceite_em timestamp,
  recusado_em timestamp,
  convidado_por_user_id text,
  convidado_por_membro_id text,
  criado_em timestamp DEFAULT now() NOT NULL,
  atualizado_em timestamp DEFAULT now() NOT NULL
);

ALTER TABLE carteira_imovel_socios
  ADD COLUMN IF NOT EXISTS aceite_evidencias jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS bia_imovel_origens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id text NOT NULL REFERENCES inventario_imoveis(id) ON DELETE RESTRICT,
  bia_id text,
  nome_bia text NOT NULL,
  status text NOT NULL DEFAULT 'preparacao' CHECK (status IN ('preparacao', 'aguardando_aprovacao', 'aguardando_mou', 'ativa', 'cancelada')),
  valor_origem numeric(18,2) NOT NULL CHECK (valor_origem > 0),
  moeda text NOT NULL DEFAULT 'BRL',
  divida_snapshot numeric(18,2) NOT NULL DEFAULT 0,
  papeis jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por_user_id text,
  criado_por_membro_id text,
  criado_em timestamp DEFAULT now() NOT NULL,
  atualizado_em timestamp DEFAULT now() NOT NULL,
  ativado_em timestamp,
  cancelado_em timestamp
);

CREATE TABLE IF NOT EXISTS bia_map_origem_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_id uuid NOT NULL REFERENCES bia_imovel_origens(id) ON DELETE CASCADE,
  bia_id text NOT NULL,
  socio_id uuid REFERENCES carteira_imovel_socios(id) ON DELETE SET NULL,
  membro_id text NOT NULL,
  nome text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('guardiao', 'multiplicador')),
  percentual numeric(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  moeda text NOT NULL DEFAULT 'BRL',
  criado_em timestamp DEFAULT now() NOT NULL,
  UNIQUE (origem_id, membro_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_imovel_socios_email ON carteira_imovel_socios (imovel_id, lower(email)) WHERE email IS NOT NULL AND status <> 'revogado';
CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_imovel_socios_user ON carteira_imovel_socios (imovel_id, user_id) WHERE user_id IS NOT NULL AND status <> 'revogado';
CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_imovel_socios_membro ON carteira_imovel_socios (imovel_id, membro_id) WHERE membro_id IS NOT NULL AND status <> 'revogado';
CREATE UNIQUE INDEX IF NOT EXISTS idx_bia_imovel_origem_ativa ON bia_imovel_origens (imovel_id) WHERE status <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS idx_bia_imovel_origem_bia ON bia_imovel_origens (bia_id) WHERE bia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bia_map_origem_bia ON bia_map_origem_alocacoes (bia_id);
