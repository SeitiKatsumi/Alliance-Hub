ALTER TABLE transferencias_cotas
  ALTER COLUMN valor_total TYPE numeric(18,5) USING valor_total::numeric(18,5),
  ALTER COLUMN percentual_transferencia TYPE numeric(8,5) USING percentual_transferencia::numeric(8,5);
