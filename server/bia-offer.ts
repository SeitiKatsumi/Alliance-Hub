export const OBA_OFFER_SQL = `
CREATE TABLE IF NOT EXISTS oba_ofertas_versoes (
  registry_id uuid NOT NULL REFERENCES opportunity_registry(id),
  bia_id text NOT NULL,
  revisao integer NOT NULL,
  oferta jsonb NOT NULL,
  assinatura text NOT NULL,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registry_id,revisao)
);
`;
