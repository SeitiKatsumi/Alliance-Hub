-- Cofre cifrado e unicidade da empresa para abertura idempotente de subcontas.
-- A chave de cifra permanece exclusivamente no ambiente do servidor.
DO $$
DECLARE namespace text;
BEGIN
  FOREACH namespace IN ARRAY ARRAY['asaas_sandbox', 'asaas_production'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.account_credentials (
      account_id uuid PRIMARY KEY REFERENCES %I.accounts(id) ON DELETE RESTRICT,
      ciphertext text NOT NULL,
      initialization_vector text NOT NULL,
      authentication_tag text NOT NULL,
      key_fingerprint text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )', namespace, namespace);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.accounts(owner_id)
      WHERE owner_id IS NOT NULL AND ownership = ''company''', namespace || '_accounts_company_owner_unique', namespace);
  END LOOP;
END $$;
