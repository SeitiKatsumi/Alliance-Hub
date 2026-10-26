CREATE TABLE IF NOT EXISTS bia_despesa_aportes (
 id uuid PRIMARY KEY,
 bia_id text NOT NULL,
 autor text NOT NULL,
 pedido_hash text NOT NULL,
 movimentos jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'pendente',
 criado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bia_despesa_aportes_bia ON bia_despesa_aportes(bia_id);
