ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS modelo_calculo integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS bia_aportes_iniciais (
 bia_id text PRIMARY KEY, revisao integer NOT NULL DEFAULT 0, revisao_map integer NOT NULL,
 modalidade text NOT NULL, compromissos jsonb NOT NULL, estado text NOT NULL DEFAULT 'rascunho',
 autor jsonb NOT NULL, atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_aportes_parcelas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL REFERENCES bia_aportes_iniciais(bia_id),
 revisao integer NOT NULL, chave text NOT NULL, numero integer NOT NULL, natureza text NOT NULL,
 componente text NOT NULL, valor numeric(18,2) NOT NULL, vencimento date NOT NULL,
 movimentos jsonb NOT NULL, vigente boolean NOT NULL DEFAULT true, pendente boolean NOT NULL DEFAULT true,
 historico jsonb NOT NULL DEFAULT '[]'::jsonb,
 UNIQUE(bia_id,revisao,chave,numero)
);
CREATE INDEX IF NOT EXISTS bia_aportes_parcelas_bia ON bia_aportes_parcelas(bia_id);
